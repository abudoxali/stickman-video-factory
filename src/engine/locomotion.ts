import { clamp, clamp01, ease, hash, lerp, noise1, rotate, v, type Vec2 } from "./math";
import { legLength } from "./rig";
import type { CharacterSpec } from "./types";

/**
 * Locomotion moves are the "root motion" vocabulary of a character. They are
 * baked once per scene into a per-frame table so that every frame can be
 * evaluated independently (Remotion renders frames out of order, in parallel).
 */
export type GaitStyle = "normal" | "tiptoe" | "stagger" | "brisk" | "run";

export type LocoMove =
  | {
      type: "walk" | "run";
      start: number;
      to: number;
      style?: GaitStyle;
      stepFrames?: number;
      stride?: number;
      lift?: number;
      bob?: number;
      /** Seed for stagger irregularity. */
      seed?: number;
    }
  | { type: "turn"; start: number; to?: 1 | -1; frames?: number }
  | {
      type: "jump";
      start: number;
      to?: number;
      height: number;
      crouch?: number;
      land?: number;
      /** Flip facing while airborne. */
      turn?: boolean;
      /** Crouch depth as fraction of leg length. */
      depth?: number;
    }
  | { type: "step"; start: number; foot: "F" | "B"; to: number; frames?: number; lift?: number }
  | { type: "sit"; start: number; seatX: number; seatY: number; frames?: number }
  | { type: "standUp"; start: number; frames?: number }
  | { type: "fall"; start: number; frames?: number }
  | { type: "getUp"; start: number; frames?: number };

export interface FootFrame {
  x: number; // world ankle x
  y: number; // world ankle y
  rot: number; // local foot rotation (+ = toe down)
  plant: number; // 0..1 locked to ground
}

export interface LocoFrame {
  x: number;
  y: number;
  facing: number;
  bodyRot: number;
  hipDelta: number;
  hipX: number;
  lean: number;
  squash: number;
  F: FootFrame;
  B: FootFrame;
  /** Feet given in local space (used while lying/tumbling). */
  feetLocal: boolean;
  speed: number; // signed px/frame (smoothed)
  moving: number; // 0..1 weight of "travelling" upper-body motion
  run: number; // 0..1 run weight
  swing: number; // -1..1 arm phase derived from actual foot separation
  airborne: number; // 0..1
  jumpArms: number; // -1 arms back (crouch) .. +1 arms up (air)
  sneak: number; // 0..1 tiptoe weight
  wobble: number; // stagger lean noise
  sit: number; // 0..1
  lying: number; // 0..1
}

export interface LocoEvent {
  frame: number;
  kind: "contact" | "takeoff" | "land" | "turn" | "impact";
  foot?: "F" | "B";
  x: number;
  y: number;
}

export interface LocoBake {
  frames: LocoFrame[];
  events: LocoEvent[];
  warnings: string[];
}

type Foot = { x: number; y: number; rot: number };

const STANCE_HALF = 13;

/** Ankle position for a foot planted at sole-x `x`, rotated about toe or heel. */
const pivotFoot = (
  s: CharacterSpec,
  groundY: number,
  soleX: number,
  dirn: number,
  rot: number,
): Vec2 => {
  // Local foot geometry (facing +x): ankle at (0, -ankleH) above sole point,
  // toe at +0.7 footLen, heel at -0.3 footLen.
  const fl = s.footLen;
  if (rot >= 0) {
    // heel lifting, pivot on toe
    const rel = rotate(v(-0.7 * fl, -s.ankleH), rot);
    return v(soleX + dirn * (0.7 * fl + rel.x), groundY + rel.y);
  }
  const rel = rotate(v(0.3 * fl, -s.ankleH), rot);
  return v(soleX + dirn * (-0.3 * fl + rel.x), groundY + rel.y);
};

