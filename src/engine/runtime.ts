import { anchorPoint, anchorRotation } from "./anchors";
import { CLIPS, type ClipCtx } from "./clips";
import { EXPRESSIONS, FACE_CHANNELS, type ExpressionName } from "./expressions";
import { bakeLocomotion, type LocoBake, type LocoFrame } from "./locomotion";
import {
  add,
  clamp,
  ease,
  envelope,
  hash,
  lerp,
  noise1,
  rotate,
  scale,
  sub,
  v,
  vlerp,
  type Vec2,
} from "./math";
import { blendArmPolar, makeTransforms, restPose, solvePose, standHipHeight, up } from "./rig";
import type {
  AnchorPart,
  CharacterTrack,
  LookTarget,
  ParamKey,
  PropState,
  PropTrack,
  SceneDef,
  TargetRef,
} from "./scene";
import type { CharacterSpec, Joints, PartialPose, Pose, PoseChannel } from "./types";

// ---------------------------------------------------------------------------
// Runtime: per-scene caches (locomotion bakes, secondary-motion simulation).
// Keyed by the SceneDef object so Studio hot-reloads invalidate naturally.
// ---------------------------------------------------------------------------
interface Secondary {
  hairSwing: Float64Array;
  hairStretch: Float64Array;
  leanExtra: Float64Array;
  headNod: Float64Array;
  /** World elbow/wrist trajectories (x,y interleaved) from the pre-secondary solve: limb smears. */
  trail: Record<TrailJoint, Float64Array>;
}

export const TRAIL_JOINTS = ["elbowF", "wristF", "elbowB", "wristB"] as const;
export type TrailJoint = (typeof TRAIL_JOINTS)[number];

export interface Runtime {
  def: SceneDef;
  bakes: Map<string, LocoBake>;
  tracks: Map<string, CharacterTrack>;
  secondary: Map<string, Secondary>;
  blinks: Map<string, number[]>;
}

const cache = new WeakMap<SceneDef, Runtime>();

export const getRuntime = (def: SceneDef): Runtime => {
  let rt = cache.get(def);
  if (rt) return rt;
  rt = { def, bakes: new Map(), tracks: new Map(), secondary: new Map(), blinks: new Map() };
  for (const tr of def.characters) {
    rt.tracks.set(tr.id, tr);
    rt.bakes.set(
      tr.id,
      bakeLocomotion(tr.spec, tr.moves, {
        x: tr.x,
        floorY: def.floorY,
        facing: tr.facing,
        totalFrames: def.durationInFrames,
      }),
    );
    rt.blinks.set(tr.id, blinkSchedule(tr, def.durationInFrames));
  }
  cache.set(def, rt);
  return rt;
};

// ---------------------------------------------------------------------------
// Keyframed scalar params (props, set dressing)
// ---------------------------------------------------------------------------
export const evalParam = (keys: ParamKey[] | undefined, frame: number, fallback = 0): number => {
  if (!keys || keys.length === 0) return fallback;
  if (frame <= keys[0].at) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.at && frame <= b.at) {
      const fn = ease[b.ease ?? "inOutCubic"];
      return lerp(a.value, b.value, fn((frame - a.at) / (b.at - a.at || 1)));
    }
  }
  return keys[keys.length - 1].value;
};

// ---------------------------------------------------------------------------
// Blinks: deterministic schedule + blinks on look changes.
// ---------------------------------------------------------------------------
const BLINK_CURVE = [0.35, 0.85, 1, 1, 0.75, 0.45, 0.2, 0.05];

const blinkSchedule = (tr: CharacterTrack, total: number) => {
  const out: number[] = [];
  let t = 18 + Math.floor(hash(tr.spec.seed) * 30);
  let i = 0;
  while (t < total) {
    out.push(t);
    t += 62 + Math.floor(hash(tr.spec.seed * 3.1 + i * 7.7) * 75);
    i++;
  }
  for (const k of tr.look) if (!k.noBlink && k.at > 0) out.push(k.at);
  return out.sort((a, b) => a - b);
};

const blinkAt = (rt: Runtime, id: string, f: number) => {
  let b = 0;
  for (const s of rt.blinks.get(id) ?? []) {
    const d = f - s;
    if (d >= 0 && d < BLINK_CURVE.length) b = Math.max(b, BLINK_CURVE[d]);
  }
  return b;
};

