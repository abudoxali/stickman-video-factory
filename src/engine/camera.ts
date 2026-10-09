import { ease, lerp, noise1 } from "./math";
import type { CameraKey, SceneDef } from "./scene";

export interface CameraFrame {
  x: number; // world point at frame centre
  y: number;
  zoom: number;
  rot: number; // radians
}

/**
 * Camera = keyed framings with per-key easing (a move *into* a key uses that
 * key's ease), plus decaying trauma shake. Holding is done by repeating a key.
 */
export const evaluateCamera = (def: SceneDef, frame: number): CameraFrame => {
  const keys: CameraKey[] = def.camera.keys;
  let cam: CameraFrame = { x: def.width / 2, y: def.height / 2, zoom: 1, rot: 0 };
  if (keys.length) {
    if (frame <= keys[0].at) cam = { x: keys[0].x, y: keys[0].y, zoom: keys[0].zoom, rot: keys[0].rot ?? 0 };
    else {
      const last = keys[keys.length - 1];
      cam = { x: last.x, y: last.y, zoom: last.zoom, rot: last.rot ?? 0 };
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (frame >= a.at && frame <= b.at) {
          const t = ease[b.ease ?? "inOutCubic"]((frame - a.at) / (b.at - a.at || 1));
          // interpolate zoom in log space so push-ins feel linear to the eye
          const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t));
          cam = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: z, rot: lerp(a.rot ?? 0, b.rot ?? 0, t) };
          break;
        }
      }
    }
  }
  // Shake: trauma^2 falloff, smooth noise (not white jitter), scaled by zoom.
  let sx = 0;
  let sy = 0;
  let sr = 0;
  for (const s of def.camera.shakes) {
    const t = frame - s.at;
    if (t < 0 || t > s.dur) continue;
    const trauma = Math.pow(1 - t / s.dur, 2);
    const fr = (s.freq ?? 1.6) * t;
    sx += s.amp * trauma * noise1(fr, 11 + s.at);
    sy += s.amp * trauma * noise1(fr, 23 + s.at);
    sr += 0.01 * (s.amp / 20) * trauma * noise1(fr, 37 + s.at);
  }
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom, zoom: cam.zoom, rot: cam.rot + sr };
};

/** SVG transform that maps world -> screen for a camera frame. */
export const cameraTransform = (def: SceneDef, cam: CameraFrame) =>
  `translate(${def.width / 2} ${def.height / 2}) rotate(${(cam.rot * 180) / Math.PI}) scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`;

/** Parallax layer transform: depth 1 = world plane, <1 = farther, >1 = nearer. */
export const parallaxTransform = (def: SceneDef, cam: CameraFrame, depth: number) => {
  const z = 1 + (cam.zoom - 1) * depth;
  const anchorX = def.width / 2;
  const anchorY = def.height / 2;
  const x = anchorX + (cam.x - anchorX) * depth;
  const y = anchorY + (cam.y - anchorY) * depth;
  return `translate(${def.width / 2} ${def.height / 2}) rotate(${(cam.rot * 180) / Math.PI}) scale(${z}) translate(${-x} ${-y})`;
};

export const easeNames = Object.keys(ease);
