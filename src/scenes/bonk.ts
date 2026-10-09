import { BO, PIP } from "../characters";
import type { SceneDef } from "../engine/scene";

/**
 * BONK! — 19 s, 1080x1920, 30 fps. Park set, two characters, synced SFX.
 *
 * Beat sheet (frames):
 *   1 Hello        0–80    Park wide. Bo waits with a ball; Pip strolls in and waves.
 *   2 Catch       76–145   Bo lobs underhand (wind-up, release f96); Pip catches it and the
 *                          hands absorb the hit (f116). Pip is proud of himself.
 *   3 Too hard   146–222   Pip winds up a huge overhand throw (camera pushes in on the
 *                          anticipation) and releases f180 — way over Bo's head. Bo spins
 *                          round to watch; the ball smacks the tree (f212), ricochets and
 *                          BONKS Bo on the head (f220). Stars.
 *   4 Down       222–340   Bo wobbles and topples backwards towards Pip, who hops back and
 *                          doubles up laughing, pointing. The ball rolls to the tree.
 *   5 Payback    340–500   Bo gets up rubbing his head, glares... spots the ball: sneaky
 *                          idea. Picks it up, turns, lobs it high — boing, right off the
 *                          laughing Pip's head (f486) — and Pip fumbles a catch (f504).
 *   6 Even       500–570   They look at each other and both burst out laughing.
 *
 * Every ball contact uses ballistic `toRef` (land on the hand/head as it is at
 * the contact frame), so re-timing a character never breaks a catch or a hit.
 */

const FLOOR = 1500;
const BALL_R = 39; // ball radius at scale 1.3
const REST_Y = FLOOR - BALL_R;
const TREE_HIT: [number, number] = [32 + BALL_R, 1050]; // right face of the trunk (PARK.trunk.x1)