// ---------------------------------------------------------------------------
// Prepass: locomotion-only pose. Cheap, acyclic; used when one character
// needs to know roughly where another one is (look-at, hand-over targets).
// ---------------------------------------------------------------------------
const locoPose = (spec: CharacterSpec, loco: LocoFrame): Pose => {
  const p = restPose(spec, loco.x, loco.y, loco.facing);
  p.bodyRot = loco.bodyRot;
  p.hipY = standHipHeight(spec) + loco.hipDelta;
  p.hipX = loco.hipX;
  p.lean += loco.lean;
  p.squash = loco.squash;
  const { toWorld } = makeTransforms(p);
  const F = loco.feetLocal ? toWorld(v(loco.F.x, loco.F.y)) : v(loco.F.x, loco.F.y);
  const B = loco.feetLocal ? toWorld(v(loco.B.x, loco.B.y)) : v(loco.B.x, loco.B.y);
  p.fFx = F.x;
  p.fFy = F.y;
  p.fFrot = loco.F.rot;
  p.fBx = B.x;
  p.fBy = B.y;
  p.fBrot = loco.B.rot;
  p.plantF = loco.F.plant;
  p.plantB = loco.B.plant;
  return p;
};

const frameOf = (rt: Runtime, f: number) => clamp(Math.round(f), 0, rt.def.durationInFrames - 1);

