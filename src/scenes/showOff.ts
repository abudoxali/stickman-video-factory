import { BO, PIP } from "../characters";
import type { SceneDef } from "../engine/scene";

/**
 * SHOW-OFF — 20 s, 1080x1920, 30 fps. Park set (tree moved centre-left so the
 * vertical frame stacks the prize above the characters).
 *
 * Beat sheet (frames):
 *   1 The prize      0–80   Insert: a shiny apple high in the tree. Tilt down to Bo,
 *                           gazing up with sparkling eyes.
 *   2 Can't reach   80–228  Three jumps, each bigger (rule of three); the third has a huge
 *                           crouch and misses by a whisker. Bo lands and deflates.
 *   3 Show-off     205–330  Pip strolls in whistling, sizes it up, and warms up with a
 *                           showy arm windmill + knuckle crack (Blender-authored clip
 *                           "warmUp"). Cut to Bo: deadpan to camera.
 *   4 The shot     330–426  Pip picks up the ball, points at the apple, overhand throw;
 *                           the camera tracks the ball up into the impact. The apple pops
 *                           off, the ball rockets out of frame.
 *   5 Gravity      426–448  Pip poses smugly, hands ready... the apple bonks HIS head and
 *                           bounces straight into Bo's hands.
 *   6 Finders keepers 448–505 Close-up: Bo, starry-eyed, takes two crunchy bites.
 *   7 Payoff       505–570  Bo kindly offers the apple; Pip reaches — and the ball he
 *                           launched earlier comes down on his head (whistle, BONK). He
 *                           topples. Bo shrugs and takes another bite.
 *
 * Reuse: Pip/Bo specs, park set, ball prop, clips throw/pickUp/point/catch/reach/
 * dazedSway/handOver/react (BONK!), the Blender clip warmUp (also in MotionLibrary),
 * Kenney CC0 SFX + the procedural studio SFX pack, camera shot keys (auto-framed).
 * Every contact is a ballistic `toRef` onto the live anchor/prop.
 */

const FLOOR = 1500;
const BALL_SCALE = 1.1;
const BALL_R = 30 * BALL_SCALE;
const APPLE_R = 34;
/** The apple hangs from the canopy's lower-right lobe (tree shifted by TREE_X). */
const TREE_X = 360;
const APPLE: [number, number] = [580, 815];