export const bakeLocomotion = (
  s: CharacterSpec,
  moves0: LocoMove[],
  opts: { x: number; floorY: number; facing: 1 | -1; totalFrames: number },
): LocoBake => {
  const { floorY, totalFrames } = opts;
  const L = legLength(s);
  const frames: LocoFrame[] = [];
  const events: LocoEvent[] = [];
  const warnings: string[] = [];
  const moves = [...moves0].sort((a, b) => a.start - b.start);

  // ---- mutable state carried between moves -------------------------------
  let x = opts.x;
  let facing: 1 | -1 = opts.facing;
  let footF: Foot = { x: x + STANCE_HALF * facing, y: floorY - s.ankleH, rot: 0 };
  let footB: Foot = { x: x - STANCE_HALF * facing, y: floorY - s.ankleH, rot: 0 };
  let sitting = false;
  let lying = false;
  let seat = { x: 0, y: 0 };

  const base = (): LocoFrame => ({
    x,
    y: floorY,
    facing,
    bodyRot: 0,
    hipDelta: 0,
    hipX: 0,
    lean: 0,
    squash: 1,
    F: { ...footF, plant: 1 },
    B: { ...footB, plant: 1 },
    feetLocal: false,
    speed: 0,
    moving: 0,
    run: 0,
    swing: 0,
    airborne: 0,
    jumpArms: 0,
    sneak: 0,
    wobble: 0,
    sit: sitting ? 1 : 0,
    lying: lying ? 1 : 0,
  });

  const sitFrame = (): LocoFrame => {
    const f = base();
    const standHip = L * 0.975 + s.ankleH;
    f.hipDelta = floorY - seat.y + 4 - standHip; // pelvis on the seat
    f.hipX = (seat.x - x) * facing;
    f.sit = 1;
    return f;
  };

  const lyingFrame = (): LocoFrame => {
    const f = base();
    f.bodyRot = -1.5;
    f.y = floorY - s.torsoBotW * 0.42;
    f.feetLocal = true;
    f.F = { x: 16, y: -s.ankleH - 6, rot: -0.4, plant: 0 };
    f.B = { x: -4, y: -s.ankleH, rot: -0.2, plant: 0 };
    f.lying = 1;
    return f;
  };

  const restFrame = () => (lying ? lyingFrame() : sitting ? sitFrame() : base());

  const push = (f: LocoFrame) => {
    if (frames.length < totalFrames) frames.push(f);
  };

  const fillUntil = (frame: number) => {
    while (frames.length < Math.min(frame, totalFrames)) push(restFrame());
  };

  // ---- generators --------------------------------------------------------
  const doTurn = (to: 1 | -1, n = 7) => {
    if (to === facing) return;
    const from = facing;
    const startF = { ...footF };
    const startB = { ...footB };
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const e = ease.inOutCubic(u);
      const f = base();
      f.facing = lerp(from, to, e);
      // Little shuffle-hop so the feet re-seat under the new facing.
      const hop = Math.sin(Math.PI * u);
      const tF = x + STANCE_HALF * to;
      const tB = x - STANCE_HALF * to;
      f.F = { x: lerp(startF.x, tF, e), y: floorY - s.ankleH - hop * 9, rot: 0, plant: 1 - hop };
      f.B = { x: lerp(startB.x, tB, e), y: floorY - s.ankleH - hop * 6, rot: 0, plant: 1 - hop };
      f.hipDelta = -hop * 6;
      push(f);
    }
    facing = to;
    footF = { x: x + STANCE_HALF * to, y: floorY - s.ankleH, rot: 0 };
    footB = { x: x - STANCE_HALF * to, y: floorY - s.ankleH, rot: 0 };
    events.push({ frame: frames.length - 1, kind: "turn", x, y: floorY });
  };

  const doWalk = (m: Extract<LocoMove, { type: "walk" | "run" }>) => {
    const style: GaitStyle = m.type === "run" ? "run" : (m.style ?? "normal");
    const isRun = style === "run";
    const D = m.to - x;
    if (Math.abs(D) < 2) return;
    const dirn: 1 | -1 = D > 0 ? 1 : -1;
    if (dirn !== facing) doTurn(dirn);

    const g = s.gait;
    const T = Math.max(
      5,
      Math.round(
        m.stepFrames ??
          (isRun ? g.stepFrames * 0.6 : style === "tiptoe" ? g.stepFrames * 1.35 : style === "brisk" ? g.stepFrames * 0.85 : g.stepFrames),
      ),
    );
    const strideMax =
      m.stride ?? (isRun ? g.stride * 1.55 : style === "tiptoe" ? g.stride * 0.62 : style === "stagger" ? g.stride * 0.55 : g.stride);
    const lift = m.lift ?? (isRun ? g.lift * 1.9 : style === "tiptoe" ? g.lift * 1.7 : g.lift);
    const bob = m.bob ?? (isRun ? g.bob * 1.6 : g.bob);
    const N = Math.max(1, Math.ceil(Math.abs(D) / strideMax));
    const travel = N * T;

    // Root path: trapezoid velocity (ease in over the first step, ease out
    // over the last), integrated numerically so the result is exact.
    const ramp = Math.min(travel / 2, T * (isRun ? 1.2 : 0.9));
    const SUB = 8;
    const pos: number[] = [0];
    let acc = 0;
    for (let i = 0; i < travel; i++) {
      for (let k = 0; k < SUB; k++) {
        const t = i + (k + 0.5) / SUB;
        const vIn = ease.inOutSine(clamp01(t / ramp));
        const vOut = ease.inOutSine(clamp01((travel - t) / ramp));
        acc += Math.min(vIn, vOut) / SUB;
      }
      pos.push(acc);
    }
    const X = (t: number) => x + (D * pos[clamp(Math.round(t), 0, travel)]) / acc;

    // Stagger: irregular timing and landing jitter.
    const seed = m.seed ?? s.seed;
    const jitter = (i: number) => (style === "stagger" ? (hash(i * 13.7 + seed) - 0.5) * strideMax * 0.7 : 0);

    // Plan landings. Swing foot = the one behind relative to travel.
    const behindIsF = (footF.x - footB.x) * dirn < 0;
    type Plan = { foot: "F" | "B"; s: number; e: number; from: number; to: number; lift: number };
    const plans: Plan[] = [];
    let curF = footF.x;
    let curB = footB.x;
    const swingLead = isRun ? -0.2 : 0.14; // <0 = flight phase, >0 = double support
    for (let i = 0; i < N; i++) {
      const foot: "F" | "B" = (i % 2 === 0) === behindIsF ? "F" : "B";
      const tEnd = (i + 1) * T;
      let to: number;
      if (i < N - 1) {
        const nextTravel = X(Math.min(travel, tEnd + T)) - X(tEnd);
        to = X(tEnd) + nextTravel / 2 + jitter(i);
      } else {
        to = m.to + dirn * STANCE_HALF;
      }
      const from = foot === "F" ? curF : curB;
      plans.push({ foot, s: Math.max(0, i * T + swingLead * T), e: tEnd, from, to, lift });
      if (foot === "F") curF = to;
      else curB = to;
    }
    // Settle step: bring the trailing foot beside the other one.
    const trailing: "F" | "B" = plans[plans.length - 1].foot === "F" ? "B" : "F";
    const trailingX = trailing === "F" ? curF : curB;
    const settleTo = m.to - dirn * STANCE_HALF;
    let total = travel;
    if (Math.abs(trailingX - settleTo) > 3) {
      const ts = Math.round(T * 0.8);
      plans.push({ foot: trailing, s: travel - 1, e: travel - 1 + ts, from: trailingX, to: settleTo, lift: lift * 0.45 });
      total = travel - 1 + ts;
      if (trailing === "F") curF = settleTo;
      else curB = settleTo;
    }

    const groundY = floorY;
    const ankleY = floorY - s.ankleH;
    const heelOffFrames = isRun ? T * 0.35 : T * 0.3;

    const footAt = (foot: "F" | "B", t: number, restX: number): FootFrame => {
      const mine = plans.filter((p) => p.foot === foot);
      // Swinging?
      for (const p of mine) {
        if (t >= p.s && t <= p.e) {
          const u = clamp01((t - p.s) / (p.e - p.s));
          const offRot = isRun ? 0.85 : style === "tiptoe" ? 0.55 : 0.5;
          const strikeRot = isRun ? -0.05 : style === "tiptoe" ? 0.35 : -0.32;
          const start = pivotFoot(s, groundY, p.from, dirn, offRot);
          const end = pivotFoot(s, groundY, p.to, dirn, strikeRot);
          const hx = lerp(start.x, end.x, ease.inOutSine(u));
          const arc = Math.sin(Math.PI * Math.pow(u, 0.85));
          const hy = lerp(start.y, end.y, u) - p.lift * arc;
          // toe-off -> tuck -> heel reaching forward
          const rot =
            offRot * Math.pow(1 - u, 2.2) +
            strikeRot * Math.pow(u, 3) -
            (isRun ? 0.35 : 0.12) * Math.sin(Math.PI * u);
          return { x: hx, y: hy, rot, plant: 0 };
        }
      }
      // Planted: find the plant interval we are in.
      let px = restX;
      let landedAt = -Infinity;
      let strikeRot = 0;
      for (const p of mine) {
        if (p.e < t) {
          px = p.to;
          landedAt = p.e;
          strikeRot = isRun ? -0.05 : style === "tiptoe" ? 0.35 : -0.32;
        }
      }
      const next = mine.find((p) => p.s > t);
      let rot = 0;
      // heel strike slap (first frames after landing)
      const since = t - landedAt;
      if (since >= 0 && since < 4) rot = strikeRot * (1 - ease.outQuad(since / 4));
      // heel off before the next swing
      if (next) {
        const until = next.s - t;
        if (until < heelOffFrames) {
          const offRot = isRun ? 0.85 : style === "tiptoe" ? 0.55 : 0.5;
          rot = offRot * ease.inQuad(1 - until / heelOffFrames);
        }
      }
      const a = pivotFoot(s, groundY, px, dirn, rot);
      return { x: a.x, y: a.y, rot, plant: 1 };
    };

    const startFX = footF.x;
    const startBX = footB.x;
    for (let i = 0; i <= total && frames.length < totalFrames; i++) {
      const t = i;
      const f = base();
      const rx = X(Math.min(t, travel));
      f.x = rx;
      f.F = footAt("F", t, startFX);
      f.B = footAt("B", t, startBX);
      // Pelvis bob: lowest just after contact, highest at passing.
      const ph = (t % T) / T;
      if (isRun) {
        f.hipDelta = -bob * (0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.35))) + bob * 0.3;
      } else {
        const b = 0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.08));
        f.hipDelta = -bob * b + (s.gait.bounce - 1) * bob * (1 - b);
      }
      if (t > travel) f.hipDelta *= 0.4; // settle step
      const sep = (f.F.x - f.B.x) * dirn;
      f.swing = clamp(sep / (strideMax * 1.0), -1, 1);
      f.run = isRun ? 1 : 0;
      f.sneak = style === "tiptoe" ? 1 : 0;
      f.wobble = style === "stagger" ? noise1(t / 7, seed) : 0;
      f.airborne = f.F.plant < 0.5 && f.B.plant < 0.5 ? 1 : 0;
      push(f);
      // contact events
      for (const p of plans) if (Math.round(p.e) === i) events.push({ frame: frames.length - 1, kind: "contact", foot: p.foot, x: p.to, y: groundY });
    }
    x = m.to;
    footF = { x: curF, y: ankleY, rot: 0 };
    footB = { x: curB, y: ankleY, rot: 0 };
  };

  const doJump = (m: Extract<LocoMove, { type: "jump" }>) => {
    const c = m.crouch ?? 7;
    const landN = m.land ?? 12;
    const H = m.height;
    const gpx = 2.4; // cartoon gravity px/frame^2
    const air = Math.max(8, Math.round(2 * Math.sqrt((2 * H) / gpx)));
    const x0 = x;
    const x1 = m.to ?? x;
    const depth = (m.depth ?? 0.22) * L;
    const f0F = { ...footF };
    const f0B = { ...footB };
    const toFacing: 1 | -1 = m.turn ? (facing === 1 ? -1 : 1) : facing;

    // 1) anticipation crouch
    for (let i = 0; i < c; i++) {
      const u = (i + 1) / c;
      const f = base();
      f.hipDelta = -depth * ease.outCubic(u);
      f.lean = 0.22 * ease.outCubic(u);
      f.squash = 1 - 0.07 * u;
      f.jumpArms = -ease.outCubic(u);
      push(f);
    }
    events.push({ frame: frames.length, kind: "takeoff", x: x0, y: floorY });
    // 2) airborne
    for (let i = 0; i < air; i++) {
      const u = (i + 1) / air;
      const f = base();
      f.x = lerp(x0, x1, u);
      f.y = floorY - 4 * H * u * (1 - u);
      f.facing = m.turn ? lerp(facing, toFacing, ease.inOutCubic(clamp01((u - 0.15) / 0.5))) : facing;
      const sgn = f.facing >= 0 ? 1 : -1;
      // feet: push off (trail), tuck, then reach for the floor
      const tuck = Math.sin(Math.PI * clamp01(u * 1.15)) * 0.5;
      const pushOff = clamp01(1 - u * 5);
      const landF = x1 + STANCE_HALF * toFacing;
      const landB = x1 - STANCE_HALF * toFacing;
      const relF = v(STANCE_HALF + 8 * tuck, -s.ankleH - L * tuck * 0.55);
      const relB = v(-STANCE_HALF - 4 * tuck, -s.ankleH - L * tuck * 0.35);
      const airF = v(f.x + relF.x * sgn, f.y + relF.y);
      const airB = v(f.x + relB.x * sgn, f.y + relB.y);
      const reach = ease.inCubic(clamp01((u - 0.7) / 0.3));
      f.F = {
        x: lerp(lerp(airF.x, f0F.x, pushOff), landF, reach * 0.6),
        y: lerp(airF.y, f0F.y, pushOff),
        rot: 0.5 * (1 - u) + 0.2 * tuck,
        plant: 0,
      };
      f.B = {
        x: lerp(lerp(airB.x, f0B.x, pushOff), landB, reach * 0.6),
        y: lerp(airB.y, f0B.y, pushOff),
        rot: 0.6 * (1 - u) + 0.3 * tuck,
        plant: 0,
      };
      f.hipDelta = -depth * Math.max(0, 1 - u * 4) + 4;
      f.squash = 1 + 0.14 * Math.sin(Math.PI * clamp01(u * 2.2)) * (u < 0.45 ? 1 : 0) + 0.04 * reach;
      f.lean = 0.22 * Math.max(0, 1 - u * 3) - 0.08 * Math.sin(Math.PI * u);
      f.jumpArms = Math.min(1, -1 + u * 8);
      f.airborne = 1;
      push(f);
    }
    facing = toFacing;
    x = x1;
    footF = { x: x1 + STANCE_HALF * facing, y: floorY - s.ankleH, rot: 0 };
    footB = { x: x1 - STANCE_HALF * facing, y: floorY - s.ankleH, rot: 0 };
    events.push({ frame: frames.length, kind: "land", x: x1, y: floorY });
    // 3) landing: compress, recover with a little overshoot
    for (let i = 0; i < landN; i++) {
      const t = i + 1;
      const tau = 2.6;
      const k = (t / tau) * Math.exp(1 - t / tau);
      const f = base();
      f.hipDelta = -depth * 1.25 * k;
      f.squash = 1 - 0.13 * k;
      f.lean = 0.18 * k;
      f.jumpArms = 1 - ease.outCubic(t / landN) * 1.0 - 0.6 * k;
      push(f);
    }
  };

  const doStep = (m: Extract<LocoMove, { type: "step" }>) => {
    const n = m.frames ?? 9;
    const ft = m.foot === "F" ? footF : footB;
    const from = ft.x;
    const other = m.foot === "F" ? footB.x : footF.x;
    const x0 = x;
    const x1 = (m.to + other) / 2;
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const f = base();
      const fx = lerp(from, m.to, ease.inOutSine(u));
      const fy = floorY - s.ankleH - (m.lift ?? 14) * Math.sin(Math.PI * u);
      const ff: FootFrame = { x: fx, y: fy, rot: 0.25 * Math.sin(Math.PI * u), plant: u >= 1 ? 1 : 0 };
      if (m.foot === "F") f.F = ff;
      else f.B = ff;
      f.x = lerp(x0, x1, ease.inOutSine(u));
      push(f);
    }
    ft.x = m.to;
    x = x1;
    events.push({ frame: frames.length - 1, kind: "contact", foot: m.foot, x: m.to, y: floorY });
  };

  const doSit = (m: Extract<LocoMove, { type: "sit" }>) => {
    const n = m.frames ?? 18;
    const standHip = L * 0.975 + s.ankleH;
    seat = { x: m.seatX, y: m.seatY };
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const e = ease.inOutCubic(u);
      const f = base();
      f.hipDelta = (floorY - seat.y + 4 - standHip) * e;
      f.hipX = (seat.x - x) * facing * e;
      f.lean = 0.35 * Math.sin(Math.PI * u); // counter-balance forward while lowering
      f.sit = e;
      if (u > 0.9) f.squash = 1 - 0.05 * Math.sin(Math.PI * (u - 0.9) * 10);
      push(f);
    }
    sitting = true;
  };

  const doStandUp = (m: Extract<LocoMove, { type: "standUp" }>) => {
    const n = m.frames ?? 20;
    const standHip = L * 0.975 + s.ankleH;
    const startDelta = floorY - seat.y + 4 - standHip;
    const startX = (seat.x - x) * facing;
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const f = base();
      // weight shifts forward over the feet first (anticipation), then rise
      const lift = ease.inOutCubic(clamp01((u - 0.3) / 0.7));
      f.lean = 0.5 * Math.sin(Math.PI * clamp01(u / 0.85));
      f.hipX = lerp(startX, 0, ease.outCubic(clamp01(u / 0.5)));
      f.hipDelta = startDelta * (1 - lift);
      f.sit = 1 - lift;
      push(f);
    }
    sitting = false;
  };

  const doFall = (m: Extract<LocoMove, { type: "fall" }>) => {
    const n = m.frames ?? 22;
    const end = lyingFrame();
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const f = base();
      // topple with gravity (ease-in), small bounce at impact
      const tip = u < 0.8 ? ease.inQuad(u / 0.8) : 1 + 0.06 * Math.sin(Math.PI * ((u - 0.8) / 0.2));
      f.bodyRot = end.bodyRot * Math.min(tip, 1.06);
      f.y = lerp(floorY, end.y, Math.min(1, tip));
      f.hipDelta = -L * 0.25 * Math.sin(Math.PI * clamp01(u / 0.6));
      f.feetLocal = u > 0.35;
      if (f.feetLocal) {
        const k = clamp01((u - 0.35) / 0.4);
        f.F = { x: lerp(STANCE_HALF, end.F.x, k), y: lerp(-s.ankleH, end.F.y, k) - 30 * Math.sin(Math.PI * k), rot: end.F.rot * k, plant: 0 };
        f.B = { x: lerp(-STANCE_HALF, end.B.x, k), y: lerp(-s.ankleH, end.B.y, k) - 20 * Math.sin(Math.PI * k), rot: end.B.rot * k, plant: 0 };
      }
      f.lying = clamp01((u - 0.5) / 0.5);
      push(f);
    }
    events.push({ frame: frames.length - 1, kind: "impact", x: x - 0.5 * L * facing, y: floorY });
    lying = true;
  };

  const doGetUp = (m: Extract<LocoMove, { type: "getUp" }>) => {
    const n = m.frames ?? 26;
    const startL = lyingFrame();
    for (let i = 0; i < n; i++) {
      const u = (i + 1) / n;
      const f = base();
      const k = ease.inOutCubic(u);
      f.bodyRot = startL.bodyRot * (1 - k);
      f.y = lerp(startL.y, floorY, k);
      f.hipDelta = -L * 0.45 * Math.sin(Math.PI * u);
      f.lean = 0.45 * Math.sin(Math.PI * u);
      f.feetLocal = u < 0.6;
      if (f.feetLocal) {
        const q = clamp01(u / 0.6);
        f.F = { x: lerp(startL.F.x, STANCE_HALF, q), y: lerp(startL.F.y, -s.ankleH, q), rot: startL.F.rot * (1 - q), plant: 0 };
        f.B = { x: lerp(startL.B.x, -STANCE_HALF, q), y: lerp(startL.B.y, -s.ankleH, q), rot: startL.B.rot * (1 - q), plant: 0 };
      }
      f.lying = 1 - k;
      push(f);
    }
    lying = false;
  };

  for (const m of moves) {
    if (m.start < frames.length) {
      warnings.push(`${s.id}: move ${m.type}@${m.start} overlaps previous move (ends ${frames.length}); delayed.`);
    }
    fillUntil(m.start);
    switch (m.type) {
      case "walk":
      case "run":
        doWalk(m);
        break;
      case "turn":
        doTurn(m.to ?? (facing === 1 ? -1 : 1), m.frames);
        break;
      case "jump":
        doJump(m);
        break;
      case "step":
        doStep(m);
        break;
      case "sit":
        doSit(m);
        break;
      case "standUp":
        doStandUp(m);
        break;
      case "fall":
        doFall(m);
        break;
      case "getUp":
        doGetUp(m);
        break;
    }
  }
  fillUntil(totalFrames);

  // ---- post-pass: ramp style weights so postures never switch instantly ----
  const n = frames.length;
  const smoothKey = (key: "sneak" | "run" | "wobble", radius: number) => {
    const src = frames.map((f) => f[key]);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      let w = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = Math.min(n - 1, Math.max(0, i + k));
        const wk = radius + 1 - Math.abs(k); // triangular kernel
        acc += src[j] * wk;
        w += wk;
      }
      frames[i][key] = acc / w;
    }
  };
  smoothKey("sneak", 6);
  smoothKey("run", 5);
  smoothKey("wobble", 3);
  // Tiptoe crouch follows the (smoothed) sneak weight.
  for (const f of frames) f.hipDelta -= L * 0.12 * f.sneak;

  // ---- post-pass: speed, travel weight, momentum lean -----------------------
  const vel = frames.map((_, i) => {
    const a = frames[Math.max(0, i - 2)].x;
    const b = frames[Math.min(n - 1, i + 2)].x;
    return (b - a) / (Math.min(n - 1, i + 2) - Math.max(0, i - 2) || 1);
  });
  const vmax = s.gait.stride / s.gait.stepFrames;
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    f.speed = vel[i];
    const sp = Math.abs(vel[i]) / vmax;
    const grounded = 1 - f.airborne;
    f.moving = clamp01(sp * 1.6) * grounded * (1 - f.sit) * (1 - f.lying);
    const accel = (vel[Math.min(n - 1, i + 2)] - vel[Math.max(0, i - 2)]) / 4;
    const dirn = f.facing >= 0 ? 1 : -1;
    f.lean += (s.gait.lean * sp + (f.run ? 0.18 : 0)) * grounded;
    // Lean into acceleration, brace back while braking. The forward
    // follow-through after a stop comes from the secondary-motion spring.
    f.lean += clamp(accel * dirn * 0.9, -0.12, 0.12) * grounded;
  }

  return { frames, events, warnings };
};
