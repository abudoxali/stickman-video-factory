import { BO, PIP } from "../characters";
import type { SceneDef } from "../engine/scene";

/**
 * THE SURPRISE — 24 s, 1080x1920, 30 fps.
 *
 * Beat sheet (frames):
 *   1 Entrance      0–100   Pip walks in whistling, admiring the bunting.
 *   2 Discovery   100–235   Double take on the gift, think, tiptoe to the desk. Camera pushes in.
 *   3 Interaction 235–300   Hesitant reach, lifts the lid a crack: warm glow. Close-up.
 *   4 Surprise    300–345   Door bursts open, Bo leaps in with a party horn. Pip leaps in fright,
 *                           the lid flies, a flailing hand swats the box. Whip-out to a two-shot.
 *   5 Comedy      312–470   Box flips through the air and lands upside-down on Bo's head.
 *                           Bo staggers blind; Pip covers a giggle. Bo pulls the box off.
 *   6 Ending      456–720   A cupcake (candle still lit) sits on Bo's head. Pip laughs, picks up the
 *                           dropped horn, blows the candle out and hands Bo the horn. Toot, confetti,
 *                           both celebrate; final push-in and a grin to camera.
 *
 * Every number here is authorable data (JSON-compatible); the engine does the motion.
 */

const FLOOR = 1500;
const BOX: [number, number] = [850, 1222];
const BOX_H = 120;