export const prepass = (rt: Runtime, id: string, frame: number) => {
  const tr = rt.tracks.get(id);
  if (!tr) throw new Error(`Unknown character ${id}`);
  const loco = rt.bakes.get(id)!.frames[frameOf(rt, frame)];
  return solvePose(tr.spec, locoPose(tr.spec, loco));
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface PropFrame {
  x: number;
  y: number;
  rot: number;
  /** World velocity (px/frame), for motion blur / smear. */
  vx: number;
  vy: number;
  airborne: boolean;
  /** -1 when mirrored (held by a character facing left). */
  flip?: number;
}

type CharResolver = (id: string, frame: number) => { pose: Pose; joints: Joints; spec: CharacterSpec };

/** Landing point of a ballistic flight aimed at a (possibly moving) target. */
const landingPoint = (rt: Runtime, ref: TargetRef, frame: number, resolve: CharResolver, from: Vec2, contact: number): Vec2 => {
  let p: Vec2;
  if ("point" in ref) p = v(ref.point[0], ref.point[1]);
  else if ("prop" in ref) {
    const prop = rt.def.props.find((q) => q.id === ref.prop);
    if (!prop) throw new Error(`Unknown prop ${ref.prop}`);
    const q = evaluateProp(rt, prop, frame, resolve);
    p = v(q.x + (ref.offset?.[0] ?? 0), q.y + (ref.offset?.[1] ?? 0));
  } else {
    const c = resolve(ref.char, frame);
    const a = anchorPoint(c.spec, c.pose, c.joints, ref.part);
    p = v(a.x + (ref.offset?.[0] ?? 0), a.y + (ref.offset?.[1] ?? 0));
  }
  if (contact > 0) {
    const d = sub(from, p);
    const l = Math.hypot(d.x, d.y) || 1;
    p = add(p, scale(d, contact / l));
  }
  return p;
};

const propStateAt = (
  rt: Runtime,
  prop: PropTrack,
  idx: number,
  frame: number,
  resolve: CharResolver,
): PropFrame => {
  const st: PropState = prop.states[idx];
  if (st.mode === "static") {
    return { x: st.pos[0], y: st.pos[1], rot: st.rot ?? 0, vx: 0, vy: 0, airborne: false };
  }
  if (st.mode === "attach") {
    const c = resolve(st.char, frame);
    const base = anchorPoint(c.spec, c.pose, c.joints, st.part);
    const ar = st.inheritRot ? anchorRotation(c.pose, c.joints, st.part) : 0;
    const sgn = c.pose.facing >= 0 ? 1 : -1;
    const off = st.offset ? v(st.offset[0] * sgn, st.offset[1]) : v(0, 0);
    const o = st.inheritRot ? rotate(off, ar) : off;
    let out: PropFrame = { x: base.x + o.x, y: base.y + o.y, rot: ar + (st.rot ?? 0) * sgn, vx: 0, vy: 0, airborne: false, flip: sgn };
    const blend = st.blend ?? 0;
    if (blend > 0 && idx > 0 && frame < st.from + blend) {
      const prev = propStateAt(rt, prop, idx - 1, st.from, resolve);
      const k = ease.inOutCubic((frame - st.from) / blend);
      out = { ...out, x: lerp(prev.x, out.x, k), y: lerp(prev.y, out.y, k), rot: lerp(prev.rot, out.rot, k) };
    }
    return out;
  }
  if (st.mode === "slide") {
    const prev = idx > 0 ? propStateAt(rt, prop, idx - 1, st.from, resolve) : { x: st.to[0], y: st.to[1], rot: 0 };
    const u = clamp((frame - st.from) / Math.max(1, st.dur), 0, 1);
    const k = ease[st.ease ?? "inOutSine"](u);
    return { x: lerp(prev.x, st.to[0], k), y: lerp(prev.y, st.to[1], k), rot: prev.rot, vx: 0, vy: 0, airborne: false };
  }
  // ballistic
  const start =
    st.fromPos !== undefined
      ? { x: st.fromPos[0], y: st.fromPos[1], rot: idx > 0 ? propStateAt(rt, prop, idx - 1, st.from, resolve).rot : 0 }
      : idx > 0
        ? propStateAt(rt, prop, idx - 1, st.from, resolve)
        : { x: st.to[0], y: st.to[1], rot: 0 };
  let to = v(st.to[0], st.to[1]);
  if (st.toRef) to = landingPoint(rt, st.toRef, st.from + st.dur, resolve, start, st.contact ?? 0);
  const t = frame - st.from;
  const H = st.peak ?? 80;
  const endRot = st.endRot ?? start.rot + (st.spin ?? 0);
  if (t <= st.dur) {
    const u = t / st.dur;
    const x = lerp(start.x, to.x, u);
    const y = lerp(start.y, to.y, u) - 4 * H * u * (1 - u);
    const vy = (to.y - start.y) / st.dur - (4 * H * (1 - 2 * u)) / st.dur;
    return { x, y, rot: lerp(start.rot, endRot, u), vx: (to.x - start.x) / st.dur, vy, airborne: t > 0 && t < st.dur };
  }
  // bounces after landing
  let tt = t - st.dur;
  let x = to.x;
  let rot = endRot;
  const dirx = Math.sign(to.x - start.x) || 1;
  for (const [h, n] of st.bounces ?? []) {
    if (tt < n) {
      const u = tt / n;
      return {
        x: x + dirx * (st.skid ?? 0) * u,
        y: to.y - 4 * h * u * (1 - u),
        rot: rot + dirx * 0.15 * Math.sin(Math.PI * u) * (h / 30),
        vx: 0,
        vy: 0,
        airborne: true,
      };
    }
    tt -= n;
    x += dirx * (st.skid ?? 0);
    rot = rot + 0;
  }
  return { x, y: to.y, rot, vx: 0, vy: 0, airborne: false };
};

export const evaluateProp = (rt: Runtime, prop: PropTrack, frame: number, resolve: CharResolver): PropFrame => {
  let idx = 0;
  for (let i = 0; i < prop.states.length; i++) if (prop.states[i].from <= frame) idx = i;
  return propStateAt(rt, prop, idx, frame, resolve);
};

const prepassResolver =
  (rt: Runtime): CharResolver =>
  (id, frame) => {
    const tr = rt.tracks.get(id)!;
    const r = prepass(rt, id, frame);
    return { ...r, spec: tr.spec };
  };

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------
const resolveTarget = (rt: Runtime, ref: TargetRef, frame: number, self?: { id: string; spec: CharacterSpec; pose: Pose }): Vec2 => {
  if ("point" in ref) return v(ref.point[0], ref.point[1]);
  if ("prop" in ref) {
    const prop = rt.def.props.find((p) => p.id === ref.prop);
    if (!prop) throw new Error(`Unknown prop ${ref.prop}`);
    // Props attached to the asking character resolve against its in-progress
    // pose (hands reaching for a box on their own head); others use prepass.
    const pre = prepassResolver(rt);
    const resolver: CharResolver = (cid, fr) =>
      self && cid === self.id && fr === frame
        ? { ...solvePose(self.spec, self.pose), spec: self.spec }
        : pre(cid, fr);
    const p = evaluateProp(rt, prop, frame, resolver);
    return v(p.x + (ref.offset?.[0] ?? 0), p.y + (ref.offset?.[1] ?? 0));
  }
  let base: Vec2;
  if (self && ref.char === self.id) {
    const j = solvePose(self.spec, self.pose).joints;
    base = anchorPoint(self.spec, self.pose, j, ref.part);
  } else {
    const tr = rt.tracks.get(ref.char);
    if (!tr) throw new Error(`Unknown character ${ref.char}`);
    const r = prepass(rt, ref.char, frame);
    base = anchorPoint(tr.spec, r.pose, r.joints, ref.part);
  }
  return v(base.x + (ref.offset?.[0] ?? 0), base.y + (ref.offset?.[1] ?? 0));
};

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------
const exprFace = (name: ExpressionName, amount = 1) => {
  const neutral = EXPRESSIONS.neutral.face as PartialPose;
  const e = EXPRESSIONS[name];
  const rest = restPose(
    { ankleH: 0, thigh: 0, shin: 0 } as CharacterSpec,
  );
  const out: Partial<Record<PoseChannel, number>> = {};
  for (const ch of [...FACE_CHANNELS, "eyeX", "eyeY"] as PoseChannel[]) {
    const n = (neutral[ch] ?? (ch === "eyeX" || ch === "eyeY" ? 0 : rest[ch])) as number;
    const val = ((e.face as PartialPose)[ch] ?? n) as number;
    out[ch] = lerp(n, val, amount);
  }
  const body: Partial<Record<PoseChannel, number>> = {};
  for (const [k, val] of Object.entries(e.body as PartialPose)) body[k as PoseChannel] = (val as number) * amount;
  return { face: out, body };
};

const evalExpression = (tr: CharacterTrack, f: number) => {
  const keys = tr.expressions;
  let cur = exprFace("neutral");
  if (!keys.length) return cur;
  let k = -1;
  for (let i = 0; i < keys.length; i++) if (keys[i].at <= f) k = i;
  if (k < 0) return exprFace(keys[0].expr, keys[0].amount ?? 1);
  const prev = k > 0 ? exprFace(keys[k - 1].expr, keys[k - 1].amount ?? 1) : exprFace("neutral");
  // if the previous key's own transition is still running, start from its blended state
  cur = exprFace(keys[k].expr, keys[k].amount ?? 1);
  const blend = keys[k].blend ?? 6;
  const w = ease.inOutSine(clamp((f - keys[k].at) / Math.max(1, blend), 0, 1));
  const mix = (a: Partial<Record<PoseChannel, number>>, b: Partial<Record<PoseChannel, number>>) => {
    const o: Partial<Record<PoseChannel, number>> = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PoseChannel>) {
      o[key] = lerp(a[key] ?? 0, b[key] ?? 0, w);
    }
    return o;
  };
  return { face: mix(prev.face, cur.face), body: mix(prev.body, cur.body) };
};

