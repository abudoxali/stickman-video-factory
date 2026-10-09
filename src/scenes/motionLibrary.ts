import { BO, PIP } from "../characters";
import type { SceneDef } from "../engine/scene";

/**
 * MOTION LIBRARY — a labelled test reel that exercises the motion vocabulary
 * not used by THE SURPRISE (run, turn, point, explain, talk, wave, shrug,
 * push, pull, sit, standUp, fall, getUp, pickUp, handOver, lookAround,
 * jump, celebrate, duck). Plain stage, static camera, captions per section.
 */
const FLOOR = 1500;
const CRATE: [number, number] = [790, FLOOR];

export const MOTION_LIBRARY_CAPTIONS: { from: number; to: number; text: string }[] = [
  { from: 0, to: 92, text: "idle · breathing · blink · lookAround | explain · talk" },
  { from: 92, to: 172, text: "run · stop · turn · turn" },
  { from: 172, to: 258, text: "point · react | shrug · wave" },
  { from: 258, to: 405, text: "push (crate slides) · pull (jerks)" },
  { from: 405, to: 500, text: "turn · sit · stand up" },
  { from: 500, to: 598, text: "fall · get up | laugh" },
  { from: 598, to: 722, text: "pick up · hand over" },
  { from: 722, to: 870, text: "jump · land · celebrate · duck · wave" },
];

