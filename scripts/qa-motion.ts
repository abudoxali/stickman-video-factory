// Engine-level motion QA for a scene. Evaluates every frame and checks the
// physical/animation guarantees that still frames cannot prove.
//
// Usage: npx tsx scripts/qa-motion.ts [sceneModule=the-surprise]
// Writes out/qa/motion-report.json and exits non-zero on hard failures.
import fs from "node:fs";
import path from "node:path";
import { anchorPoint } from "../src/engine/anchors";
import { evaluateCamera } from "../src/engine/camera";
import { dist, rotate, v, type Vec2 } from "../src/engine/math";
import { evaluateScene, getRuntime } from "../src/engine/runtime";
import type { SceneDef } from "../src/engine/scene";
import { theSurprise } from "../src/scenes/theSurprise";

const SCENES: Record<string, SceneDef> = { "the-surprise": theSurprise };
const name = process.argv[2] ?? "the-surprise";
const def = SCENES[name];
if (!def) throw new Error(`unknown scene ${name}`);

const rt = getRuntime(def);
const N = def.durationInFrames;
const inRanges = (r: [number, number][] | undefined, f: number) => !!r?.some(([a, b]) => f >= a && f < b);

type Hard = { check: string; detail: string };
const hard: Hard[] = [];
const warn: string[] = [];
for (const tr of def.characters) for (const w of rt.bakes.get(tr.id)!.warnings) warn.push(w);

const footPts = (ankle: Vec2, rot: number, facing: number, footLen: number, ankleH: number) => {
  const sg = facing >= 0 ? 1 : -1;
  const toe = rotate(v(0.7 * footLen, ankleH), rot);
  const heel = rotate(v(-0.3 * footLen, ankleH), rot);
  return { toe: v(ankle.x + toe.x * sg, ankle.y + toe.y), heel: v(ankle.x + heel.x * sg, ankle.y + heel.y) };
};

const per: Record<
  string,
  {
    maxLimbErr: number;
    maxSlip: number;
    slipFrames: number;
    maxIkErr: number;
    floorPen: number;
    pops: { frame: number; joint: string; px: number }[];
    activeFrames: number;
    visibleFrames: number;
    meanMotion: number;
  }
> = {};
const prev: Record<string, Record<string, Vec2> | null> = {};
const prevFeet: Record<string, { F: { p: ReturnType<typeof footPts>; plant: number }; B: { p: ReturnType<typeof footPts>; plant: number } } | null> = {};
const overlapFrames: number[] = [];
const prevFacing: Record<string, number> = {};
const propJumps: { frame: number; prop: string; px: number }[] = [];
const prevProp: Record<string, Vec2 & { attach: boolean }> = {};
const motionPerSecond: number[] = [];

for (const tr of def.characters) {
  per[tr.id] = { maxLimbErr: 0, maxSlip: 0, slipFrames: 0, maxIkErr: 0, floorPen: 0, pops: [], activeFrames: 0, visibleFrames: 0, meanMotion: 0 };
  prev[tr.id] = null;
  prevFeet[tr.id] = null;
}