// ---------------------------------------------------------------------------
// Look-at: eyes lead, head follows a few frames later.
// ---------------------------------------------------------------------------
interface LookChannels {
  faceTurn: number;
  eyeX: number;
  eyeY: number;
  pitch: number;
}

const lookChannels = (rt: Runtime, tr: CharacterTrack, target: LookTarget, f: number, pose: Pose): LookChannels => {
  if (target === "camera") return { faceTurn: 0.04, eyeX: 0, eyeY: 0, pitch: 0 };
  const { toLocal } = makeTransforms(pose);
  const j = solvePose(tr.spec, pose).joints;
  const head = j.headC;
  const sgn = pose.facing >= 0 ? 1 : -1;
  let P: Vec2;
  if (target === "ahead") P = add(head, v(sgn * 500, 20));
  else if (target === "down") P = add(head, v(sgn * 160, 320));
  else if (target === "up") P = add(head, v(sgn * 120, -420));
  else P = resolveTarget(rt, target, f, { id: tr.id, spec: tr.spec, pose });
  const d = sub(toLocal(P), toLocal(head));
  const l = Math.hypot(d.x, d.y) || 1;
  const h = d.x / l;
  const e = clamp(Math.atan2(-d.y, Math.abs(d.x) + 1e-3), -1.1, 1.1);
  return {
    faceTurn: h >= 0 ? lerp(0.22, 0.75, h) : lerp(0.22, -0.5, -h),
    eyeX: clamp(h * 1.15, -1, 1),
    eyeY: clamp(-Math.sin(e) * 1.25, -1, 1),
    pitch: clamp(-e * 0.42, -0.35, 0.35),
  };
};

