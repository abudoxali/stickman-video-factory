import { BO, PIP } from "../characters";
import type { SceneDef } from "../engine/scene";

/**
 * FACTORY EXAMPLE — a complete independent story assembled only from reusable
 * characters, clips, park art, ball physics, camera shots, FX and licensed SFX.
 * It intentionally contains no engine-specific code.
 */
export const factoryExample: SceneDef = {
  id: "factory-example",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 180,
  floorY: 1500,
  stage: "park",
  autoDust: true,
  drawOrder: ["set:back", "shadows", "props:back", "char:pip", "char:bo", "props:front", "fx", "set:fore"],
  set: { treeX: [{ at: 0, value: -180 }] },
  characters: [
    {
      id: "pip",
      spec: PIP,
      x: 350,
      facing: 1,
      moves: [],
      actions: [
        { clip: "wave", start: 4, end: 38, in: 6, out: 6, params: { side: "B" } },
        { clip: "throw", start: 38, end: 82, in: 6, out: 10, params: { side: "F", target: { char: "bo", part: "hands" }, release: 12, style: "underhand", power: 0.7 } },
      ],
      expressions: [{ at: 0, expr: "happy" }],
      look: [{ at: 0, target: { char: "bo", part: "head" } }],
    },
    {
      id: "bo",
      spec: BO,
      x: 730,
      facing: -1,
      moves: [],
      actions: [
        { clip: "catch", start: 46, end: 90, in: 6, out: 10, params: { target: { char: "bo", part: "hands" }, at: 22, width: 64 } },
        { clip: "celebrate", start: 96, end: 164, in: 8, out: 10 },
      ],
      expressions: [
        { at: 0, expr: "neutral" },
        { at: 68, expr: "surprised", blend: 3 },
        { at: 98, expr: "happy", blend: 6 },
      ],
      look: [
        { at: 0, target: { char: "pip", part: "head" } },
        { at: 46, target: { prop: "ball" }, blend: 4 },
      ],
    },
  ],
  props: [
    {
      id: "ball",
      kind: "ball",
      layer: "front",
      shadow: true,
      smear: 2,
      states: [
        { from: 0, mode: "attach", char: "pip", part: "handF", offset: [0, -6] },
        { from: 50, mode: "ballistic", to: [730, 1180], toRef: { char: "bo", part: "hands" }, dur: 18, peak: 105, spin: 5 },
        { from: 68, mode: "attach", char: "bo", part: "hands", blend: 2 },
      ],
    },
  ],
  camera: {
    keys: [
      { at: 0, shot: { on: ["pip", "bo"], size: "full", sy: 0.6 } },
      { at: 90, shot: { on: ["bo"], size: "medium", solveAt: 112 }, cut: true },
      { at: 179, shot: { on: ["bo"], size: "medium", fill: 0.64, solveAt: 140 }, ease: "inOutSine" },
    ],
    shakes: [{ at: 68, amp: 4, dur: 6 }],
  },
  fx: [{ at: 68, kind: "puff", x: 0, y: 0, dur: 10, scale: 0.25, follow: { prop: "ball" } }],
  audio: {
    cues: [
      { at: 50, sfx: "studio/whoosh", volume: 0.45, label: "throw" },
      { at: 68, sfx: "impact/impactSoft_medium", volume: 0.55, label: "catch" },
    ],
  },
};
