import { anchorPoint } from "./anchors";
import type { CameraFrame } from "./camera";
import type { Vec2 } from "./math";
import type { EvalResult, PropFrame } from "./runtime";
import type { SceneDef } from "./scene";

// ---------------------------------------------------------------------------
// Framing geometry shared by the auto-framing camera (shot keys) and the
// framing QA metrics: world bounding boxes of characters / props and their
// projection to the screen.
// ---------------------------------------------------------------------------

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const boxW = (b: Box) => b.x1 - b.x0;
export const boxH = (b: Box) => b.y1 - b.y0;

const fromPoints = (pts: Vec2[], pad: number): Box => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
};

export const unionBox = (boxes: Box[]): Box =>
  boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));

/**
 * What part of a character a shot frames:
 *  body  – head top (incl. hair) to soles, hands included
 *  waist – head top to just below the pelvis (medium shot)
 *  head  – head and shoulders (close-up)
 */
export type FramePart = "body" | "waist" | "head";

/** World bounding box of a solved character (silhouette incl. hands, hair, shoes). */
export const characterBox = (r: EvalResult, part: FramePart = "body"): Box => {
  const s = r.spec;
  const j = r.joints;
  const top = anchorPoint(s, r.pose, j, "headTop");
  const hair = { x: top.x, y: top.y - s.headR * 0.45 };
  const head = [
    hair,
    { x: j.headC.x - s.headR, y: j.headC.y },
    { x: j.headC.x + s.headR, y: j.headC.y },
    { x: j.headC.x, y: j.headC.y + s.headR },
  ];
  if (part === "head") return fromPoints([...head, j.shoulderF, j.shoulderB, j.chest], s.limbW);
  const arms = [j.elbowF, j.wristF, j.elbowB, j.wristB, j.shoulderF, j.shoulderB];
  if (part === "waist") {
    const hipLine = { x: j.pelvis.x, y: j.pelvis.y + (s.thigh + s.shin) * 0.3 };
    return fromPoints([...head, ...arms, j.pelvis, hipLine], s.handR + s.limbW * 0.5);
  }
  const legs = [j.kneeF, j.kneeB, j.ankleF, j.ankleB];
  const feet = [j.ankleF, j.ankleB].flatMap((a) => [
    { x: a.x - s.footLen * 0.75, y: a.y + s.ankleH + 4 },
    { x: a.x + s.footLen * 0.75, y: a.y + s.ankleH + 4 },
  ]);
  return fromPoints([...head, ...arms, j.pelvis, ...legs, ...feet], s.handR + s.legW * 0.5);
};

/** Rough world box of a prop (radius around its origin; props are small). */
export const propBox = (p: PropFrame, scale = 1, radius = 40): Box => {
  const r = radius * scale;
  return { x0: p.x - r, y0: p.y - r, x1: p.x + r, y1: p.y + r };
};

/** World box -> screen box for a camera frame (rotation ignored: shots are level). */
export const toScreen = (def: SceneDef, cam: CameraFrame, b: Box): Box => ({
  x0: (b.x0 - cam.x) * cam.zoom + def.width / 2,
  x1: (b.x1 - cam.x) * cam.zoom + def.width / 2,
  y0: (b.y0 - cam.y) * cam.zoom + def.height / 2,
  y1: (b.y1 - cam.y) * cam.zoom + def.height / 2,
});

/** Fraction of a screen box that lies outside the frame (0 = fully in, 1 = fully out). */
export const outsideFraction = (def: SceneDef, s: Box) => {
  const w = Math.max(1e-6, boxW(s));
  const h = Math.max(1e-6, boxH(s));
  const ix = Math.max(0, Math.min(s.x1, def.width) - Math.max(s.x0, 0));
  const iy = Math.max(0, Math.min(s.y1, def.height) - Math.max(s.y0, 0));
  return 1 - (ix * iy) / (w * h);
};