const evalLook = (rt: Runtime, tr: CharacterTrack, f: number, pose: Pose): LookChannels => {
  const keys = tr.look.length ? tr.look : [{ at: 0, target: "ahead" as LookTarget }];
  let k = 0;
  for (let i = 0; i < keys.length; i++) if (keys[i].at <= f) k = i;
  const cur = lookChannels(rt, tr, keys[k].target, f, pose);
  if (k === 0 || f < keys[k].at) return cur;
  const blend = keys[k].blend ?? 6;
  const w = ease.inOutCubic(clamp((f - keys[k].at) / Math.max(1, blend), 0, 1));
  if (w >= 1) return cur;
  const prev = lookChannels(rt, tr, keys[k - 1].target, f, pose);
  return {
    faceTurn: lerp(prev.faceTurn, cur.faceTurn, w),
    eyeX: lerp(prev.eyeX, cur.eyeX, w),
    eyeY: lerp(prev.eyeY, cur.eyeY, w),
    pitch: lerp(prev.pitch, cur.pitch, w),
  };
};

// ---------------------------------------------------------------------------
// Character evaluation
// ---------------------------------------------------------------------------
/** Global engine switches (benchmarks/A-B comparisons only; scenes never change these). */
export const ENGINE_OPTIONS: { armBlend: "hand" | "angle" } = { armBlend: "hand" };

const ARM_CHANNELS = { F: ["aFsh", "aFel"], B: ["aBsh", "aBel"] } as const;

export const applyLayer = (
  pose: Pose,
  out: PartialPose,
  w: number,
  kind: "override" | "additive",
  spec?: CharacterSpec,
  armBlend: "hand" | "angle" = "hand",
) => {
  if (w <= 0) return;
  // Arms driven by an override layer blend in hand space (see blendArmPolar).
  const handled = new Set<string>();
  if (kind === "override" && spec && armBlend === "hand" && ENGINE_OPTIONS.armBlend === "hand" && w < 1) {
    for (const [shK, elK] of Object.values(ARM_CHANNELS)) {
      const sh = out[shK];
      const el = out[elK];
      if (sh === undefined || el === undefined || Number.isNaN(sh) || Number.isNaN(el)) continue;
      const r = blendArmPolar(spec, { sh: pose[shK], el: pose[elK] }, { sh, el }, w);
      pose[shK] = r.sh;
      pose[elK] = r.el;
      handled.add(shK).add(elK);
    }
  }
  for (const [k, val] of Object.entries(out)) {
    if (val === undefined || Number.isNaN(val) || handled.has(k)) continue;
    const ch = k as PoseChannel;
    pose[ch] = kind === "override" ? lerp(pose[ch], val as number, w) : pose[ch] + (val as number) * w;
  }
};

const baseLayers = (spec: CharacterSpec, loco: LocoFrame, f: number, pose: Pose) => {
  // Walk / run arm swing derived from foot separation (never out of sync).
  const run = loco.run;
  const A = spec.gait.armSwing * (1 + run * 0.5);
  const sw = loco.swing * loco.moving;
  pose.aFsh = lerp(pose.aFsh - A * sw, -1.05 * sw + 0.35, run);
  pose.aBsh = lerp(pose.aBsh + A * sw, 1.05 * sw + 0.35, run);
  pose.aFel = lerp(0.28 + 0.55 * Math.max(0, -sw), 1.65, run);
  pose.aBel = lerp(0.32 + 0.55 * Math.max(0, sw), 1.65, run);
  pose.hFopen = lerp(pose.hFopen, 0.1, run);
  pose.hBopen = lerp(pose.hBopen, 0.1, run);

  if (loco.sneak > 0) {
    const out = CLIPS.sneak.fn({ pose, t: f } as unknown as ClipCtx);
    applyLayer(pose, out, loco.sneak, "override");
    // sneaking hands bob with each step
    pose.aFel += 0.15 * loco.swing;
    pose.aBel -= 0.15 * loco.swing;
  }

  const j = loco.jumpArms;
  if (j < 0) {
    const w = -j;
    pose.aFsh = lerp(pose.aFsh, -0.95, w);
    pose.aFel = lerp(pose.aFel, 0.45, w);
    pose.aBsh = lerp(pose.aBsh, -0.8, w);
    pose.aBel = lerp(pose.aBel, 0.55, w);
  } else if (j > 0) {
    pose.aFsh = lerp(pose.aFsh, 2.5, j);
    pose.aFel = lerp(pose.aFel, 0.35, j);
    pose.aBsh = lerp(pose.aBsh, 2.25, j);
    pose.aBel = lerp(pose.aBel, 0.45, j);
    pose.armGrav = lerp(pose.armGrav, 0.35, j);
    pose.hFopen = lerp(pose.hFopen, 1, j);
    pose.hBopen = lerp(pose.hBopen, 1, j);
  }

  if (loco.wobble) {
    pose.lean += 0.1 * loco.wobble;
    pose.head += 0.12 * loco.wobble;
  }
  if (loco.sit > 0) {
    pose.aFsh = lerp(pose.aFsh, 0.6, loco.sit);
    pose.aFel = lerp(pose.aFel, 0.75, loco.sit);
    pose.aBsh = lerp(pose.aBsh, 0.5, loco.sit);
    pose.aBel = lerp(pose.aBel, 0.85, loco.sit);
  }
  if (loco.lying > 0) {
    pose.aFsh = lerp(pose.aFsh, 1.7, loco.lying);
    pose.aBsh = lerp(pose.aBsh, -1.2, loco.lying);
    pose.aFel = lerp(pose.aFel, 0.3, loco.lying);
  }

  // Breathing + idle weight shift: never a frozen frame.
  const still = 1 - loco.moving;
  const b = Math.sin((2 * Math.PI * f) / spec.idle.breathRate + spec.seed);
  pose.chest += 0.022 * b;
  pose.shrug += 1.8 * b;
  pose.head -= 0.015 * b;
  pose.aFsh += 0.02 * b;
  pose.aBsh += 0.02 * b;
  pose.hipX += spec.idle.sway * Math.sin((2 * Math.PI * f) / 170 + spec.seed * 2) * still;
  pose.head += 0.02 * noise1(f / 45, spec.seed) * still;
};

