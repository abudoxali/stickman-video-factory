// A/B benchmark of arm-layer blending: angle-space lerp vs hand-space (polar)
// blending. Measures, inside every action blend-in/blend-out window, how far
// the wrist actually travels compared with the straight chord between the
// window's start and end positions (detour ratio, 1.0 = straight line) and the
// peak wrist speed. Also times full-scene engine evaluation.
//
// Usage: npx tsx scripts/bench-motion.ts [sceneId ...]
// Writes out/bench/arm-blend.json.
import fs from "node:fs";
import { dist, type Vec2 } from "../src/engine/math";
import { ENGINE_OPTIONS, evaluateScene } from "../src/engine/runtime";
import type { SceneDef } from "../src/engine/scene";
import { SCENES } from "../src/scenes";

type Mode = "angle" | "hand";
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);

const measure = (base: SceneDef, mode: Mode) => {
  ENGINE_OPTIONS.armBlend = mode;
  // fresh object => fresh runtime cache (caches are keyed by SceneDef identity)
  const def: SceneDef = { ...base };
  const t0 = performance.now();
  const wrists: Record<string, { F: Vec2; B: Vec2 }[]> = {};
  for (const c of def.characters) wrists[c.id] = [];
  for (let f = 0; f < def.durationInFrames; f++) {
    const sf = evaluateScene(def, f);
    for (const c of def.characters) {
      const j = sf.characters[c.id].joints;
      wrists[c.id].push({ F: j.wristF, B: j.wristB });
    }
  }
  const ms = performance.now() - t0;
  let path = 0;
  let chord = 0;
  let peak = 0;
  let windows = 0;
  let worst = { ratio: 0, where: "" };
  for (const c of def.characters) {
    for (const a of c.actions) {
      const spans: [number, number][] = [
        [a.start, a.start + (a.in ?? 6)],
        [a.end, a.end + (a.out ?? 8)],
      ];
      for (const [s0, s1] of spans) {
        if (s1 >= def.durationInFrames || s1 - s0 < 2) continue;
        for (const side of ["F", "B"] as const) {
          let p = 0;
          for (let f = s0 + 1; f <= s1; f++) {
            const d = dist(wrists[c.id][f][side], wrists[c.id][f - 1][side]);
            p += d;
            peak = Math.max(peak, d);
          }
          const ch = dist(wrists[c.id][s1][side], wrists[c.id][s0][side]);
          if (ch < 25) continue; // arm barely moves: ratio meaningless
          windows++;
          path += p;
          chord += ch;
          const ratio = p / ch;
          if (ratio > worst.ratio) worst = { ratio, where: `${c.id}.${a.clip}@${s0}-${s1}.${side}` };
        }
      }
    }
  }
  return { mode, windows, detourRatio: path / Math.max(1, chord), worst, peakWristSpeed: peak, evalMsPerFrame: ms / def.durationInFrames };
};

const out: Record<string, unknown> = {};
for (const id of ids) {
  const def = SCENES[id];
  if (!def) throw new Error(`unknown scene ${id}`);
  const a = measure(def, "angle");
  const h = measure(def, "hand");
  out[id] = { angle: a, hand: h };
  console.log(`${id}`);
  for (const r of [a, h]) {
    console.log(
      `  ${r.mode.padEnd(5)} windows=${r.windows} detour=${r.detourRatio.toFixed(3)} worst=${r.worst.ratio.toFixed(2)} (${r.worst.where}) peakWrist=${r.peakWristSpeed.toFixed(0)}px/f eval=${r.evalMsPerFrame.toFixed(2)}ms/f`,
    );
  }
}
ENGINE_OPTIONS.armBlend = "hand";
fs.mkdirSync("out/bench", { recursive: true });
fs.writeFileSync("out/bench/arm-blend.json", JSON.stringify(out, null, 2));