export const motionLibrary: SceneDef = {
  id: "motion-library",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 870,
  floorY: FLOOR,
  stage: "plain",
  autoDust: true,
  drawOrder: ["set:back", "shadows", "props:back", "char:pip", "char:bo", "props:front", "fx"],
  set: {},
  characters: [
    {
      id: "pip",
      spec: PIP,
      x: 200,
      facing: 1,
      moves: [
        { type: "run", start: 95, to: 600 },
        { type: "turn", start: 135, to: -1, frames: 8 },
        { type: "turn", start: 152, to: 1, frames: 8 },
        { type: "walk", start: 266, to: 660, stepFrames: 20, stride: 40 },
        { type: "turn", start: 405, to: -1, frames: 8 },
        { type: "sit", start: 418, seatX: 752, seatY: FLOOR - 120, frames: 20 },
        { type: "standUp", start: 470, frames: 22 },
        { type: "turn", start: 498, to: 1, frames: 8 },
        { type: "jump", start: 726, height: 120, crouch: 6, land: 12 },
      ],
      actions: [
        { clip: "lookAround", start: 8, end: 84, in: 10, out: 10 },
        { clip: "point", start: 176, end: 214, in: 4, out: 10, params: { target: { char: "bo", part: "head" } } },
        { clip: "react", start: 226, end: 244, in: 2, out: 8, params: { strength: 0.6 } },
        { clip: "push", start: 262, end: 322, in: 8, out: 8, params: { target: { prop: "crate", offset: [-72, -66] } } },
        { clip: "pull", start: 334, end: 398, in: 8, out: 8, params: { target: { prop: "crate", offset: [-72, -66] } } },
        { clip: "laugh", start: 512, end: 568, in: 8, out: 10 },
        { clip: "handOver", start: 656, end: 694, in: 8, out: 8, params: { to: "bo", side: "F", height: -6 } },
        { clip: "celebrate", start: 734, end: 792, in: 8, out: 8 },
        { clip: "wave", start: 812, end: 866, in: 8, out: 4, params: { side: "F" } },
      ],
      expressions: [
        { at: 0, expr: "neutral" },
        { at: 20, expr: "curious", blend: 10 },
        { at: 95, expr: "excited", blend: 6 },
        { at: 172, expr: "happy", blend: 6 },
        { at: 226, expr: "surprised", blend: 3 },
        { at: 262, expr: "angry", blend: 8, amount: 0.7 },
        { at: 405, expr: "neutral", blend: 8 },
        { at: 506, expr: "laughing", blend: 6 },
        { at: 600, expr: "happy", blend: 8 },
        { at: 726, expr: "excited", blend: 6 },
        { at: 800, expr: "grin", blend: 6 },
      ],
      look: [
        { at: 0, target: "camera" },
        { at: 92, target: "ahead", blend: 6 },
        { at: 160, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 262, target: { prop: "crate" }, blend: 6 },
        { at: 405, target: "ahead", blend: 6 },
        { at: 498, target: { char: "bo", part: "head" }, blend: 6 },
        { at: 800, target: "camera", blend: 8 },
      ],
    },
    {
      id: "bo",
      spec: BO,
      x: 880,
      facing: -1,
      moves: [
        { type: "walk", start: 252, to: 950, stepFrames: 12 },
        { type: "turn", start: 290, to: -1, frames: 8 },
        { type: "fall", start: 506, frames: 24 },
        { type: "getUp", start: 560, frames: 28 },
        { type: "jump", start: 736, height: 90, crouch: 5, land: 12 },
      ],
      actions: [
        { clip: "explain", start: 8, end: 50, in: 8, out: 8 },
        { clip: "talk", start: 50, end: 90, in: 6, out: 8 },
        { clip: "shrug", start: 186, end: 216, in: 6, out: 8 },
        { clip: "wave", start: 222, end: 250, in: 6, out: 8, params: { side: "F" } },
        { clip: "pickUp", start: 612, end: 646, in: 6, out: 6, params: { side: "F", target: { prop: "ball" } } },
        { clip: "handOver", start: 650, end: 690, in: 8, out: 8, params: { to: "pip", side: "F", height: -6 } },
        { clip: "celebrate", start: 744, end: 790, in: 8, out: 8 },
        { clip: "duck", start: 796, end: 818, in: 4, out: 10 },
        { clip: "wave", start: 822, end: 866, in: 8, out: 4, params: { side: "F" } },
      ],
      expressions: [
        { at: 0, expr: "happy" },
        { at: 186, expr: "confused", blend: 6 },
        { at: 222, expr: "happy", blend: 6 },
        { at: 506, expr: "shocked", blend: 3 },
        { at: 534, expr: "dazed", blend: 8 },
        { at: 590, expr: "happy", blend: 8 },
        { at: 796, expr: "worried", blend: 4 },
        { at: 822, expr: "grin", blend: 6 },
      ],
      look: [
        { at: 0, target: "camera" },
        { at: 92, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 600, target: { prop: "ball" }, blend: 6 },
        { at: 650, target: { char: "pip", part: "head" }, blend: 6 },
        { at: 812, target: "camera", blend: 8 },
      ],
    },
  ],
  props: [
    {
      id: "crate",
      kind: "crate",
      layer: "back",
      shadow: true,
      smear: 0,
      states: [
        { from: 0, mode: "static", pos: [730, FLOOR] },
        { from: 268, mode: "slide", to: [CRATE[0] + 30, FLOOR], dur: 50, ease: "inOutSine" },
        { from: 352, mode: "slide", to: [CRATE[0] + 12, FLOOR], dur: 8, ease: "outQuad" },
        { from: 378, mode: "slide", to: [CRATE[0], FLOOR], dur: 8, ease: "outQuad" },
      ],
    },
    {
      id: "ball",
      kind: "ball",
      layer: "front",
      shadow: true,
      states: [
        { from: 0, mode: "static", pos: [884, FLOOR - 30] },
        { from: 628, mode: "attach", char: "bo", part: "handF", offset: [6, 4], blend: 4 },
        { from: 676, mode: "attach", char: "pip", part: "handF", offset: [6, 4], blend: 4 },
      ],
    },
  ],
  camera: {
    keys: [
      { at: 0, x: 600, y: 1150, zoom: 1.08 },
      { at: 496, x: 600, y: 1150, zoom: 1.08 },
      { at: 512, x: 810, y: 1150, zoom: 0.9, ease: "inOutCubic" },
      { at: 588, x: 810, y: 1150, zoom: 0.9 },
      { at: 606, x: 640, y: 1150, zoom: 1.08, ease: "inOutCubic" },
      { at: 869, x: 640, y: 1150, zoom: 1.08 },
    ],
    shakes: [{ at: 528, amp: 10, dur: 10 }],
  },
  fx: [],
};