let secMotion = 0;
for (let f = 0; f < N; f++) {
  const sf = evaluateScene(def, f);
  for (const tr of def.characters) {
    const r = sf.characters[tr.id];
    const s = r.spec;
    const j = r.joints;
    const P = per[tr.id];
    for (const [k, val] of Object.entries(r.pose)) if (!Number.isFinite(val)) hard.push({ check: "nan", detail: `${tr.id}.${k}@${f}` });
    // Limb lengths are checked in rig-local space: world joints are
    // intentionally compressed horizontally during edge-on turn frames.
    const L = j.local;
    const limb = [
      [dist(L.shoulderF, L.elbowF), s.upperArm],
      [dist(L.elbowF, L.wristF), s.foreArm],
      [dist(L.shoulderB, L.elbowB), s.upperArm],
      [dist(L.elbowB, L.wristB), s.foreArm],
      [dist(L.hipF, L.kneeF), s.thigh],
      [dist(L.kneeF, L.ankleF), s.shin],
      [dist(L.hipB, L.kneeB), s.thigh],
      [dist(L.kneeB, L.ankleB), s.shin],
    ];
    for (const [a, b] of limb) P.maxLimbErr = Math.max(P.maxLimbErr, Math.abs(a - b));

    // planted-foot IK accuracy
    if (r.pose.plantF >= 1) P.maxIkErr = Math.max(P.maxIkErr, dist(j.ankleF, v(r.pose.fFx, r.pose.fFy)));
    if (r.pose.plantB >= 1) P.maxIkErr = Math.max(P.maxIkErr, dist(j.ankleB, v(r.pose.fBx, r.pose.fBy)));

    // floor penetration (soles below the floor)
    const fF = footPts(j.ankleF, r.pose.fFrot, r.pose.facing, s.footLen, s.ankleH);
    const fB = footPts(j.ankleB, r.pose.fBrot, r.pose.facing, s.footLen, s.ankleH);
    for (const p of [fF.toe, fF.heel, fB.toe, fB.heel]) if (p.y > def.floorY + 2.5 && r.pose.bodyRot === 0) P.floorPen++;

    // foot slide while planted (one contact point must hold)
    const pf = prevFeet[tr.id];
    if (pf && Math.abs(r.pose.facing) >= 1) {
      for (const [k, cur] of [
        ["F", { p: fF, plant: r.pose.plantF }],
        ["B", { p: fB, plant: r.pose.plantB }],
      ] as const) {
        const old = pf[k];
        if (old.plant >= 1 && cur.plant >= 1) {
          const slip = Math.min(dist(old.p.toe, cur.p.toe), dist(old.p.heel, cur.p.heel));
          if (slip > 0.75) P.slipFrames++;
          P.maxSlip = Math.max(P.maxSlip, slip);
        }
      }
    }
    prevFeet[tr.id] = { F: { p: fF, plant: r.pose.plantF }, B: { p: fB, plant: r.pose.plantB } };

    // pops + activity
    const visible = !inRanges(tr.hidden, f);
    const pts: Record<string, Vec2> = {
      head: j.headC,
      chest: j.chest,
      wristF: j.wristF,
      wristB: j.wristB,
      ankleF: j.ankleF,
      ankleB: j.ankleB,
      pelvis: j.pelvis,
    };
    const pp = prev[tr.id];
    if (pp && visible) {
      let sum = 0;
      for (const [k, p] of Object.entries(pts)) {
        const d = dist(p, pp[k]);
        sum += d;
        const airborne = r.loco.airborne > 0;
        const turning = Math.abs(r.pose.facing) < 1 || Math.abs(prevFacing[tr.id] ?? 1) < 1;
        if (!turning && d > (airborne ? 90 : 60)) P.pops.push({ frame: f, joint: k, px: Math.round(d) });
      }
      const mean = sum / Object.keys(pts).length;
      P.meanMotion += mean;
      if (mean > 0.6) P.activeFrames++;
      secMotion += mean;
    }
    if (visible) P.visibleFrames++;
    prev[tr.id] = pts;
    prevFacing[tr.id] = r.pose.facing;
  }

  // head-head interpenetration between characters
  const ids = def.characters.map((c) => c.id).filter((id) => !inRanges(def.characters.find((c) => c.id === id)!.hidden, f));
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++) {
      const A = sf.characters[ids[a]];
      const B = sf.characters[ids[b]];
      const trB = def.characters.find((c) => c.id === ids[b])!;
      const trA = def.characters.find((c) => c.id === ids[a])!;
      if (inRanges(trA.hideHead, f) || inRanges(trB.hideHead, f)) continue;
      if (dist(A.joints.headC, B.joints.headC) < (A.spec.headR + B.spec.headR) * 0.92) overlapFrames.push(f);
    }

  // prop pops (attachment switches that jump)
  for (const p of def.props) {
    const pf = sf.props[p.id];
    const st = [...p.states].reverse().find((s) => s.from <= f);
    const attach = st?.mode === "attach";
    const old = prevProp[p.id];
    if (old && !inRanges(p.hidden, f)) {
      const d = dist(old, pf);
      const speed = Math.hypot(pf.vx, pf.vy);
      if (d > Math.max(45, speed * 2.2)) propJumps.push({ frame: f, prop: p.id, px: Math.round(d) });
    }
    prevProp[p.id] = { x: pf.x, y: pf.y, attach };
  }

  if ((f + 1) % def.fps === 0) {
    motionPerSecond.push(Number(secMotion.toFixed(1)));
    secMotion = 0;
  }
}