export const theSurprise: SceneDef = {
  id: "the-surprise",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 720,
  floorY: FLOOR,
  stage: "room",
  autoDust: true,
  drawOrder: ["set:back", "set:doorway", "shadows", "char:bo", "set:door", "props:back", "char:pip", "props:front", "fx", "set:fore"],
  set: {
    door: [
      { at: 0, value: 0 },
      { at: 299, value: 0 },
      { at: 304, value: 1.12, ease: "outQuad" },
      { at: 311, value: 0.93, ease: "inOutSine" },
      { at: 317, value: 1.0, ease: "inOutSine" },
    ],
    lamp: [
      { at: 0, value: 0.6 },
      { at: 720, value: 0.6 },
    ],
  },
  characters: [
    // ------------------------------------------------------------------ PIP
    {
      id: "pip",
      spec: PIP,
      x: -90,
      facing: 1,
      moves: [
        { type: "walk", start: 4, to: 470 },
        { type: "walk", start: 172, to: 640, style: "tiptoe", stepFrames: 16 },
        { type: "jump", start: 304, to: 640, height: 150, crouch: 4, turn: true, depth: 0.2, land: 14 },
        { type: "turn", start: 558, to: 1, frames: 8 },
        { type: "turn", start: 594, to: -1, frames: 8 },
      ],
      actions: [
        { clip: "nod", start: 10, end: 88, in: 10, out: 10 },
        { clip: "react", start: 94, end: 112, in: 2, out: 10, params: { strength: 0.55 } },
        { clip: "think", start: 118, end: 166, in: 10, out: 10 },
        { clip: "reach", start: 236, end: 262, in: 14, out: 10, params: { side: "F", target: { point: [772, 1104] }, tremble: 2, maxLean: 0.15 } },
        { clip: "reach", start: 262, end: 302, in: 10, out: 6, params: { side: "F", target: { point: [784, 1072] }, grip: 1, maxLean: 0.06 } },
        { clip: "offset", start: 268, end: 302, in: 30, out: 3, params: { lean: 0.07, neck: 0.06, head: -0.05, shrug: 4 } },
        { clip: "flail", start: 304, end: 330, in: 5, out: 8 },
        { clip: "coverMouth", start: 348, end: 444, in: 6, out: 8, params: { giggle: 1 } },
        { clip: "laugh", start: 440, end: 545, in: 10, out: 12 },
        { clip: "pickUp", start: 565, end: 594, in: 6, out: 6, params: { side: "F", target: { prop: "horn" } } },
        { clip: "blow", start: 603, end: 636, in: 6, out: 8, params: { target: { prop: "cupcake", offset: [0, -150] }, inhale: 0.36 } },
        { clip: "handOver", start: 640, end: 664, in: 8, out: 10, params: { to: "bo", side: "F", height: -10 } },
        { clip: "celebrate", start: 670, end: 712, in: 9, out: 8 },
      ],
      expressions: [
        { at: 0, expr: "whistling" },
        { at: 93, expr: "surprised", blend: 3 },
        { at: 112, expr: "curious", blend: 8 },
        { at: 124, expr: "thinking", blend: 8 },
        { at: 166, expr: "sneaky", blend: 8 },
        { at: 238, expr: "curious", blend: 8 },
        { at: 276, expr: "amazed", blend: 8 },
        { at: 303, expr: "shocked", blend: 2 },
        { at: 334, expr: "worried", blend: 6 },
        { at: 372, expr: "grin", blend: 10, amount: 0.8 },
        { at: 450, expr: "laughing", blend: 6 },
        { at: 548, expr: "happy", blend: 8 },
        { at: 603, expr: "blowing", blend: 4 },
        { at: 636, expr: "happy", blend: 6 },
        { at: 668, expr: "excited", blend: 6 },
        { at: 700, expr: "grin", blend: 6 },
      ],
      look: [
        { at: 0, target: "ahead" },
        { at: 30, target: { point: [700, 420] }, blend: 10 },
        { at: 66, target: { prop: "box" }, blend: 6, noBlink: true },
        { at: 74, target: { point: [880, 340] }, blend: 6 },
        { at: 91, target: { prop: "box" }, blend: 3 },
        { at: 124, target: "up", blend: 10 },
        { at: 160, target: { prop: "box" }, blend: 8 },
        { at: 303, target: { char: "bo", part: "head" }, blend: 3 },
        { at: 316, target: { prop: "box" }, blend: 4, noBlink: true },
        { at: 346, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 470, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 552, target: { prop: "horn" }, blend: 6 },
        { at: 597, target: { prop: "cupcake", offset: [0, -140] }, blend: 6 },
        { at: 640, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 698, target: "camera", blend: 8 },
      ],
      renderParams: {
        glow: [
          { at: 0, value: 0 },
          { at: 268, value: 0 },
          { at: 284, value: 0.85 },
          { at: 302, value: 0.85 },
          { at: 306, value: 0, ease: "outQuad" },
        ],
      },
    },
    // ------------------------------------------------------------------- BO
    {
      id: "bo",
      spec: BO,
      x: 210,
      facing: 1,
      hidden: [[0, 299]],
      hideHead: [[343, 444]],
      moves: [
        { type: "jump", start: 300, to: 352, height: 70, crouch: 4, depth: 0.18, land: 12 },
        { type: "walk", start: 352, to: 300, style: "stagger", stepFrames: 11, seed: 3 },
        { type: "walk", start: 392, to: 392, style: "stagger", stepFrames: 11, seed: 8 },
      ],
      actions: [
        { clip: "armsUp", start: 300, end: 322, in: 2, out: 6 },
        { clip: "hornBlow", start: 320, end: 338, in: 4, out: 4 },
        { clip: "duck", start: 334, end: 344, in: 3, out: 4 },
        { clip: "react", start: 342, end: 352, in: 3, out: 6, params: { strength: 1.2 } },
        { clip: "panic", start: 350, end: 392, in: 6, out: 8, params: { rate: 1.0 } },
        { clip: "hold", start: 398, end: 424, in: 8, out: 5, params: { target: { prop: "box", offset: [0, 60] }, width: 158 } },
        {
          clip: "holdPath",
          start: 424,
          end: 470,
          in: 5,
          out: 10,
          params: {
            anchor: "head",
            width: 158,
            path: [
              [0, 0, 2],
              [0.3, 0, -16],
              [0.62, 0, -150],
              [0.85, -120, -130],
              [1, -160, -70],
            ],
          },
        },
        { clip: "dazedSway", start: 456, end: 520, in: 6, out: 12 },
        { clip: "shrug", start: 548, end: 572, in: 6, out: 8 },
        { clip: "handOver", start: 646, end: 664, in: 8, out: 8, params: { to: "pip", side: "F", height: -10 } },
        { clip: "hornBlow", start: 666, end: 700, in: 6, out: 6 },
        { clip: "celebrate", start: 700, end: 719, in: 6, out: 4 },
      ],
      expressions: [
        { at: 0, expr: "grin" },
        { at: 300, expr: "excited", blend: 2 },
        { at: 326, expr: "worried", blend: 4 },
        { at: 338, expr: "shocked", blend: 3 },
        { at: 352, expr: "worried", blend: 8 },
        { at: 456, expr: "dazed", blend: 2 },
        { at: 500, expr: "annoyed", blend: 10 },
        { at: 548, expr: "confused", blend: 8 },
        { at: 612, expr: "surprised", blend: 4 },
        { at: 626, expr: "happy", blend: 8 },
        { at: 668, expr: "excited", blend: 6 },
        { at: 700, expr: "grin", blend: 6 },
      ],
      look: [
        { at: 0, target: { char: "pip", part: "head" } },
        { at: 324, target: { prop: "box" }, blend: 3 },
        { at: 343, target: "ahead", blend: 4, noBlink: true },
        { at: 432, target: "up", blend: 8, noBlink: true },
        { at: 458, target: "camera", blend: 6, noBlink: true },
        { at: 470, target: "up", blend: 8 },
        { at: 500, target: { char: "pip", part: "head" }, blend: 8 },
        { at: 600, target: "up", blend: 6 },
        { at: 626, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 698, target: "camera", blend: 8 },
      ],
    },
  ],
  props: [
    {
      id: "box",
      kind: "giftBox",
      layer: "back",
      layerKeys: [{ from: 310, layer: "front" }],
      shadow: true,
      states: [
        { from: 0, mode: "static", pos: BOX },
        { from: 312, mode: "ballistic", to: [366, 1122], dur: 30, peak: 230, spin: -3 * Math.PI },
        { from: 342, mode: "attach", char: "bo", part: "head", offset: [0, -60], rot: Math.PI, inheritRot: true, blend: 2 },
        { from: 430, mode: "attach", char: "bo", part: "hands", offset: [0, -BOX_H / 2], rot: Math.PI, blend: 3 },
        { from: 464, mode: "ballistic", to: [120, FLOOR], dur: 24, peak: 90, endRot: 0, bounces: [[34, 10], [10, 6]], skid: -14 },
      ],
      params: {
        glow: [
          { at: 0, value: 0 },
          { at: 268, value: 0 },
          { at: 284, value: 1 },
          { at: 306, value: 1 },
          { at: 312, value: 0 },
        ],
        squash: [
          { at: 0, value: 1 },
          { at: 342, value: 1 },
          { at: 344, value: 0.82, ease: "outQuad" },
          { at: 350, value: 1.06 },
          { at: 356, value: 1 },
        ],
      },
    },
    {
      id: "lid",
      kind: "giftLid",
      layer: "back",
      layerKeys: [{ from: 262, layer: "front" }, { from: 345, layer: "back" }],
      shadow: true,
      states: [
        { from: 0, mode: "static", pos: [BOX[0], BOX[1] - BOX_H] },
        { from: 268, mode: "attach", char: "pip", part: "handF", offset: [64, 10], rot: -0.18, blend: 6 },
        { from: 307, mode: "ballistic", to: [836, FLOOR - 2], dur: 36, peak: 240, spin: 4 * Math.PI + 0.1, bounces: [[26, 9], [8, 5]], skid: 8 },
      ],
      params: { wobble: [{ at: 0, value: 0 }, { at: 278, value: 0 }, { at: 282, value: 1 }, { at: 300, value: 0 }] },
    },
    {
      id: "cupcake",
      kind: "cupcake",
      layer: "char:bo",
      hidden: [[0, 443]],
      smear: 0,
      states: [{ from: 0, mode: "attach", char: "bo", part: "headTop", offset: [4, 10], inheritRot: true }],
      params: {
        flame: [
          { at: 0, value: 1 },
          { at: 618, value: 1 },
          { at: 622, value: 0, ease: "inQuad" },
        ],
      },
    },
    {
      id: "horn",
      kind: "partyHorn",
      layer: "char:bo",
      layerKeys: [{ from: 343, layer: "front" }, { from: 372, layer: "back" }, { from: 579, layer: "char:pip" }, { from: 660, layer: "char:bo" }],
      hidden: [[0, 299]],
      shadow: true,
      states: [
        { from: 0, mode: "attach", char: "bo", part: "handF", offset: [-4, 0], rot: -0.35 },
        { from: 343, mode: "ballistic", to: [748, FLOOR - 8], dur: 28, peak: 210, spin: 6.4, bounces: [[18, 7]], skid: 6 },
        { from: 579, mode: "attach", char: "pip", part: "handF", offset: [-4, 0], rot: -0.6, blend: 4 },
        { from: 660, mode: "attach", char: "bo", part: "handF", offset: [-4, 0], rot: -0.35, blend: 4 },
      ],
      params: {
        unroll: [
          { at: 0, value: 0 },
          { at: 321, value: 0 },
          { at: 325, value: 1, ease: "outBack" },
          { at: 333, value: 1 },
          { at: 337, value: 0.15 },
          { at: 676, value: 0.15 },
          { at: 680, value: 1, ease: "outBack" },
          { at: 688, value: 1 },
          { at: 692, value: 0.2 },
          { at: 694, value: 1, ease: "outBack" },
          { at: 708, value: 1 },
          { at: 714, value: 0.2 },
        ],
      },
    },
  ],
  camera: {
    keys: [
      { at: 0, x: 540, y: 1000, zoom: 1.06 },
      { at: 96, x: 560, y: 1010, zoom: 1.1, ease: "inOutSine" },
      { at: 104, x: 560, y: 1010, zoom: 1.1 },
      { at: 150, x: 700, y: 1110, zoom: 1.55, ease: "inOutCubic" },
      { at: 232, x: 740, y: 1105, zoom: 1.62, ease: "inOutSine" },
      { at: 262, x: 780, y: 1088, zoom: 2.05, ease: "inOutCubic" },
      { at: 300, x: 792, y: 1084, zoom: 2.18, ease: "linear" },
      { at: 310, x: 520, y: 1110, zoom: 1.12, ease: "outCubic" },
      { at: 342, x: 470, y: 1120, zoom: 1.2, ease: "inOutSine" },
      { at: 362, x: 450, y: 1150, zoom: 1.42, ease: "inOutCubic" },
      { at: 430, x: 450, y: 1150, zoom: 1.46, ease: "linear" },
      { at: 472, x: 470, y: 1100, zoom: 1.6, ease: "inOutCubic" },
      { at: 552, x: 480, y: 1100, zoom: 1.6, ease: "linear" },
      { at: 572, x: 560, y: 1130, zoom: 1.5, ease: "inOutCubic" },
      { at: 590, x: 560, y: 1120, zoom: 1.5, ease: "linear" },
      { at: 608, x: 470, y: 1060, zoom: 1.7, ease: "inOutCubic" },
      { at: 640, x: 480, y: 1090, zoom: 1.58, ease: "inOutSine" },
      { at: 719, x: 470, y: 1060, zoom: 1.88, ease: "inOutSine" },
    ],
    shakes: [
      { at: 301, amp: 22, dur: 14 },
      { at: 330, amp: 6, dur: 8 },
      { at: 342, amp: 14, dur: 12 },
    ],
  },
  fx: [
    { at: 274, kind: "sparkle", x: BOX[0], y: BOX[1] - BOX_H - 30, dur: 26, scale: 1.1 },
    { at: 303, kind: "confetti", x: 300, y: 1130, dur: 30, dir: 1 },
    { at: 342, kind: "impactLines", x: 352, y: 1080, dur: 12, scale: 1.1 },
    { at: 612, kind: "puff", x: 500, y: 1100, dur: 16, dir: -1, angle: 30 },
    { at: 621, kind: "smoke", x: 392, y: 900, dur: 34 },
    { at: 680, kind: "confetti", x: 470, y: 1080, dur: 30, dir: 1 },
  ],
};