export interface EvalResult {
  pose: Pose;
  joints: Joints;
  spec: CharacterSpec;
  loco: LocoFrame;
}

const evaluateRaw = (rt: Runtime, id: string, frame: number): Pose => {
  const tr = rt.tracks.get(id)!;
  const spec = tr.spec;
  const f = frameOf(rt, frame);
  const loco = rt.bakes.get(id)!.frames[f];
  const pose = locoPose(spec, loco);
  const fwd: 1 | -1 = pose.facing >= 0 ? 1 : -1;

  baseLayers(spec, loco, f, pose);

  // Expression (face absolute, body additive)
  const ex = evalExpression(tr, f);
  for (const [k, val] of Object.entries(ex.face)) {
    if (k === "eyeX" || k === "eyeY") continue;
    pose[k as PoseChannel] = val as number;
  }
  for (const [k, val] of Object.entries(ex.body)) pose[k as PoseChannel] += val as number;

  // Look: eyes now, head with lag (eyes lead the head).
  const eyes = evalLook(rt, tr, f, pose);
  const headLook = evalLook(rt, tr, Math.max(0, f - 4), pose);
  pose.faceTurn = headLook.faceTurn;
  pose.eyeX = clamp(eyes.eyeX + (ex.face.eyeX ?? 0), -1, 1);
  pose.eyeY = clamp(eyes.eyeY + (ex.face.eyeY ?? 0), -1, 1);
  pose.neck += headLook.pitch * 0.4;
  pose.head += headLook.pitch * 0.6;
  // Mid-turn the face swings to camera (front view), eyes centred.
  const turnK = ease.smooth(clamp((1 - Math.abs(pose.facing)) * 1.8, 0, 1));
  if (turnK > 0) {
    pose.faceTurn = lerp(pose.faceTurn, 0.02, turnK);
    pose.eyeX = lerp(pose.eyeX, 0, turnK);
  }

  // Action clips
  const ctxBase = {
    frame: f,
    spec,
    loco,
    fwd,
    target: (ref: TargetRef) => resolveTarget(rt, ref, f, { id, spec, pose }),
    targetAt: (ref: TargetRef, at: number) => resolveTarget(rt, ref, frameOf(rt, at)),
  };
  for (const a of tr.actions) {
    const out = a.out ?? 8;
    if (f < a.start || f > a.end + out) continue;
    const clip = CLIPS[a.clip];
    if (!clip) throw new Error(`Unknown clip "${a.clip}" on ${id}`);
    const w = envelope(f, a.start, a.end, a.in ?? 6, out);
    const dur = Math.max(1, a.end - a.start);
    const snapshot = { ...pose };
    const ctx: ClipCtx = {
      ...ctxBase,
      t: f - a.start,
      dur,
      u: clamp((f - a.start) / dur, 0, 1),
      pose: snapshot,
      params: a.params ?? {},
      target: (ref: TargetRef) => resolveTarget(rt, ref, f, { id, spec, pose: snapshot }),
      self: (part, p = snapshot) => {
        const j = solvePose(spec, p).joints;
        return anchorPoint(spec, p, j, part);
      },
    };
    applyLayer(pose, clip.fn(ctx), w, clip.kind, spec, clip.armBlend);
  }

  pose.blink = Math.max(pose.blink, blinkAt(rt, id, f));
  return pose;
};

