import { boxH, boxW, characterBox, propBox, unionBox, type Box, type FramePart } from "./framing";
import { clamp, ease, lerp, noise1 } from "./math";
import { evaluateScene } from "./runtime";
import type { CameraKey, SceneDef, ShotSize, ShotSpec } from "./scene";

export interface CameraFrame {
  x: number; // world point at frame centre
  y: number;
  zoom: number;
  rot: number; // radians
}

// ---------------------------------------------------------------------------
// Shot keys: framings solved from the subjects' solved silhouettes, so a shot
// stays correct when the blocking or timing changes (no hand-tuned x/y/zoom,
// no characters drifting out of frame). Explicit x/y/zoom on a key win.
// ---------------------------------------------------------------------------
const SHOT: Record<ShotSize, { fill: number; part: FramePart; sy: number }> = {
  wide: { fill: 0.36, part: "body", sy: 0.62 },
  full: { fill: 0.55, part: "body", sy: 0.57 },
  medium: { fill: 0.6, part: "waist", sy: 0.52 },
  close: { fill: 0.42, part: "head", sy: 0.47 },
  insert: { fill: 0.3, part: "head", sy: 0.5 },
};
/** Fraction of the frame width subjects may use (side margins for readability). */
const WIDTH_USE = 0.86;
const ZOOM_RANGE: [number, number] = [0.6, 4.5];

export const solveShot = (def: SceneDef, shot: ShotSpec, frame: number): CameraFrame => {
  const sf = evaluateScene(def, clamp(Math.round(frame), 0, def.durationInFrames - 1));
  const size = SHOT[shot.size ?? "full"];
  const boxes: Box[] = [];
  for (const id of shot.on) {
    if (id.startsWith("prop:")) {
      const pid = id.slice(5);
      const p = sf.props[pid];
      if (!p) throw new Error(`shot: unknown prop ${pid}`);
      boxes.push(propBox(p, def.props.find((q) => q.id === pid)?.scale ?? 1));
    } else {
      const r = sf.characters[id];
      if (!r) throw new Error(`shot: unknown character ${id}`);
      boxes.push(characterBox(r, size.part));
    }
  }
  const b = unionBox(boxes);
  const fill = shot.fill ?? size.fill;
  let zoom = (fill * def.height) / Math.max(1, boxH(b));
  zoom = Math.min(zoom, (WIDTH_USE * def.width) / Math.max(1, boxW(b)));
  zoom = clamp(zoom, ...ZOOM_RANGE);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const sx = shot.sx ?? 0.5;
  const sy = shot.sy ?? size.sy;
  return { x: cx - ((sx - 0.5) * def.width) / zoom, y: cy - ((sy - 0.5) * def.height) / zoom, zoom, rot: 0 };
};

interface Resolved {
  /** Static framing per key (null for tracking keys). */
  fixed: (CameraFrame | null)[];
  /** Smoothed per-frame framings for tracking keys, indexed by key. */
  tracks: Map<number, { from: number; frames: CameraFrame[] }>;
}

const resolvedCache = new WeakMap<SceneDef, Resolved>();

const resolveKeys = (def: SceneDef): Resolved => {
  const hit = resolvedCache.get(def);
  if (hit) return hit;
  const keys = def.camera.keys;
  const fixed: (CameraFrame | null)[] = [];
  let last: CameraFrame = { x: def.width / 2, y: def.height / 2, zoom: 1, rot: 0 };
  const tracks: Resolved["tracks"] = new Map();
  keys.forEach((k, i) => {
    if (k.shot?.track) {
      // Solve from the previous key (so the move into the track is smooth) to the next key.
      const from = i > 0 ? keys[i - 1].at : k.at;
      const to = i < keys.length - 1 ? keys[i + 1].at : def.durationInFrames - 1;
      const lag = Math.max(1, k.shot.lag ?? 6);
      const a = 1 - Math.exp(-2 / lag);
      const frames: CameraFrame[] = [];
      let s1: CameraFrame | null = null;
      let s2: CameraFrame | null = null;
      for (let f = from; f <= to; f++) {
        const raw = withExplicit(k, solveShot(def, k.shot, f));
        // two cascaded exponential filters = critically damped follow (no overshoot)
        s1 = s1 ? mixFrame(s1, raw, a) : raw;
        s2 = s2 ? mixFrame(s2, s1, a) : s1;
        frames.push(s2);
      }
      tracks.set(i, { from, frames });
      fixed.push(null);
      last = frames[Math.min(frames.length - 1, k.at - from)];
      return;
    }
    const solved = k.shot ? solveShot(def, k.shot, k.shot.solveAt ?? k.at) : last;
    const fr = withExplicit(k, solved);
    fixed.push(fr);
    last = fr;
  });
  const r = { fixed, tracks };
  resolvedCache.set(def, r);
  return r;
};

const withExplicit = (k: CameraKey, base: CameraFrame): CameraFrame => ({
  x: k.x ?? base.x,
  y: k.y ?? base.y,
  zoom: k.zoom ?? base.zoom,
  rot: k.rot ?? 0,
});

const mixFrame = (a: CameraFrame, b: CameraFrame, t: number): CameraFrame => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), t)),
  rot: lerp(a.rot, b.rot, t),
});

const keyFrameAt = (res: Resolved, i: number, frame: number): CameraFrame => {
  const fx = res.fixed[i];
  if (fx) return fx;
  const tr = res.tracks.get(i)!;
  return tr.frames[clamp(Math.round(frame) - tr.from, 0, tr.frames.length - 1)];
};

/**
 * Camera = keyed framings with per-key easing (a move *into* a key uses that
 * key's ease), plus decaying trauma shake. Holding is done by repeating a key.
 * Keys may be explicit (x/y/zoom) or shots solved from the subjects.
 */
export const evaluateCamera = (def: SceneDef, frame: number, withShake = true): CameraFrame => {
  const keys: CameraKey[] = def.camera.keys;
  let cam: CameraFrame = { x: def.width / 2, y: def.height / 2, zoom: 1, rot: 0 };
  if (keys.length) {
    const res = resolveKeys(def);
    if (frame <= keys[0].at) cam = keyFrameAt(res, 0, frame);
    else {
      cam = keyFrameAt(res, keys.length - 1, frame);
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        if (frame >= a.at && frame <= b.at) {
          if (b.cut) {
            cam = frame < b.at ? keyFrameAt(res, i, frame) : keyFrameAt(res, i + 1, frame);
            break;
          }
          const t = ease[b.ease ?? "inOutCubic"]((frame - a.at) / (b.at - a.at || 1));
          // interpolate zoom in log space so push-ins feel linear to the eye
          cam = mixFrame(keyFrameAt(res, i, frame), keyFrameAt(res, i + 1, frame), t);
          break;
        }
      }
    }
  }
  // Shake: trauma^2 falloff, smooth noise (not white jitter), scaled by zoom.
  let sx = 0;
  let sy = 0;
  let sr = 0;
  for (const s of withShake ? def.camera.shakes : []) {
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

/** Frames where an editing cut happens (QA does not count them as abrupt moves). */
export const cutFrames = (def: SceneDef) => def.camera.keys.filter((k) => k.cut).map((k) => k.at);

/** Camera without shake (framing analysis). */
export const evaluateFraming = (def: SceneDef, frame: number): CameraFrame => evaluateCamera(def, frame, false);

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