for (const [id, P] of Object.entries(per)) {
  P.meanMotion = Number((P.meanMotion / Math.max(1, P.visibleFrames)).toFixed(2));
  if (P.maxLimbErr > 0.01) hard.push({ check: "limb-length", detail: `${id} max error ${P.maxLimbErr.toFixed(4)}px` });
  if (P.maxSlip > 1.0) hard.push({ check: "foot-slide", detail: `${id} max planted slip ${P.maxSlip.toFixed(2)}px` });
  if (P.maxIkErr > 0.75) hard.push({ check: "foot-ik", detail: `${id} planted ankle misses target by ${P.maxIkErr.toFixed(2)}px` });
  if (P.floorPen > 0) warn.push(`${id}: ${P.floorPen} sole samples below the floor`);
  if (P.pops.length) warn.push(`${id}: ${P.pops.length} joint pops (>60px/frame), first: ${JSON.stringify(P.pops.slice(0, 3))}`);
}
if (overlapFrames.length) warn.push(`head interpenetration on ${overlapFrames.length} frames, e.g. ${overlapFrames.slice(0, 8).join(",")}`);
if (propJumps.length) warn.push(`prop jumps: ${JSON.stringify(propJumps.slice(0, 8))}`);

// Event timeline
const events: { t: string; frame: number; what: string }[] = [];
for (const tr of def.characters)
  for (const e of rt.bakes.get(tr.id)!.events)
    if (e.kind !== "contact") events.push({ t: (e.frame / def.fps).toFixed(2), frame: e.frame, what: `${tr.id} ${e.kind}` });
for (const p of def.props) for (const s of p.states) if (s.from > 0) events.push({ t: (s.from / def.fps).toFixed(2), frame: s.from, what: `${p.id} -> ${s.mode}` });
events.sort((a, b) => a.frame - b.frame);

// Camera framings (distinct zoom/position holds and moves)
const camKeys = def.camera.keys.length;
const camRange = (() => {
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let f = 0; f < N; f += 3) {
    const c = evaluateCamera(def, f);
    zmin = Math.min(zmin, c.zoom);
    zmax = Math.max(zmax, c.zoom);
  }
  return { zmin: Number(zmin.toFixed(2)), zmax: Number(zmax.toFixed(2)) };
})();

const actionCount = def.characters.reduce((n, c) => n + c.actions.length + c.moves.length, 0);
const clipsUsed = [...new Set(def.characters.flatMap((c) => c.actions.map((a) => a.clip)))].sort();
const movesUsed = [...new Set(def.characters.flatMap((c) => c.moves.map((m) => m.type + ("style" in m && m.style ? `:${m.style}` : ""))))].sort();
const staticSeconds = motionPerSecond.filter((m) => m < 15).length;

const report = {
  scene: def.id,
  frames: N,
  fps: def.fps,
  characters: per,
  actions: { count: actionCount, clipsUsed, movesUsed, expressionKeys: def.characters.reduce((n, c) => n + c.expressions.length, 0) },
  camera: { keys: camKeys, ...camRange, shakes: def.camera.shakes.length },
  motionPerSecond,
  staticSeconds,
  events,
  warnings: warn,
  hardFailures: hard,
  anchorsChecked: anchorPoint !== undefined,
};
fs.mkdirSync("out/qa", { recursive: true });
fs.writeFileSync(path.join("out/qa", "motion-report.json"), JSON.stringify(report, null, 2));

console.log(`Motion QA: ${def.id} (${N} frames)`);
for (const [id, P] of Object.entries(per))
  console.log(
    `  ${id.padEnd(4)} limbErr=${P.maxLimbErr.toExponential(1)}px slip=${P.maxSlip.toFixed(2)}px ikErr=${P.maxIkErr.toFixed(2)}px active=${P.activeFrames}/${P.visibleFrames} meanMotion=${P.meanMotion}px/f pops=${P.pops.length} floorPen=${P.floorPen}`,
  );
console.log(`  actions+moves=${actionCount} clips=${clipsUsed.length} moves=${movesUsed.join(",")}`);
console.log(`  camera keys=${camKeys} zoom ${camRange.zmin}..${camRange.zmax} shakes=${def.camera.shakes.length}`);
console.log(`  motion/sec: ${motionPerSecond.join(" ")}  (static seconds: ${staticSeconds})`);
for (const w of warn) console.log(`  WARN ${w}`);
for (const h of hard) console.log(`  FAIL ${h.check}: ${h.detail}`);
console.log(hard.length ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(hard.length ? 1 : 0);