// ---------------------------------------------------------------------------
// Secondary motion: spring simulation over the whole shot, cached.
// ---------------------------------------------------------------------------
const simulateSecondary = (rt: Runtime, id: string): Secondary => {
  const tr = rt.tracks.get(id)!;
  const spec = tr.spec;
  const N = rt.def.durationInFrames;
  const out: Secondary = {
    hairSwing: new Float64Array(N),
    hairStretch: new Float64Array(N),
    leanExtra: new Float64Array(N),
    headNod: new Float64Array(N),
    trail: { elbowF: new Float64Array(N * 2), wristF: new Float64Array(N * 2), elbowB: new Float64Array(N * 2), wristB: new Float64Array(N * 2) },
  };
  const loco = rt.bakes.get(id)!.frames;
  const hairLen = spec.hair === "tuft" ? 46 : 40;
  let tip: Vec2 | null = null;
  let vel = v(0, 0);
  let lean = 0;
  let leanV = 0;
  let nod = 0;
  let nodV = 0;
  let prevHead: Vec2 | null = null;
  let prevHeadV = v(0, 0);
  const SUB = 4;
  for (let f = 0; f < N; f++) {
    const pose = evaluateRaw(rt, id, f);
    const { joints } = solvePose(spec, pose);
    for (const k of TRAIL_JOINTS) {
      out.trail[k][f * 2] = joints[k].x;
      out.trail[k][f * 2 + 1] = joints[k].y;
    }
    const sgn = pose.facing >= 0 ? 1 : -1;
    const anchor = anchorPoint(spec, pose, joints, "headTop");
    const restDirLocal = up(joints.local.headAngle + (spec.hair === "tuft" ? -0.15 : 0.55));
    const restDir = rotate(v(restDirLocal.x * sgn, restDirLocal.y), sgn * pose.bodyRot);
    const restTip = add(anchor, scale(restDir, hairLen));
    if (!tip) tip = restTip;
    for (let k = 0; k < SUB; k++) {
      const acc = sub(scale(sub(restTip, tip), 0.16), scale(vel, 0.2));
      vel = add(vel, scale(add(acc, v(0, 0.35)), 1 / SUB));
      tip = add(tip, scale(vel, 1 / SUB));
    }
    const d = sub(tip, anchor);
    const ang = Math.atan2(d.x, -d.y) - Math.atan2(restDir.x, -restDir.y);
    out.hairSwing[f] = clamp(Math.atan2(Math.sin(ang), Math.cos(ang)) * sgn, -1.2, 1.2);
    out.hairStretch[f] = clamp(Math.hypot(d.x, d.y) / hairLen, 0.75, 1.35);

    // torso follow-through from root acceleration along facing
    const i0 = Math.max(0, f - 1);
    const i1 = Math.min(N - 1, f + 1);
    const accel = ((loco[i1].speed - loco[i0].speed) / 2) * sgn;
    for (let k = 0; k < SUB; k++) {
      const a = -0.09 * lean - 0.22 * leanV - accel * 0.028;
      leanV += a / SUB;
      lean += leanV / SUB;
    }
    out.leanExtra[f] = clamp(lean, -0.12, 0.12);

    // head nod from vertical head acceleration (landings, walk bob)
    const head = joints.headC;
    const hv = prevHead ? sub(head, prevHead) : v(0, 0);
    const hacc = hv.y - prevHeadV.y;
    prevHead = head;
    prevHeadV = hv;
    for (let k = 0; k < SUB; k++) {
      const a = -0.18 * nod - 0.3 * nodV + hacc * 0.012;
      nodV += a / SUB;
      nod += nodV / SUB;
    }
    out.headNod[f] = clamp(nod, -0.25, 0.25);
  }
  return out;
};

export const secondaryFor = (rt: Runtime, id: string) => {
  let s = rt.secondary.get(id);
  if (!s) {
    s = simulateSecondary(rt, id);
    rt.secondary.set(id, s);
  }
  return s;
};

