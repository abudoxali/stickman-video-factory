// Deterministic math helpers shared by the rig, motion clips, camera and props.
// Everything here is pure: same input -> same output, no Math.random, no time.

export type Vec2 = { x: number; y: number };

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const vlerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/**
 * Bone direction convention used throughout the rig (y points down, SVG space):
 * angle 0 = pointing straight down, +PI/2 = pointing forward (+x), PI = up.
 */
export const dir = (angle: number): Vec2 => ({ x: Math.sin(angle), y: Math.cos(angle) });
/** Inverse of dir(): the rig angle of a vector. */
export const angleOf = (d: Vec2): number => Math.atan2(d.x, d.y);

export const rotate = (p: Vec2, a: number): Vec2 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x: number, a: number, b: number, c: number, d: number) =>
  lerp(c, d, clamp01(invLerp(a, b, x)));

export const wrapAngle = (a: number) => {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
};

export const deg = (d: number) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Easing. Animators think in "slow in / slow out", "snap", "overshoot".
// ---------------------------------------------------------------------------
export type EaseFn = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  smooth: (t: number) => t * t * (3 - 2 * t),
  smoother: (t: number) => t * t * t * (t * (t * 6 - 15) + 10),
  /** Overshoots past 1 then settles: follow-through on fast moves. */
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /** Pulls back before going: anticipation baked into the curve. */
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
} satisfies Record<string, EaseFn>;

export type EaseName = keyof typeof ease;

/** Normalised progress of `t` within [a, b], eased and clamped. */
export const progress = (t: number, a: number, b: number, fn: EaseFn = ease.inOutCubic) =>
  fn(clamp01(invLerp(a, b, t)));

/**
 * Attack/hold/release envelope. Used to blend action layers in and out so no
 * pose ever pops.
 */
export const envelope = (
  t: number,
  start: number,
  end: number,
  blendIn: number,
  blendOut: number,
  fn: EaseFn = ease.inOutSine,
) => {
  if (t < start || t > end + blendOut) return 0;
  const a = blendIn <= 0 ? 1 : fn(clamp01((t - start) / blendIn));
  const b = blendOut <= 0 ? (t <= end ? 1 : 0) : 1 - fn(clamp01((t - end) / blendOut));
  return Math.min(a, b);
};

/**
 * Closed-form damped spring step response (0 -> 1). Gives overshoot +
 * settle without simulation. zeta < 1 overshoots.
 */
export const springStep = (t: number, freq = 2.2, zeta = 0.45) => {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
};

// ---------------------------------------------------------------------------
// Deterministic noise (for organic jitter that renders identically every time)
// ---------------------------------------------------------------------------
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

export const seeded = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

/** Smooth 1D value noise in [-1, 1]. */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 57.13) * 2 - 1;
  const b = hash(i + 1 + seed * 57.13) * 2 - 1;
  return lerp(a, b, ease.smooth(f));
};

/** Two-octave noise, still in roughly [-1, 1]. */
export const fbm = (x: number, seed = 0) => noise1(x, seed) * 0.7 + noise1(x * 2.3, seed + 7) * 0.3;