export const bonk: SceneDef = {
  id: "bonk",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 570,
  floorY: FLOOR,
  stage: "park",
  autoDust: true,
  drawOrder: ["set:back", "shadows", "props:back", "char:bo", "char:pip", "props:front", "fx", "set:fore"],
  set: {
    treeShake: [
      { at: 0, value: 0 },
      { at: 211, value: 0 },
      { at: 213, value: 1, ease: "outQuad" },
      { at: 252, value: 0, ease: "outCubic" },
    ],
  },
  characters: [
    // ------------------------------------------------------------------- BO
    {
      id: "bo",
      spec: BO,
      x: 330,
      facing: 1,
      moves: [
        { type: "turn", start: 183, to: -1, frames: 8 },
        { type: "fall", start: 250, frames: 22 },
        { type: "getUp", start: 312, frames: 28 },
        // faces Pip to glare while rubbing the bump, then turns back to the ball
        { type: "turn", start: 341, to: 1, frames: 8 },
        { type: "turn", start: 373, to: -1, frames: 8 },
        // two steps in towards the ball (it rests by the tree)
        { type: "step", start: 382, foot: "F", to: 262, frames: 9, lift: 16 },
        { type: "step", start: 392, foot: "B", to: 290, frames: 9, lift: 14 },
        { type: "turn", start: 432, to: 1, frames: 8 },
      ],
      actions: [
        { clip: "nod", start: 20, end: 60, in: 8, out: 8 },
        {
          clip: "throw",
          start: 76,
          end: 118,
          in: 8,
          out: 10,
          params: { side: "F", target: { char: "pip", part: "chest" }, release: 20, style: "underhand", power: 0.9 },
        },
        { clip: "offset", start: 192, end: 216, in: 8, out: 4, params: { lean: -0.12, chest: -0.08, neck: -0.12 } },
        { clip: "react", start: 220, end: 234, in: 1, out: 8, params: { strength: 1.3 } },
        { clip: "dazedSway", start: 226, end: 262, in: 4, out: 6 },
        { clip: "rubHead", start: 344, end: 366, in: 8, out: 8, params: { side: "B" } },
        { clip: "pickUp", start: 400, end: 428, in: 6, out: 6, params: { side: "F", target: { prop: "ball" } } },
        {
          clip: "throw",
          start: 442,
          end: 482,
          in: 6,
          out: 10,
          params: { side: "F", target: { char: "pip", part: "head" }, release: 16, style: "underhand", power: 1.1 },
        },
        { clip: "laugh", start: 514, end: 569, in: 8, out: 4 },
      ],
      expressions: [
        { at: 0, expr: "grin" },
        { at: 66, expr: "excited", blend: 6 },
        { at: 120, expr: "happy", blend: 8 },
        { at: 176, expr: "surprised", blend: 3 },
        { at: 196, expr: "worried", blend: 6 },
        { at: 220, expr: "shocked", blend: 1 },
        { at: 228, expr: "dazed", blend: 4 },
        { at: 342, expr: "annoyed", blend: 8 },
        { at: 376, expr: "sneaky", blend: 8 },
        { at: 488, expr: "grin", blend: 6 },
        { at: 512, expr: "laughing", blend: 6 },
      ],
      look: [
        { at: 0, target: "ahead" },
        { at: 14, target: { char: "pip", part: "head" }, blend: 8 },
        { at: 92, target: { prop: "ball" }, blend: 4, noBlink: true },
        { at: 120, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 178, target: { prop: "ball" }, blend: 3, noBlink: true },
        { at: 228, target: "camera", blend: 6, noBlink: true },
        { at: 344, target: { char: "pip", part: "head" }, blend: 8 },
        { at: 366, target: { prop: "ball" }, blend: 5 },
        { at: 436, target: { char: "pip", part: "head" }, blend: 5 },
        { at: 460, target: { prop: "ball" }, blend: 4, noBlink: true },
        { at: 506, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 552, target: "camera", blend: 8 },
      ],
    },
    // ------------------------------------------------------------------ PIP
    {
      id: "pip",
      spec: PIP,
      x: 1260,
      facing: -1,
      moves: [
        { type: "walk", start: 6, to: 790 },
        { type: "step", start: 256, foot: "B", to: 900, frames: 8, lift: 22 },
        { type: "step", start: 264, foot: "F", to: 856, frames: 8, lift: 16 },
      ],
      actions: [
        { clip: "wave", start: 58, end: 84, in: 8, out: 8, params: { side: "F" } },
        { clip: "catch", start: 94, end: 140, in: 8, out: 12, params: { target: { point: [726, 1236] }, at: 22, width: 70 } },
        {
          clip: "throw",
          start: 148,
          end: 206,
          in: 10,
          out: 12,
          params: { side: "F", target: { point: [300, 640] }, release: 32, style: "overhand", power: 1.3 },
        },
        { clip: "react", start: 252, end: 262, in: 2, out: 6, params: { strength: 0.7 } },
        { clip: "laugh", start: 230, end: 336, in: 8, out: 10 },
        { clip: "point", start: 276, end: 304, in: 6, out: 10, params: { side: "F", target: { char: "bo", part: "head" } } },
        { clip: "laugh", start: 362, end: 485, in: 10, out: 3 },
        { clip: "react", start: 486, end: 496, in: 1, out: 6, params: { strength: 0.9 } },
        { clip: "catch", start: 492, end: 524, in: 4, out: 10, params: { target: { point: [796, 1236] }, at: 12, width: 70 } },
        { clip: "laugh", start: 522, end: 569, in: 8, out: 4 },
      ],
      expressions: [
        { at: 0, expr: "whistling" },
        { at: 50, expr: "happy", blend: 6 },
        { at: 112, expr: "surprised", blend: 3 },
        { at: 122, expr: "grin", blend: 8 },
        { at: 146, expr: "sneaky", blend: 8 },
        { at: 168, expr: "excited", blend: 4 },
        { at: 196, expr: "worried", blend: 6 },
        { at: 221, expr: "shocked", blend: 2 },
        { at: 232, expr: "laughing", blend: 6 },
        { at: 252, expr: "surprised", blend: 2 },
        { at: 270, expr: "laughing", blend: 6 },
        { at: 338, expr: "grin", blend: 8 },
        { at: 364, expr: "laughing", blend: 6 },
        { at: 486, expr: "shocked", blend: 1 },
        { at: 506, expr: "surprised", blend: 6 },
        { at: 520, expr: "laughing", blend: 6 },
      ],
      look: [
        { at: 0, target: "ahead" },
        { at: 40, target: { char: "bo", part: "head" }, blend: 8 },
        { at: 94, target: { prop: "ball" }, blend: 4, noBlink: true },
        { at: 126, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 180, target: { prop: "ball" }, blend: 3, noBlink: true },
        { at: 224, target: { char: "bo", part: "head" }, blend: 4 },
        { at: 340, target: "camera", blend: 8 },
        { at: 352, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 486, target: { prop: "ball" }, blend: 2, noBlink: true },
        { at: 508, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 552, target: "camera", blend: 8 },
      ],
    },
  ],
  props: [
    {
      id: "ball",
      kind: "ball",
      layer: "char:bo",
      layerKeys: [
        { from: 112, layer: "char:pip" },
        { from: 182, layer: "front" },
        { from: 414, layer: "char:bo" },
        { from: 460, layer: "front" },
      ],
      scale: 1.3,
      shadow: true,
      states: [
        { from: 0, mode: "attach", char: "bo", part: "handF", offset: [10, 6] },
        { from: 96, mode: "ballistic", to: [726, 1236], toRef: { char: "pip", part: "hands" }, dur: 20, peak: 150, spin: -2 * Math.PI },
        { from: 116, mode: "attach", char: "pip", part: "hands", offset: [0, 0], blend: 2 },
        // the throwing hand takes the ball as the wind-up starts
        { from: 150, mode: "attach", char: "pip", part: "handF", offset: [-10, 6], blend: 6 },
        { from: 180, mode: "ballistic", to: TREE_HIT, dur: 32, peak: 260, spin: 6 * Math.PI },
        {
          from: 212,
          mode: "ballistic",
          to: [300, 1100],
          toRef: { char: "bo", part: "head" },
          contact: 71 + BALL_R - 6,
          dur: 8,
          peak: 22,
          spin: -1.5,
        },
        {
          from: 220,
          mode: "ballistic",
          to: [180, REST_Y],
          dur: 24,
          peak: 220,
          spin: -3 * Math.PI,
          bounces: [
            [44, 13],
            [14, 8],
          ],
          skid: 8,
        },
        { from: 414, mode: "attach", char: "bo", part: "handF", offset: [10, 6], blend: 3 },
        {
          from: 458,
          mode: "ballistic",
          to: [800, 980],
          // lands on top of the head (steep end of a high lob)
          toRef: { char: "pip", part: "headTop", offset: [0, -BALL_R + 8] },
          dur: 28,
          peak: 230,
          spin: 3 * Math.PI,
        },
        { from: 486, mode: "ballistic", to: [796, 1236], toRef: { char: "pip", part: "hands" }, dur: 18, peak: 120, spin: -Math.PI },
        { from: 504, mode: "attach", char: "pip", part: "hands", offset: [0, 0], blend: 2 },
      ],
    },
  ],
  camera: {
    keys: [
      { at: 0, x: 540, y: 1030, zoom: 1.02 },
      { at: 60, x: 560, y: 1050, zoom: 1.1, ease: "inOutSine" },
      { at: 100, x: 600, y: 1070, zoom: 1.18, ease: "inOutSine" },
      { at: 146, x: 640, y: 1060, zoom: 1.2, ease: "inOutSine" },
      { at: 176, x: 760, y: 1030, zoom: 1.6, ease: "inOutCubic" },
      { at: 194, x: 440, y: 1060, zoom: 1.06, ease: "outCubic" },
      { at: 218, x: 400, y: 1060, zoom: 1.1, ease: "inOutSine" },
      { at: 232, x: 340, y: 1040, zoom: 1.42, ease: "outCubic" },
      { at: 248, x: 350, y: 1050, zoom: 1.4, ease: "linear" },
      { at: 272, x: 560, y: 1110, zoom: 1.04, ease: "inOutCubic" },
      { at: 282, x: 580, y: 1110, zoom: 1.06, ease: "inOutSine" },
      { at: 330, x: 590, y: 1110, zoom: 1.1, ease: "linear" },
      { at: 352, x: 350, y: 1080, zoom: 1.42, ease: "inOutCubic" },
      { at: 382, x: 320, y: 1060, zoom: 1.56, ease: "inOutSine" },
      { at: 428, x: 380, y: 1100, zoom: 1.3, ease: "inOutCubic" },
      { at: 454, x: 560, y: 1080, zoom: 1.08, ease: "inOutCubic" },
      { at: 498, x: 600, y: 1070, zoom: 1.14, ease: "inOutSine" },
      { at: 528, x: 580, y: 1060, zoom: 1.14, ease: "inOutSine" },
      { at: 569, x: 570, y: 1050, zoom: 1.2, ease: "inOutSine" },
    ],
    shakes: [
      { at: 212, amp: 8, dur: 8 },
      { at: 220, amp: 20, dur: 14 },
      { at: 272, amp: 10, dur: 10 },
      { at: 486, amp: 9, dur: 9 },
    ],
  },
  fx: [
    { at: 212, kind: "leaves", x: -10, y: 640, dur: 64, scale: 1.1 },
    { at: 212, kind: "impactLines", x: TREE_HIT[0] - 30, y: TREE_HIT[1], dur: 9, scale: 0.55 },
    { at: 220, kind: "impactLines", x: 0, y: 0, dur: 12, scale: 0.8, follow: { char: "bo", part: "head" } },
    { at: 222, kind: "stars", x: 0, y: 0, dur: 100, follow: { char: "bo", part: "headTop", offset: [0, -20] } },
    { at: 486, kind: "impactLines", x: 0, y: 0, dur: 9, scale: 0.6, follow: { char: "pip", part: "headTop" } },
  ],
  audio: {
    footsteps: { sfx: "impact/footstep_grass", volume: 0.5 },
    landings: { sfx: "impact/impactSoft_heavy", volume: 0.9 },
    cues: [
      { at: 96, sfx: "ui/pluck", volume: 0.6, label: "toss" },
      { at: 116, sfx: "impact/impactSoft_heavy", volume: 0.8, label: "catch" },
      { at: 180, sfx: "ui/pluck", volume: 0.8, rate: 0.8, label: "big throw" },
      { at: 212, sfx: "impact/impactWood_heavy", volume: 1, label: "tree" },
      { at: 220, sfx: "impact/impactPunch_heavy", volume: 1, label: "bonk" },
      { at: 220, sfx: "ui/bong", volume: 0.7, label: "bonk ring" },
      { at: 244, sfx: "impact/impactSoft_medium", volume: 0.55, label: "bounce" },
      { at: 257, sfx: "impact/impactSoft_medium", volume: 0.35, label: "bounce" },
      { at: 265, sfx: "impact/impactSoft_medium", volume: 0.2, label: "bounce" },
      { at: 256, sfx: "impact/footstep_grass", volume: 0.4, label: "hop back" },
      { at: 414, sfx: "ui/click", volume: 0.5, label: "grab" },
      { at: 458, sfx: "ui/pluck", volume: 0.55, label: "toss" },
      { at: 486, sfx: "ui/bong", volume: 0.85, label: "boing" },
      { at: 486, sfx: "impact/impactSoft_medium", volume: 0.7, label: "boing hit" },
      { at: 504, sfx: "impact/impactSoft_medium", volume: 0.6, label: "catch" },
    ],
  },
};