export const evaluateCharacter = (rt: Runtime, id: string, frame: number, withSecondary = true): EvalResult => {
  const tr = rt.tracks.get(id);
  if (!tr) throw new Error(`Unknown character ${id}`);
  const f = frameOf(rt, frame);
  const pose = evaluateRaw(rt, id, f);
  if (withSecondary) {
    const s = secondaryFor(rt, id);
    pose.hairSwing = s.hairSwing[f];
    pose.hairStretch = s.hairStretch[f];
    pose.lean += s.leanExtra[f] * 0.6;
    pose.chest += s.leanExtra[f] * 0.5;
    pose.aFsh += s.leanExtra[f] * 1.4;
    pose.aBsh += s.leanExtra[f] * 1.4;
    pose.head += s.headNod[f];
  }
  const { pose: solved, joints } = solvePose(tr.spec, pose);
  return { pose: solved, joints, spec: tr.spec, loco: rt.bakes.get(id)!.frames[f] };
};

// ---------------------------------------------------------------------------
// Whole-frame evaluation
// ---------------------------------------------------------------------------
export interface SceneFrame {
  frame: number;
  characters: Record<string, EvalResult>;
  props: Record<string, PropFrame & { params: Record<string, number> }>;
}

export const evaluateScene = (def: SceneDef, frame: number): SceneFrame => {
  const rt = getRuntime(def);
  const characters: Record<string, EvalResult> = {};
  for (const tr of def.characters) characters[tr.id] = evaluateCharacter(rt, tr.id, frame);
  const resolve: CharResolver = (id, fr) =>
    fr === frame && characters[id] ? characters[id] : { ...evaluateCharacter(rt, id, fr) };
  const props: SceneFrame["props"] = {};
  for (const p of def.props) {
    const pf = evaluateProp(rt, p, frame, resolve);
    const params: Record<string, number> = {};
    for (const [k, keys] of Object.entries(p.params ?? {})) params[k] = evalParam(keys, frame);
    props[p.id] = { ...pf, params };
  }
  return { frame, characters, props };
};

export const vlerpExport = vlerp;
export type { AnchorPart };

// ---------------------------------------------------------------------------
// Limb smears: fast arms leave a swept "smear" shape (classic cartoon motion
// blur on 1-2 frames) instead of teleporting between frames. Past positions
// come from the cached trajectory, re-anchored to the final joints so the
// smear stays attached to the arm.
// ---------------------------------------------------------------------------
export interface LimbSmear {
  /** 0..1 strength from wrist speed. */
  k: number;
  /** World points, newest first: [now, ..., oldest]. */
  elbows: Vec2[];
  wrists: Vec2[];
}

export const SMEAR_MIN_SPEED = 42;
export const SMEAR_FULL_SPEED = 110;

export const limbSmears = (rt: Runtime, id: string, frame: number, joints: Joints): Partial<Record<"F" | "B", LimbSmear>> => {
  const f = frameOf(rt, frame);
  if (f < 2) return {};
  const loco = rt.bakes.get(id)!.frames;
  if (Math.sign(loco[f].facing) !== Math.sign(loco[f - 1].facing) || Math.abs(loco[f].facing) < 1) return {};
  const tr = secondaryFor(rt, id).trail;
  const at = (k: TrailJoint, t: number) => {
    const i = Math.floor(t);
    const u = t - i;
    const a = v(tr[k][i * 2], tr[k][i * 2 + 1]);
    if (u === 0) return a; // exact sample (also avoids reading past the last frame)
    const b = v(tr[k][(i + 1) * 2], tr[k][(i + 1) * 2 + 1]);
    return vlerp(a, b, u);
  };
  const out: Partial<Record<"F" | "B", LimbSmear>> = {};
  for (const side of ["F", "B"] as const) {
    const wk = `wrist${side}` as TrailJoint;
    const ek = `elbow${side}` as TrailJoint;
    const speed = Math.hypot(at(wk, f).x - at(wk, f - 1).x, at(wk, f).y - at(wk, f - 1).y);
    if (speed < SMEAR_MIN_SPEED) continue;
    const k = clamp((speed - SMEAR_MIN_SPEED) / (SMEAR_FULL_SPEED - SMEAR_MIN_SPEED), 0, 1);
    // longer smears for faster arms: up to 1.5 frames back
    const span = lerp(0.8, 1.5, k);
    const n = 5;
    const dW = sub(joints[wk], at(wk, f));
    const dE = sub(joints[ek], at(ek, f));
    const wrists: Vec2[] = [];
    const elbows: Vec2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = f - (span * i) / n;
      wrists.push(add(at(wk, t), dW));
      elbows.push(add(at(ek, t), dE));
    }
    out[side] = { k: 0.35 + 0.65 * k, wrists, elbows };
  }
  return out;
};