export const showOff: SceneDef = {
  id: "show-off",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 600,
  floorY: FLOOR,
  stage: "park",
  autoDust: true,
  drawOrder: ["set:back", "shadows", "props:back", "char:bo", "char:pip", "props:front", "fx", "set:fore"],
  set: {
    treeX: [{ at: 0, value: TREE_X }],
    treeShake: [
      { at: 0, value: 0 },
      { at: 409, value: 0 },
      { at: 411, value: 1, ease: "outQuad" },
      { at: 450, value: 0, ease: "outCubic" },
    ],
  },
  characters: [
    // ------------------------------------------------------------------- BO
    {
      id: "bo",
      spec: BO,
      x: 500,
      facing: 1,
      moves: [
        { type: "jump", start: 84, height: 100, crouch: 7, land: 10 },
        { type: "jump", start: 126, height: 150, crouch: 8, land: 10 },
        // the big one: long wind-up crouch, highest jump, still a whisker short
        { type: "jump", start: 172, height: 195, crouch: 14, land: 14, depth: 0.34 },
      ],
      actions: [
        // longing sigh + gulp while gazing up at the prize
        { clip: "offset", start: 36, end: 60, in: 10, out: 12, params: { shrug: 9, chest: -0.05, neck: -0.08, head: -0.06 } },
        // pleading hands clasped under the chin
        { clip: "hold", start: 30, end: 76, in: 10, out: 8, params: { target: { char: "bo", part: "chin", offset: [34, 40] }, width: 18 } },
        { clip: "reach", start: 86, end: 112, in: 7, out: 6, params: { side: "F", target: { prop: "apple" }, maxLean: 0 } },
        { clip: "reach", start: 130, end: 160, in: 5, out: 6, params: { side: "F", target: { prop: "apple" }, maxLean: 0, tremble: 4 } },
        { clip: "reach", start: 180, end: 216, in: 6, out: 8, params: { side: "F", target: { prop: "apple" }, maxLean: 0, tremble: 7 } },
        { clip: "catch", start: 432, end: 462, in: 6, out: 8, params: { target: { char: "bo", part: "chest", offset: [46, -24] }, at: 14, width: 64 } },
        { clip: "eat", start: 452, end: 505, in: 8, out: 10, params: { side: "F", bites: [18, 34], reach: 26, drop: 46 } },
        { clip: "handOver", start: 505, end: 540, in: 8, out: 8, params: { to: "pip", side: "F", height: -20 } },
        { clip: "react", start: 531, end: 545, in: 1, out: 6, params: { strength: 0.6 } },
        { clip: "eat", start: 548, end: 576, in: 6, out: 8, params: { side: "F", bites: [12], reach: 26, drop: 46 } },
        { clip: "shrug", start: 576, end: 599, in: 6, out: 4 },
      ],
      expressions: [
        { at: 0, expr: "longing" },
        { at: 84, expr: "determined", blend: 4 },
        { at: 112, expr: "longing", blend: 6 },
        { at: 126, expr: "determined", blend: 4 },
        { at: 160, expr: "annoyed", blend: 6 },
        { at: 172, expr: "determined", blend: 4 },
        { at: 214, expr: "dejected", blend: 8 },
        { at: 238, expr: "annoyed", blend: 8 },
        { at: 300, expr: "deadpan", blend: 3 },
        { at: 320, expr: "annoyed", blend: 6 },
        { at: 392, expr: "surprised", blend: 3 },
        { at: 412, expr: "amazed", blend: 4 },
        { at: 442, expr: "longing", blend: 4 },
        { at: 466, expr: "blissful", blend: 4 },
        { at: 505, expr: "happy", blend: 6 },
        { at: 531, expr: "shocked", blend: 1 },
        { at: 542, expr: "grin", blend: 6 },
        { at: 561, expr: "blissful", blend: 4 },
        { at: 574, expr: "grin", blend: 6 },
      ],
      look: [
        { at: 0, target: { prop: "apple" } },
        { at: 214, target: "down", blend: 8 },
        { at: 236, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 300, target: "camera", blend: 3, noBlink: true },
        { at: 318, target: { char: "pip", part: "head" }, blend: 5 },
        { at: 336, target: { prop: "ball" }, blend: 5 },
        { at: 396, target: { prop: "ball" }, blend: 3, noBlink: true },
        { at: 410, target: { prop: "apple" }, blend: 3, noBlink: true },
        { at: 462, target: { prop: "apple" }, blend: 4 },
        { at: 505, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 542, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 566, target: "camera", blend: 6 },
      ],
    },
    // ------------------------------------------------------------------ PIP
    {
      id: "pip",
      spec: PIP,
      x: 1300,
      facing: -1,
      moves: [
        { type: "walk", start: 205, to: 830 },
        { type: "fall", start: 534, frames: 22 },
      ],
      actions: [
        { clip: "warmUp", start: 262, end: 328, in: 6, out: 8 },
        { clip: "pickUp", start: 334, end: 360, in: 6, out: 6, params: { side: "F", target: { prop: "ball" } } },
        { clip: "point", start: 358, end: 376, in: 4, out: 6, params: { side: "B", target: { prop: "apple" } } },
        {
          clip: "throw",
          start: 374,
          end: 420,
          in: 6,
          out: 10,
          params: { side: "F", target: { prop: "apple" }, release: 20, style: "overhand", power: 1.2 },
        },
        // smug "ready to catch" pose — looking at Bo, not at the apple
        { clip: "catch", start: 414, end: 432, in: 8, out: 4, params: { target: { char: "pip", part: "belly", offset: [70, -10] }, at: 60, width: 80 } },
        { clip: "hit", start: 430, end: 456, in: 1, out: 8, params: { from: "top", strength: 0.9 } },
        { clip: "dazedSway", start: 444, end: 500, in: 6, out: 8 },
        { clip: "reach", start: 514, end: 534, in: 8, out: 2, params: { side: "F", target: { prop: "apple" }, maxLean: 0.2 } },
        { clip: "hit", start: 531, end: 540, in: 1, out: 4, params: { from: "top", strength: 1.2 } },
      ],
      expressions: [
        { at: 0, expr: "whistling" },
        { at: 238, expr: "smug", blend: 8 },
        { at: 334, expr: "determined", blend: 6 },
        { at: 358, expr: "smug", blend: 4 },
        { at: 374, expr: "determined", blend: 4 },
        { at: 398, expr: "excited", blend: 4 },
        { at: 414, expr: "smug", blend: 6 },
        { at: 430, expr: "shocked", blend: 1 },
        { at: 438, expr: "dazed", blend: 4 },
        { at: 476, expr: "dejected", blend: 8 },
        { at: 506, expr: "surprised", blend: 4 },
        { at: 514, expr: "longing", blend: 6 },
        { at: 531, expr: "shocked", blend: 1 },
        { at: 538, expr: "dazed", blend: 3 },
      ],
      look: [
        { at: 0, target: "ahead" },
        { at: 228, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 252, target: { prop: "apple" }, blend: 6 },
        { at: 266, target: "camera", blend: 6 },
        { at: 318, target: { char: "bo", part: "head" }, blend: 5 },
        { at: 334, target: { prop: "ball" }, blend: 5 },
        { at: 358, target: { prop: "apple" }, blend: 4 },
        { at: 414, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 440, target: "camera", blend: 6 },
        { at: 470, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 506, target: { prop: "apple" }, blend: 5 },
        { at: 540, target: "camera", blend: 6 },
      ],
    },
  ],
  props: [
    {
      id: "apple",
      kind: "apple",
      layer: "back",
      layerKeys: [
        { from: 410, layer: "front" },
        { from: 446, layer: "char:bo" },
      ],
      shadow: false,
      smear: 2,
      params: {
        stem: [
          { at: 0, value: 24 },
          { at: 410, value: 24 },
          { at: 411, value: 0, ease: "linear" },
        ],
        swing: [
          { at: 0, value: 0.06 },
          { at: 196, value: 0.06 },
          { at: 204, value: 0.22, ease: "outQuad" },
          { at: 260, value: 0.05, ease: "outCubic" },
          { at: 410, value: 0.05 },
          { at: 411, value: 0, ease: "linear" },
        ],
        glint: [
          { at: 0, value: 0 },
          { at: 10, value: 1, ease: "outBack" },
          { at: 66, value: 1 },
          { at: 84, value: 0.25 },
          { at: 446, value: 0.25 },
          { at: 452, value: 1, ease: "outBack" },
          { at: 468, value: 0 },
        ],
        bites: [
          { at: 0, value: 0 },
          { at: 469, value: 0 },
          { at: 470, value: 1, ease: "linear" },
          { at: 485, value: 1 },
          { at: 486, value: 2, ease: "linear" },
          { at: 559, value: 2 },
          { at: 560, value: 3, ease: "linear" },
        ],
      },
      states: [
        { from: 0, mode: "static", pos: APPLE },
        // knocked off by the ball: arcs over onto Pip's head ...
        {
          from: 410,
          mode: "ballistic",
          to: [800, 1000],
          toRef: { char: "pip", part: "headTop" },
          contact: APPLE_R - 6,
          dur: 20,
          peak: 120,
          spin: 1.5,
        },
        // ... and bounces straight into Bo's hands
        { from: 430, mode: "ballistic", to: [560, 1180], toRef: { char: "bo", part: "hands" }, dur: 16, peak: 130, spin: -2 },
        { from: 446, mode: "attach", char: "bo", part: "hands", offset: [0, -6], blend: 2 },
        // held from below in the eating hand (the near side faces the mouth)
        { from: 458, mode: "attach", char: "bo", part: "handF", offset: [4, -30], blend: 8 },
      ],
    },
    {
      id: "ball",
      kind: "ball",
      layer: "back",
      layerKeys: [
        { from: 346, layer: "char:pip" },
        // cocked behind the head during the overhand wind-up (face stays readable)
        { from: 380, layer: "behind:pip" },
        { from: 394, layer: "front" },
      ],
      scale: BALL_SCALE,
      shadow: true,
      hidden: [[426, 512]],
      states: [
        { from: 0, mode: "static", pos: [700, FLOOR - BALL_R] },
        { from: 346, mode: "attach", char: "pip", part: "handF", offset: [-8, 6], blend: 3 },
        { from: 394, mode: "ballistic", to: APPLE, toRef: { prop: "apple" }, contact: BALL_R + APPLE_R - 8, dur: 16, peak: 60, spin: 4 * Math.PI },
        // rockets straight up out of frame (and is forgotten) ...
        { from: 410, mode: "ballistic", to: [700, -900], dur: 16, peak: 0, spin: 3 * Math.PI },
        // ... until it comes back down on the show-off
        {
          from: 512,
          mode: "ballistic",
          fromPos: [780, 120],
          to: [800, 1000],
          toRef: { char: "pip", part: "headTop" },
          contact: BALL_R - 4,
          dur: 19,
          peak: 220,
          spin: 2,
        },
        // ... and bounces away over his head, rolling out of frame (never resting on his body)
        { from: 531, mode: "ballistic", to: [1470, FLOOR - BALL_R], dur: 22, peak: 200, spin: 4, bounces: [[40, 12], [12, 8]], skid: 40 },
      ],
    },
  ],
  camera: {
    keys: [
      // 1 the prize: insert on the apple, then tilt down to reveal Bo
      { at: 0, shot: { on: ["prop:apple"], size: "insert", fill: 0.16, sy: 0.6 } },
      { at: 32, shot: { on: ["prop:apple"], size: "insert", fill: 0.17, sy: 0.6 }, ease: "inOutSine" },
      // cut: who wants it — Bo gazing up, sparkling eyes; then pull back for the jumps
      { at: 33, shot: { on: ["bo"], size: "close", sy: 0.56, solveAt: 40 }, cut: true },
      { at: 63, shot: { on: ["bo"], size: "close", fill: 0.45, sy: 0.56, solveAt: 40 }, ease: "linear" },
      // cut wide: the geography of the problem (Bo below, apple above)
      { at: 64, shot: { on: ["bo", "prop:apple"], size: "full", sy: 0.55, solveAt: 84 }, cut: true },
      { at: 84, shot: { on: ["bo", "prop:apple"], size: "full", sy: 0.55 }, ease: "inOutSine" },
      // 2 jumps: hold, push in on the big crouch, settle back as he lands
      { at: 170, shot: { on: ["bo", "prop:apple"], size: "full", sy: 0.55, solveAt: 82 }, ease: "inOutSine" },
      { at: 190, shot: { on: ["bo", "prop:apple"], size: "full", fill: 0.66, sy: 0.53, solveAt: 82 }, ease: "inOutSine" },
      { at: 216, shot: { on: ["bo", "prop:apple"], size: "full", sy: 0.56, solveAt: 82 }, ease: "outCubic" },
      // 3 the show-off arrives: widen to the two-shot, push to medium for the warm-up
      { at: 252, shot: { on: ["bo", "pip", "prop:apple"], size: "full", solveAt: 252 }, ease: "inOutCubic" },
      { at: 284, shot: { on: ["bo", "pip"], size: "medium", solveAt: 284 }, ease: "inOutSine" },
      { at: 300, shot: { on: ["bo"], size: "close", sx: 0.6, solveAt: 306 }, cut: true },
      { at: 318, shot: { on: ["bo", "pip"], size: "medium", solveAt: 318 }, cut: true },
      // 4 the shot: full two-shot for the pick-up, track the ball up into the impact
      { at: 340, shot: { on: ["bo", "pip"], size: "full", sy: 0.6, solveAt: 346 }, ease: "inOutSine" },
      { at: 388, shot: { on: ["bo", "pip"], size: "full", sy: 0.6, solveAt: 388 }, ease: "inOutSine" },
      { at: 400, shot: { on: ["bo", "pip", "prop:ball"], size: "full", sy: 0.58, solveAt: 398 }, ease: "outCubic" },
      // cut to the insert as the ball flies in; slow push through the impact
      { at: 401, shot: { on: ["prop:apple"], size: "insert", fill: 0.16, sy: 0.64, solveAt: 401 }, cut: true },
      { at: 415, shot: { on: ["prop:apple"], size: "insert", fill: 0.19, sy: 0.62, solveAt: 401 }, ease: "linear" },
      // 5 gravity: cut back to the two-shot, headroom for the apple's arc onto Pip and into Bo's hands
      { at: 416, shot: { on: ["bo", "pip"], size: "full", sy: 0.62, solveAt: 430 }, cut: true },
      { at: 446, shot: { on: ["bo", "pip"], size: "full", sy: 0.6, solveAt: 446 }, ease: "inOutSine" },
      // 6 finders keepers: close-up
      { at: 450, shot: { on: ["bo"], size: "close", fill: 0.46, sx: 0.62, solveAt: 470 }, cut: true },
      { at: 504, shot: { on: ["bo"], size: "close", fill: 0.5, sx: 0.62, solveAt: 486 }, ease: "inOutSine" },
      // 7 payoff: two-shot with headroom for the falling ball, then push in on Bo
      { at: 506, shot: { on: ["bo", "pip"], size: "full", sy: 0.62, solveAt: 520 }, cut: true },
      { at: 532, shot: { on: ["bo", "pip"], size: "full", sy: 0.62, solveAt: 520 }, ease: "linear" },
      // follow the show-off's topple (Bo leaves frame by the pan). The intermediate
      // fall pose is wider than either endpoint, so explicitly frame its maximum extent.
      { at: 548, shot: { on: ["pip"], size: "full", fill: 0.47, sx: 0.48, sy: 0.6, solveAt: 548 }, ease: "outCubic" },
      { at: 562, shot: { on: ["pip"], size: "full", sx: 0.5, sy: 0.6, solveAt: 560 }, ease: "inOutSine" },
      { at: 571, shot: { on: ["pip"], size: "full", sx: 0.5, sy: 0.6, solveAt: 560 }, ease: "linear" },
      // final beat (Bo's crunch was heard off-screen): cut to Bo, munching, shrugging to camera; slow push
      { at: 572, shot: { on: ["bo"], size: "full", fill: 0.6, sy: 0.54, solveAt: 580 }, cut: true },
      { at: 599, shot: { on: ["bo"], size: "full", fill: 0.68, sy: 0.53, solveAt: 580 }, ease: "inOutSine" },
    ],
    shakes: [
      { at: 410, amp: 7, dur: 8 },
      { at: 430, amp: 12, dur: 10 },
      { at: 531, amp: 20, dur: 14 },
      { at: 556, amp: 6, dur: 8 },
    ],
  },
  fx: [
    { at: 410, kind: "impactLines", x: 0, y: 0, dur: 9, scale: 0.5, follow: { point: APPLE } },
    { at: 410, kind: "leaves", x: TREE_X - 30, y: 720, dur: 64, scale: 1.0 },
    { at: 430, kind: "impactLines", x: 0, y: 0, dur: 10, scale: 0.65, follow: { char: "pip", part: "headTop" } },
    { at: 432, kind: "stars", x: 0, y: 0, dur: 64, follow: { char: "pip", part: "headTop", offset: [0, -20] } },
    { at: 470, kind: "puff", x: 0, y: 0, dur: 10, scale: 0.25, follow: { char: "bo", part: "mouth", offset: [30, 0] } },
    { at: 486, kind: "puff", x: 0, y: 0, dur: 10, scale: 0.25, follow: { char: "bo", part: "mouth", offset: [30, 0] } },
    { at: 531, kind: "impactLines", x: 0, y: 0, dur: 12, scale: 0.8, follow: { char: "pip", part: "headTop" } },
    { at: 534, kind: "stars", x: 0, y: 0, dur: 60, follow: { char: "pip", part: "headTop", offset: [0, -20] } },
  ],
  audio: {
    footsteps: { sfx: "impact/footstep_grass", volume: 0.45 },
    // Bo's three jump landings are automatic. Pip's late fall uses a shorter
    // authored thud so it clears before the off-screen crunch at f560.
    landings: { sfx: "impact/impactSoft_heavy", volume: 0.85, chars: ["bo"] },
    cues: [
      { at: 10, sfx: "ui/confirmation", volume: 0.3, variant: 0, rate: 1.25, label: "glint" },
      { at: 52, sfx: "studio/gulp", volume: 0.35, rate: 1.15, label: "longing gulp" },
      { at: 91, sfx: "studio/slideUp", volume: 0.22, label: "jump 1" },
      { at: 134, sfx: "studio/slideUp", volume: 0.26, rate: 1.1, label: "jump 2" },
      { at: 186, sfx: "studio/slideUp", volume: 0.3, rate: 0.8, label: "jump 3" },
      { at: 222, sfx: "studio/slideDown", volume: 0.24, rate: 1.5, label: "deflate" },
      { at: 274, sfx: "studio/whoosh", volume: 0.35, variant: 0, label: "windmill" },
      { at: 281, sfx: "studio/whoosh", volume: 0.4, variant: 1, label: "windmill" },
      { at: 288, sfx: "studio/whoosh", volume: 0.45, variant: 1, rate: 1.15, label: "windmill" },
      { at: 297, sfx: "studio/whoosh", volume: 0.45, variant: 0, rate: 1.25, label: "windmill" },
      { at: 315, sfx: "ui/click", volume: 0.8, rate: 0.7, label: "knuckle crack" },
      { at: 315, sfx: "impact/impactWood_light", volume: 0.5, rate: 1.6, label: "crack body" },
      { at: 346, sfx: "ui/click", volume: 0.45, label: "grab" },
      { at: 393, sfx: "studio/whoosh", volume: 0.7, variant: 2, rate: 1.3, label: "throw" },
      { at: 410, sfx: "impact/impactSoft_medium", volume: 0.9, label: "ball hits apple" },
      { at: 410, sfx: "studio/pop", volume: 0.7, label: "apple pops off" },
      { at: 414, sfx: "studio/whoosh", volume: 0.45, variant: 1, rate: 1.6, label: "ball rockets up" },
      { at: 430, sfx: "impact/impactPunch_medium", volume: 0.64, label: "apple bonk" },
      { at: 430, sfx: "studio/boing", volume: 0.39, label: "boing" },
      { at: 446, sfx: "impact/impactSoft_heavy", volume: 0.6, label: "catch" },
      { at: 470, sfx: "studio/crunch", volume: 0.95, variant: 0, label: "bite 1" },
      { at: 486, sfx: "studio/crunch", volume: 0.95, variant: 1, label: "bite 2" },
      { at: 500, sfx: "studio/gulp", volume: 0.45, label: "gulp" },
      { at: 509, sfx: "studio/slideDown", volume: 0.32, rate: 0.9, label: "falling whistle" },
      { at: 531, sfx: "impact/impactPunch_heavy", volume: 1, label: "bonk" },
      { at: 531, sfx: "ui/bong", volume: 0.75, label: "bonk ring" },
      { at: 555, sfx: "impact/impactSoft_medium", volume: 0.35, variant: 2, label: "ground thud" },
      { at: 560, sfx: "studio/crunch", volume: 0.95, variant: 2, label: "bite 3" },
      { at: 572, sfx: "studio/gulp", volume: 0.4, label: "gulp 2" },
    ],
  },
};
