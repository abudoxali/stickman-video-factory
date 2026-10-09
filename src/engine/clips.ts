import { anchorPoint } from "./anchors";
import type { LocoFrame } from "./locomotion";
import {
  add,
  clamp,
  clamp01,
  dist,
  ease,
  lerp,
  noise1,
  progress,
  springStep,
  sub,
  v,
  vlerp,
  type Vec2,
} from "./math";
import warmUp from "../clips/warmUp.json";
import { keyedClip, type KeyedClipData } from "./keyedClips";
import { ELBOW_POLE, legLength, reachAngles, solvePose } from "./rig";
import type { AnchorPart, TargetRef } from "./scene";
import type { CharacterSpec, PartialPose, Pose } from "./types";

/**
 * A motion clip maps (time, params, current pose) -> pose channels. Clips are
 * layered by the character evaluator with blend-in/out envelopes, so a clip
 * only describes the motion itself; it never needs to know what came before.
 *
 * - "override" clips: output absolute channel values; blended with lerp.
 * - "additive" clips: output deltas; added scaled by weight.
 */
export interface ClipCtx {
  t: number; // frames since clip start
  dur: number; // clip length in frames
  u: number; // t / dur (clamped)
  frame: number;
  spec: CharacterSpec;
  pose: Pose;
  loco: LocoFrame;
  fwd: 1 | -1;
  params: Record<string, unknown>;
  target: (ref: TargetRef) => Vec2;
  /** Target as it was/will be at another frame (e.g. freeze a grab point before the prop attaches to the hand). */
  targetAt: (ref: TargetRef, frame: number) => Vec2;
  self: (part: AnchorPart | "shoulderF" | "shoulderB", pose?: Pose) => Vec2;
}

export interface Clip {
  kind: "override" | "additive";
  description: string;
  /** How arm channels blend in/out: "hand" (default, hand travels on an arc around the shoulder) or "angle". */
  armBlend?: "hand" | "angle";
  fn: (c: ClipCtx) => PartialPose;
}

type Side = "F" | "B";
const HOLD_POLE_F = v(0.2, 1);
const HOLD_POLE_B = v(-0.6, 1);
const sideOf = (p: unknown, d: Side = "F"): Side => (p === "B" ? "B" : p === "F" ? "F" : d);
const arm = (side: Side, sh: number, el: number, wr?: number): PartialPose =>
  side === "F"
    ? { aFsh: sh, aFel: el, ...(wr !== undefined ? { aFwr: wr } : {}) }
    : { aBsh: sh, aBel: el, ...(wr !== undefined ? { aBwr: wr } : {}) };
const hand = (side: Side, open: number, point = 0): PartialPose =>
  side === "F" ? { hFopen: open, hFpoint: point } : { hBopen: open, hBpoint: point };
const osc = (t: number, period: number, phase = 0) => Math.sin(2 * Math.PI * (t / period + phase));

/** IK reach with automatic forward lean when the target is out of reach. */
const reachWithLean = (c: ClipCtx, side: Side, target: Vec2, maxLean = 0.7, pose = c.pose) => {
  const s = c.spec;
  const armLen = s.upperArm + s.foreArm;
  let best = { lean: pose.lean, chest: pose.chest, hipY: pose.hipY };
  for (let k = 0; k <= 10; k++) {
    const extra = (maxLean * k) / 10;
    const trial: Pose = { ...pose, lean: pose.lean + extra, chest: pose.chest + extra * 0.25 };
    // lowering the pelvis also helps reach low targets
    if (target.y > c.self("pelvis", pose).y) trial.hipY = pose.hipY - legLength(s) * 0.25 * (k / 10);
    best = { lean: trial.lean, chest: trial.chest, hipY: trial.hipY };
    const sh = c.self(side === "F" ? "shoulderF" : "shoulderB", trial);
    if (dist(sh, target) < armLen * 0.97) break;
  }
  const p2: Pose = { ...pose, ...best };
  const ik = reachAngles(s, p2, side, target);
  return { body: best, ...arm(side, ik.sh, ik.el), pose: p2, reached: ik.reached };
};

export const CLIPS: Record<string, Clip> = {
  // ---------------------------------------------------------------- gestures
  point: {
    kind: "override",
    description: "Cock the arm back (anticipation), then thrust a pointing finger at a target with overshoot.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      const tgt = c.target(c.params.target as TargetRef);
      const sh = c.self(side === "F" ? "shoulderF" : "shoulderB");
      const d = sub(tgt, sh);
      const l = Math.hypot(d.x, d.y) || 1;
      const reachLen = (c.spec.upperArm + c.spec.foreArm) * 0.97;
      const aim = add(sh, v((d.x / l) * reachLen, (d.y / l) * reachLen));
      const ik = reachAngles(c.spec, c.pose, side, aim);
      const cock = progress(c.t, 0, 5, ease.outQuad) * (1 - progress(c.t, 5, 9));
      const thrust = progress(c.t, 4, 13, ease.outBack);
      const jab = Math.exp(-Math.max(0, c.t - 13) / 5) * osc(c.t, 9) * 0.06 * (c.t > 13 ? 1 : 0);
      return {
        ...arm(side, lerp(c.pose[side === "F" ? "aFsh" : "aBsh"] - 0.5 * cock, ik.sh, thrust) + jab, lerp(1.6, ik.el, thrust), 0),
        ...hand(side, 0, 1),
        lean: c.pose.lean + 0.06 * thrust,
        shrug: c.pose.shrug + 4 * cock,
      };
    },
  },

  reach: {
    kind: "override",
    description: "IK hand to a world target; leans/crouches automatically if out of reach. params: target, side, grip(0..1 at end), tremble.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      let tgt = c.target(c.params.target as TargetRef);
      const tremble = Number(c.params.tremble ?? 0);
      if (tremble) tgt = add(tgt, v(noise1(c.t / 3, 4) * tremble, noise1(c.t / 3, 9) * tremble));
      const r = reachWithLean(c, side, tgt, Number(c.params.maxLean ?? 0.6));
      const grip = Number(c.params.grip ?? 0) * progress(c.u, 0.75, 1);
      return {
        ...r.body,
        neck: c.pose.neck + 0.05,
        ...arm(side, r[side === "F" ? "aFsh" : "aBsh"] ?? 0, r[side === "F" ? "aFel" : "aBel"] ?? 0, 0.15),
        ...hand(side, 1 - grip, Number(c.params.point ?? 0)),
      };
    },
  },

  explain: {
    kind: "override",
    description: "Open-palm explaining gestures, alternating arms on a beat (overlapping action) with head nods.",
    fn: (c) => {
      const beatF = Math.pow(Math.max(0, osc(c.t, 20)), 2);
      const beatB = Math.pow(Math.max(0, osc(c.t, 20, 0.45)), 2);
      return {
        aFsh: 0.55 + 0.35 * beatF,
        aFel: 1.35 - 0.45 * beatF,
        aFwr: -0.5,
        aBsh: 0.4 + 0.3 * beatB,
        aBel: 1.5 - 0.4 * beatB,
        aBwr: -0.5,
        hFopen: 1,
        hBopen: 1,
        head: c.pose.head + 0.07 * beatF - 0.04 * beatB,
        lean: c.pose.lean + 0.03 * beatF,
      };
    },
  },

  talk: {
    kind: "override",
    description: "Silent talking: syllable mouth flaps, head bobs and a light hand gesture.",
    fn: (c) => {
      const syl = Math.abs(Math.sin(c.t * 0.95)) * (0.55 + 0.45 * noise1(c.t / 4, 3));
      return {
        mouthOpen: 0.12 + 0.55 * syl,
        mouthRound: 0.2 + 0.3 * noise1(c.t / 5, 8),
        mouthW: 0.85 + 0.15 * noise1(c.t / 6, 2),
        head: c.pose.head + 0.05 * noise1(c.t / 7, 5),
        aFsh: c.pose.aFsh + 0.3 + 0.15 * Math.max(0, osc(c.t, 26)),
        aFel: c.pose.aFel + 0.6,
        hFopen: 1,
      };
    },
  },

  think: {
    kind: "override",
    description: "Hand to chin, other arm across the belly, head tilted, finger tapping.",
    fn: (c) => {
      const chin = c.self("chin");
      const tap = c.t > 18 ? Math.max(0, osc(c.t, 10)) : 0;
      const tF = add(chin, v(c.fwd * 6, 10 + tap * 4));
      const ikF = reachAngles(c.spec, c.pose, "F", tF);
      const belly = c.self("belly");
      const ikB = reachAngles(c.spec, c.pose, "B", add(belly, v(c.fwd * 18, -6)));
      return {
        aFsh: ikF.sh,
        aFel: ikF.el,
        aFwr: -0.4,
        hFopen: 0.2,
        hFpoint: 0.7,
        aBsh: ikB.sh,
        aBel: ikB.el,
        aBwr: -0.8,
        hBopen: 0.5,
        head: c.pose.head - 0.12 + 0.03 * osc(c.t, 60),
        lean: c.pose.lean - 0.03,
      };
    },
  },

  react: {
    kind: "override",
    description: "Startle reaction: snap into a flinch (shrug, arms up, lean back) then settle with spring overshoot. params: strength.",
    fn: (c) => {
      const k = Number(c.params.strength ?? 1);
      const snap = springStep(c.t / 30, 2.4, 0.38);
      const hold = 1 - 0.35 * progress(c.t, 4, 18);
      const a = snap * hold * k;
      return {
        lean: c.pose.lean - 0.16 * a,
        chest: c.pose.chest - 0.08 * a,
        head: c.pose.head - 0.1 * a,
        shrug: c.pose.shrug + 16 * a,
        aFsh: lerp(c.pose.aFsh, 0.95, a),
        aFel: lerp(c.pose.aFel, 1.9, a),
        aBsh: lerp(c.pose.aBsh, 0.75, a),
        aBel: lerp(c.pose.aBel, 2.0, a),
        hFopen: 1,
        hBopen: 1,
        squash: 1 + 0.06 * a * Math.exp(-c.t / 6),
      };
    },
  },

  celebrate: {
    kind: "override",
    description: "Fist-pumping V arms with knee bounce and head thrown back.",
    fn: (c) => {
      const pump = osc(c.t, 13);
      const pumpB = osc(c.t, 13, 0.3);
      const bounce = Math.abs(Math.sin((Math.PI * c.t) / 13));
      return {
        aFsh: 2.5 + 0.18 * pump,
        aFel: 0.35 + 0.45 * Math.max(0, pump),
        aBsh: 2.3 + 0.18 * pumpB,
        aBel: 0.35 + 0.45 * Math.max(0, pumpB),
        armGrav: 0.3,
        hFopen: 0,
        hBopen: 0,
        hipY: c.pose.hipY - 10 * (1 - bounce),
        head: c.pose.head - 0.16,
        lean: c.pose.lean - 0.07,
        squash: 1 + 0.03 * bounce,
      };
    },
  },

  armsUp: {
    kind: "override",
    description: "'Surprise!' pose: quick dip (anticipation), then arms snap up in a V with overshoot, chest out.",
    fn: (c) => {
      const dip = progress(c.t, 0, 4, ease.outQuad) * (1 - progress(c.t, 4, 8));
      const up = progress(c.t, 4, 15, ease.outBack);
      return {
        aFsh: lerp(-0.3, 2.45, up),
        aFel: lerp(0.8, 0.25, up),
        aBsh: lerp(-0.4, 2.2, up),
        aBel: lerp(0.8, 0.3, up),
        armGrav: lerp(0.85, 0.2, up),
        hFopen: 1,
        hBopen: 1,
        shrug: c.pose.shrug - 6 * dip + 4 * up,
        hipY: c.pose.hipY - 16 * dip,
        chest: c.pose.chest - 0.1 * up,
        head: c.pose.head - 0.12 * up,
        squash: 1 - 0.06 * dip + 0.05 * up * Math.exp(-Math.max(0, c.t - 8) / 6),
      };
    },
  },

  panic: {
    kind: "override",
    description: "Arms flailing above the head with irregular rhythm, head jitter, wobbling lean.",
    fn: (c) => {
      const r = Number(c.params.rate ?? 1);
      const t = c.t * r;
      return {
        aFsh: 2.2 + 0.55 * Math.sin(t * 0.95) + 0.15 * noise1(t / 4, 1),
        aFel: 0.7 + 0.6 * Math.sin(t * 1.6 + 1),
        aBsh: 2.0 + 0.55 * Math.sin(t * 1.15 + 2.1),
        aBel: 0.8 + 0.6 * Math.sin(t * 1.4 + 0.3),
        armGrav: 0.25,
        hFopen: 1,
        hBopen: 1,
        head: c.pose.head + 0.1 * noise1(t / 3, 6),
        shrug: c.pose.shrug + 10,
        lean: c.pose.lean + 0.08 * noise1(t / 9, 2),
      };
    },
  },

  duck: {
    kind: "override",
    description: "Cower: crouch, shoulders up, both forearms shielding the head.",
    fn: (c) => {
      const k = progress(c.t, 0, 6, ease.outCubic);
      const head = c.self("headTop");
      const ikF = reachAngles(c.spec, c.pose, "F", add(head, v(c.fwd * 22, -6)));
      const ikB = reachAngles(c.spec, c.pose, "B", add(head, v(-c.fwd * 14, -10)));
      return {
        hipY: c.pose.hipY - legLength(c.spec) * 0.22 * k,
        lean: c.pose.lean + 0.18 * k,
        neck: c.pose.neck + 0.25 * k,
        shrug: c.pose.shrug + 12 * k,
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: ikB.sh,
        aBel: ikB.el,
        hFopen: 1,
        hBopen: 1,
      };
    },
  },

  push: {
    kind: "override",
    description: "Lean into a target with both hands, knees bent, effort tremble.",
    fn: (c) => {
      const tgt = c.target(c.params.target as TargetRef);
      const effort = 1 + 0.02 * noise1(c.t / 2, 3);
      const body: Pose = { ...c.pose, lean: c.pose.lean + 0.26, chest: c.pose.chest + 0.06, hipY: c.pose.hipY - 24 };
      const ikF = reachAngles(c.spec, body, "F", add(tgt, v(0, -8)));
      const ikB = reachAngles(c.spec, body, "B", add(tgt, v(0, 10)));
      return {
        lean: body.lean * effort,
        chest: body.chest,
        hipY: body.hipY,
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: ikB.sh,
        aBel: ikB.el,
        aFwr: -1.2,
        aBwr: -1.2,
        hFopen: 1,
        hBopen: 1,
      };
    },
  },

  pull: {
    kind: "override",
    description: "Grip a target with both hands and lean back, tugging rhythmically.",
    fn: (c) => {
      const tgt = c.target(c.params.target as TargetRef);
      const tug = Math.max(0, osc(c.t, 14));
      const body: Pose = { ...c.pose, lean: c.pose.lean - 0.28 - 0.07 * tug, hipY: c.pose.hipY - 18 - 6 * tug };
      const ikF = reachAngles(c.spec, body, "F", add(tgt, v(0, -6)));
      const ikB = reachAngles(c.spec, body, "B", add(tgt, v(0, 8)));
      return {
        lean: body.lean,
        hipY: body.hipY,
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: ikB.sh,
        aBel: ikB.el,
        hFopen: 0,
        hBopen: 0,
        head: c.pose.head - 0.1,
      };
    },
  },

  pickUp: {
    kind: "override",
    description: "Bend down (pelvis lowers, spine folds), grab a floor target, rise to a carry position.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      // The grab point is frozen at the grab moment: once the prop is attached
      // to this hand, chasing its live position would feed back into the IK.
      const grabFrame = c.frame - c.t + Math.round(c.dur * 0.45);
      const tgt = c.targetAt(c.params.target as TargetRef, Math.min(c.frame, grabFrame));
      const down = progress(c.u, 0, 0.42, ease.inOutCubic);
      const rise = progress(c.u, 0.55, 1, ease.inOutCubic);
      const k = down * (1 - rise);
      const body: Pose = {
        ...c.pose,
        hipY: c.pose.hipY - legLength(c.spec) * 0.42 * k,
        lean: c.pose.lean + 0.6 * k,
        chest: c.pose.chest + 0.15 * k,
        neck: c.pose.neck + 0.1 * k,
      };
      const carry = add(c.self("chest", body), v(c.fwd * 48, 26));
      const goal = rise > 0 ? vlerp(tgt, carry, rise) : tgt;
      const ik = reachAngles(c.spec, body, side, goal);
      return {
        hipY: body.hipY,
        lean: body.lean,
        chest: body.chest,
        neck: body.neck,
        ...arm(side, ik.sh, ik.el, 0.2),
        ...hand(side, c.u < 0.45 ? 1 : 0),
      };
    },
  },

  handOver: {
    kind: "override",
    description: "Extend an open palm toward another character (give or receive). params: to (char id), side, height.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      const other = c.target({ char: String(c.params.to), part: "chest" });
      const me = c.self("chest");
      const mid = vlerp(me, other, 0.5);
      const tgt = add(mid, v(0, Number(c.params.height ?? 10)));
      const r = reachWithLean(c, side, tgt, 0.3);
      return {
        ...r.body,
        ...arm(side, r[side === "F" ? "aFsh" : "aBsh"] ?? 0, r[side === "F" ? "aFel" : "aBel"] ?? 0, -0.7),
        ...hand(side, 1),
      };
    },
  },

  hold: {
    kind: "override",
    description: "Both hands grip either side of a target (a prop or a point), e.g. carrying a box. params: target, width.",
    fn: (c) => {
      const tgt = c.target(c.params.target as TargetRef);
      const w = Number(c.params.width ?? 70) / 2;
      // Same poles as holdPath so the two can crossfade without elbow flips.
      const ikF = reachAngles(c.spec, c.pose, "F", add(tgt, v(c.fwd * w * 0.55, 6)), HOLD_POLE_F);
      const ikB = reachAngles(c.spec, c.pose, "B", add(tgt, v(-c.fwd * w * 0.55, 0)), HOLD_POLE_B);
      return { aFsh: ikF.sh, aFel: ikF.el, aBsh: ikB.sh, aBel: ikB.el, hFopen: 0.2, hBopen: 0.2, aFwr: -0.4, aBwr: -0.4 };
    },
  },

  holdPath: {
    kind: "override",
    description: "Both hands follow a keyed path relative to a self anchor (lift something off the head, toss aside). params: anchor, path [[u,dx,dy],...], width.",
    fn: (c) => {
      const anchor = c.self((c.params.anchor as AnchorPart) ?? "head");
      const path = (c.params.path as [number, number, number][]) ?? [[0, 0, 0]];
      let off = v(path[0][1], path[0][2]);
      for (let i = 0; i < path.length - 1; i++) {
        const [u0, x0, y0] = path[i];
        const [u1, x1, y1] = path[i + 1];
        if (c.u >= u0 && c.u <= u1) {
          const e = ease.inOutCubic(clamp01((c.u - u0) / (u1 - u0 || 1)));
          off = v(lerp(x0, x1, e), lerp(y0, y1, e));
        } else if (c.u > u1) off = v(x1, y1);
      }
      const tgt = add(anchor, v(off.x * c.fwd, off.y));
      const w = Number(c.params.width ?? 120) / 2;
      const ikF = reachAngles(c.spec, c.pose, "F", add(tgt, v(c.fwd * w * 0.55, 6)), HOLD_POLE_F);
      const ikB = reachAngles(c.spec, c.pose, "B", add(tgt, v(-c.fwd * w * 0.55, 0)), HOLD_POLE_B);
      return { aFsh: ikF.sh, aFel: ikF.el, aBsh: ikB.sh, aBel: ikB.el, hFopen: 0.3, hBopen: 0.3, aFwr: -0.4, aBwr: -0.4 };
    },
  },

  coverMouth: {
    kind: "override",
    description: "Both hands clapped over the mouth, shoulders up; optional giggle shake. params: giggle (0..1).",
    fn: (c) => {
      const g = Number(c.params.giggle ?? 0) * progress(c.t, 10, 24);
      const shake = g * Math.sin(c.t * 2.1);
      const m = c.self("mouth");
      const ikF = reachAngles(c.spec, c.pose, "F", add(m, v(c.fwd * 16, 6 + shake * 2)), v(-0.2, 1));
      const ikB = reachAngles(c.spec, c.pose, "B", add(m, v(c.fwd * 6, 14 + shake * 2)), v(-0.4, 1));
      return {
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: ikB.sh,
        aBel: ikB.el,
        aFwr: -0.6,
        aBwr: -0.6,
        hFopen: 1,
        hBopen: 1,
        shrug: c.pose.shrug + 10 + 3 * shake,
        lean: c.pose.lean - 0.04 + 0.02 * shake,
        head: c.pose.head + 0.06,
      };
    },
  },

  laugh: {
    kind: "override",
    description: "Belly laugh: head thrown back, hand on belly, body shaking, alternating rock back/forward.",
    fn: (c) => {
      const k = Number(c.params.intensity ?? 1);
      const shake = Math.sin(c.t * 1.9) * k;
      const rock = ease.inOutSine((osc(c.t, 44, -0.25) + 1) / 2); // 0 back .. 1 forward
      const lean = lerp(-0.2, 0.16, rock) + 0.03 * shake;
      const body: Pose = { ...c.pose, lean, hipY: c.pose.hipY - 6 - 6 * rock - 3 * Math.abs(shake) };
      const belly = c.self("belly", body);
      const ikF = reachAngles(c.spec, body, "F", add(belly, v(c.fwd * 8, 4)));
      const knee = add(c.self("pelvis", body), v(c.fwd * 40, 50));
      const slap = Math.max(0, osc(c.t, 22));
      const ikB = reachAngles(c.spec, body, "B", add(knee, v(0, -30 * (1 - slap))));
      return {
        lean,
        hipY: body.hipY,
        chest: c.pose.chest - 0.05 + 0.12 * rock,
        neck: lerp(-0.28, 0.06, rock),
        head: lerp(-0.25, 0.05, rock) + 0.05 * shake,
        shrug: c.pose.shrug + 4 + 3 * shake,
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: lerp(ikB.sh, 1.8, 1 - rock),
        aBel: lerp(ikB.el, 1.2, 1 - rock),
        hFopen: 1,
        hBopen: 1,
        squash: 1 + 0.02 * shake,
      };
    },
  },

  blow: {
    kind: "override",
    description: "Inhale (chest up, cheeks puff), then lean in and blow at a target. params: target, inhale (0..1 split).",
    fn: (c) => {
      const split = Number(c.params.inhale ?? 0.4);
      const inhale = progress(c.u, 0, split, ease.outCubic);
      const blow = progress(c.u, split, split + 0.12, ease.outCubic);
      const tgt = c.params.target ? c.target(c.params.target as TargetRef) : undefined;
      const toward = tgt ? clamp((tgt.y - c.self("mouth").y) / 200, -0.3, 0.3) : 0;
      return {
        lean: c.pose.lean + 0.1 * inhale - 0.06 * inhale * (1 - blow) + 0.12 * blow,
        chest: c.pose.chest - 0.06 * inhale * (1 - blow) + 0.05 * blow,
        neck: c.pose.neck + 0.15 * blow + toward,
        head: c.pose.head + toward * 0.6,
        shrug: c.pose.shrug + 8 * inhale * (1 - blow),
        puff: inhale * (1 - blow * 0.75),
        mouthRound: 1,
        mouthOpen: 0.08 + 0.25 * blow,
        mouthW: 0.42,
        aFsh: -0.35,
        aFel: 0.5,
        aBsh: -0.45,
        aBel: 0.6,
        hFopen: 0.4,
        hBopen: 0.4,
      };
    },
  },

  hornBlow: {
    kind: "override",
    description: "Hold a party horn to the mouth and blow (cheeks pulse), free arm thrown up.",
    fn: (c) => {
      const m = c.self("mouth");
      const ikF = reachAngles(c.spec, c.pose, "F", add(m, v(c.fwd * 14, 10)), v(0, 1));
      const pulse = Math.max(0, osc(c.t, 9));
      return {
        aFsh: ikF.sh,
        aFel: ikF.el,
        aFwr: -1.3,
        hFopen: 0,
        aBsh: 2.35 + 0.12 * osc(c.t, 13),
        aBel: 0.4,
        armGrav: 0.4,
        hBopen: 1,
        head: c.pose.head - 0.2,
        neck: c.pose.neck - 0.1,
        puff: 0.5 + 0.5 * pulse,
        mouthRound: 1,
        mouthW: 0.4,
        mouthOpen: 0.1,
        lean: c.pose.lean - 0.06,
      };
    },
  },

  shrug: {
    kind: "override",
    description: "Shoulders up, palms up and out, head tilt: 'what can you do?'.",
    fn: (c) => {
      const k = Math.pow(Math.sin(Math.PI * clamp01(c.u * 1.05)), 0.5);
      return {
        shrug: c.pose.shrug + 16 * k,
        aFsh: 0.35,
        aFel: 1.45,
        aFwr: -1.1,
        aBsh: 0.15,
        aBel: 1.6,
        aBwr: -1.1,
        hFopen: 1,
        hBopen: 1,
        head: c.pose.head - 0.18 * k,
      };
    },
  },

  wave: {
    kind: "override",
    description: "Arm raised, forearm waving side to side.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      return {
        ...arm(side, 2.55, 0.35 + 0.55 * (0.5 + 0.5 * osc(c.t, 9)), -0.2),
        ...hand(side, 1),
        armGrav: 0.4,
      };
    },
  },

  sneak: {
    kind: "override",
    description: "Cartoon sneaking upper body: hunched, hands raised with drooping wrists.",
    fn: (c) => ({
      aFsh: 0.8,
      aFel: 1.45,
      aFwr: 1.15,
      aBsh: 0.6,
      aBel: 1.6,
      aBwr: 1.1,
      armGrav: 0.5,
      hFopen: 0.6,
      hBopen: 0.6,
      shrug: c.pose.shrug + 8,
      lean: c.pose.lean + 0.1,
      neck: c.pose.neck + 0.16,
    }),
  },

  lookAround: {
    kind: "override",
    description: "Scan the surroundings: eyes lead, head follows a beat later.",
    fn: (c) => {
      const e = osc(c.t, 56);
      const h = osc(c.t - 6, 56);
      return { eyeX: 0.9 * e, faceTurn: 0.35 + 0.35 * h, eyeY: -0.2 + 0.15 * osc(c.t, 28) };
    },
  },

  flail: {
    kind: "override",
    description: "Airborne fright flail: arms windmill outward, legs handled by locomotion.",
    fn: (c) => ({
      aFsh: 2.0 + 0.75 * Math.sin(c.t * 0.58),
      aFel: 0.5 + 0.45 * Math.sin(c.t * 0.85 + 0.5),
      aBsh: 1.6 + 0.75 * Math.sin(c.t * 0.58 + 2.4),
      aBel: 0.6 + 0.45 * Math.sin(c.t * 0.75 + 1.5),
      armGrav: 0.2,
      hFopen: 1,
      hBopen: 1,
      shrug: c.pose.shrug + 12,
    }),
  },

  dazedSway: {
    kind: "additive",
    description: "Additive woozy sway of torso and head (after a bonk).",
    fn: (c) => ({
      lean: 0.06 * Math.sin(c.t / 7),
      head: 0.07 * Math.sin(c.t / 7 + 1.2),
      hipX: 6 * Math.sin(c.t / 7 + 0.4),
    }),
  },

  giggle: {
    kind: "additive",
    description: "Additive suppressed-laughter shake of shoulders and chest.",
    fn: (c) => ({ shrug: 3 * Math.sin(c.t * 2.2), chest: 0.025 * Math.sin(c.t * 2.2 + 0.5), head: 0.02 * Math.sin(c.t * 2.2 + 1) }),
  },

  // ------------------------------------------------------------ throw/catch
  throw: {
    kind: "override",
    description:
      "Throw with anticipation: wind-up (weight back, arm cocked), accelerating whip to the release frame, follow-through past the target, settle. params: side, target (aim), release (frame offset of the release), style ('underhand' | 'overhand'), power (0.5..1.5).",
    fn: (c) => {
      const side = sideOf(c.params.side);
      const other: Side = side === "F" ? "B" : "F";
      const r = Number(c.params.release ?? Math.round(c.dur * 0.6));
      const p = Number(c.params.power ?? 1);
      const over = c.params.style === "overhand";
      const sh0 = c.pose[side === "F" ? "aFsh" : "aBsh"];
      // aim: direction from shoulder to target, kept in a sane release band
      const tgt = c.target(c.params.target as TargetRef);
      const shp = c.self(side === "F" ? "shoulderF" : "shoulderB");
      const d = sub(tgt, shp);
      const aim = clamp(Math.atan2(d.x * c.fwd, d.y), 0.9, 2.5);
      const windT = Math.max(4, r - (over ? 6 : 7));
      const wind = progress(c.t, 0, windT, ease.inOutCubic);
      const whip = progress(c.t, windT, r, ease.inQuad);
      const follow = progress(c.t, r, r + 9, ease.outCubic);
      const settle = progress(c.t, r + 9, r + 22, ease.inOutSine);
      // cocked pose (tension tremble during the hold before the whip)
      const tremble = 0.03 * Math.sin(c.t * 2.1) * wind * (1 - whip);
      const cockSh = over ? 3.45 : -0.95 * p;
      const cockEl = over ? 1.95 : 0.3;
      const followSh = over ? 0.55 : aim + 0.7;
      const followEl = over ? 0.55 : 0.25;
      let sh = lerp(sh0, cockSh, wind) + tremble;
      let el = lerp(c.pose[side === "F" ? "aFel" : "aBel"], cockEl, wind);
      sh = lerp(sh, aim, whip);
      el = lerp(el, 0.12, whip);
      sh = lerp(sh, followSh, follow);
      el = lerp(el, followEl, follow);
      sh = lerp(sh, lerp(followSh, 0.35, 0.5), settle * 0.6);
      // counterbalancing other arm swings opposite
      const oSh = lerp(c.pose[other === "F" ? "aFsh" : "aBsh"], over ? 1.2 : 0.9, wind) - 1.1 * whip * (1 - settle * 0.5);
      // weight: back on the wind, forward through the release
      const weight = -0.14 * p * wind * (1 - whip) + 0.2 * p * whip * (1 - settle * 0.6);
      return {
        ...arm(side, sh, el, over ? -0.3 * wind : 0.2),
        ...arm(other, oSh, 0.5 + 0.3 * wind),
        ...hand(side, c.t < r ? 0.15 : lerp(0.15, 1, follow)),
        ...hand(other, 0.7),
        lean: c.pose.lean + weight,
        chest: c.pose.chest + 0.5 * weight,
        head: c.pose.head - 0.4 * weight,
        hipY: c.pose.hipY - 14 * p * wind * (1 - whip) - 6 * whip * (1 - settle),
        shrug: c.pose.shrug + 6 * wind * (1 - whip),
        squash: 1 - 0.04 * wind * (1 - whip) + 0.05 * whip * (1 - follow),
      };
    },
  },

  catch: {
    kind: "override",
    description:
      "Two-handed catch: hands open toward the catch point, widen just before contact, then absorb the impact (hands recoil to the chest, lean back, spring settle). params: target (catch point), at (frame offset of contact), width.",
    fn: (c) => {
      const at = Number(c.params.at ?? Math.round(c.dur * 0.5));
      const w = Number(c.params.width ?? 60) / 2;
      const tgt = c.target(c.params.target as TargetRef);
      const chest = c.self("chest");
      const ready = progress(c.t, 0, Math.min(at, 10), ease.outCubic);
      const widen = progress(c.t, at - 5, at - 1, ease.outQuad) * (1 - progress(c.t, at, at + 2));
      const hit = c.t >= at ? springStep((c.t - at) / 30, 2.6, 0.45) : 0;
      const absorb = c.t >= at ? Math.exp(-(c.t - at) / 7) : 0;
      // after contact the hands carry the ball toward the chest
      const hold = add(chest, v(c.fwd * 46, -6));
      const pt = vlerp(tgt, hold, clamp(hit, 0, 1.15));
      const spread = w + 26 * widen - 8 * clamp(hit, 0, 1);
      const ikF = reachAngles(c.spec, c.pose, "F", add(pt, v(c.fwd * spread * 0.6, 4)), HOLD_POLE_F);
      const ikB = reachAngles(c.spec, c.pose, "B", add(pt, v(-c.fwd * spread * 0.6, -2)), HOLD_POLE_B);
      return {
        aFsh: ikF.sh,
        aFel: ikF.el,
        aBsh: ikB.sh,
        aBel: ikB.el,
        aFwr: -0.4,
        aBwr: -0.4,
        hFopen: lerp(1, 0.3, clamp(hit, 0, 1)),
        hBopen: lerp(1, 0.3, clamp(hit, 0, 1)),
        hipY: c.pose.hipY - 10 * ready - 14 * absorb,
        lean: c.pose.lean + 0.06 * ready - 0.14 * absorb,
        head: c.pose.head - 0.08 * absorb,
        squash: 1 - 0.05 * absorb,
      };
    },
  },

  rubHead: {
    kind: "override",
    description: "Rub a sore head: hand to the back/top of the head (arm stays clear of the face) with small circular rubs, wince lean. params: side, rate.",
    fn: (c) => {
      const side = sideOf(c.params.side);
      const rate = Number(c.params.rate ?? 1);
      const top = c.self("headTop");
      const ph = (c.t * rate) / 7;
      const tgt = add(top, v(-c.fwd * (22 + 9 * Math.cos(ph)), -4 + 6 * Math.sin(ph)));
      const ik = reachAngles(c.spec, c.pose, side, tgt, v(0.6, 1));
      return {
        ...arm(side, ik.sh, ik.el, -0.6),
        ...hand(side, 0.8),
        head: c.pose.head + 0.08 + 0.03 * Math.sin(ph),
        shrug: c.pose.shrug + 5,
        lean: c.pose.lean + 0.04,
      };
    },
  },

  eat: {
    kind: "override",
    description:
      "Bring the held food to the mouth and take bites: mouth opens wide in anticipation, snaps shut on each bite frame (head dips into it, hand tears away and recoils), then happy chewing. params: side, bites (frame offsets, default [10]), reach (px forward from mouth to hand), drop (px below the mouth), chew (0..1 chewing after the last bite).",
    fn: (c) => {
      const side = sideOf(c.params.side);
      const bites = (c.params.bites as number[] | undefined) ?? [10];
      const reachPx = Number(c.params.reach ?? 46);
      const drop = Number(c.params.drop ?? 12);
      // nearest bite around now: anticipation (open) before, snap + tear after
      let open = 0;
      let tear = 0;
      let dip = 0;
      let approach = 0;
      for (const b of bites) {
        const d = c.t - b;
        if (d < 0 && d >= -5) open = Math.max(open, ease.outQuad((d + 5) / 5));
        // the food comes to the open mouth, then the jaw snaps shut on it
        if (d < 0 && d >= -7) approach = Math.max(approach, ease.inOutSine((d + 7) / 7));
        if (d >= 0 && d < 3) approach = Math.max(approach, 1 - d / 3);
        if (d >= 0 && d < 14) {
          tear = Math.max(tear, Math.exp(-d / 4) * Math.sin(Math.min(1, d / 2) * Math.PI * 0.5));
          dip = Math.max(dip, Math.exp(-d / 3));
        }
        if (d < 0 && d >= -5) dip = Math.max(dip, -0.4 * ((d + 5) / 5));
      }
      const last = bites[bites.length - 1];
      const chewing = c.t > last + 2 ? Number(c.params.chew ?? 1) : 0;
      const chew = chewing * (0.5 + 0.5 * Math.sin(((c.t - last) / 6.5) * 2 * Math.PI));
      const raise = progress(c.t, 0, Math.max(4, bites[0] - 4), ease.inOutCubic);
      // hand holds the food just in front of the mouth; tears away on each bite
      // Bites happen in profile: the face turns so the mouth reaches the head's
      // silhouette edge and the food only overlaps the mouth, never the face.
      const prof = Math.max(approach, 0.6 * Math.max(0, 1 - Math.abs(tear - 0.5) * 2) * (tear > 0 ? 1 : 0));
      const mouthP = c.self("mouth", { ...c.pose, faceTurn: lerp(c.pose.faceTurn, 0.98, prof) });
      const hold = add(mouthP, v(c.fwd * (reachPx - 8 * approach + 22 * tear), drop - 6 * approach + 30 * tear));
      const start = c.self(side === "F" ? "handF" : "handB");
      const goal = vlerp(start, hold, raise);
      const ik = reachAngles(c.spec, c.pose, side, goal);
      return {
        ...arm(side, ik.sh, ik.el, -0.5),
        ...hand(side, 0.15),
        faceTurn: lerp(c.pose.faceTurn, 0.98, prof),
        eyeX: lerp(c.pose.eyeX, 0.6, prof),
        neck: c.pose.neck + 0.12 * dip + 0.05 * raise,
        head: c.pose.head + 0.14 * dip - 0.04 * chew,
        lean: c.pose.lean + 0.03 * dip,
        mouthOpen: Math.max(1.05 * open, 0.12 + 0.22 * chew),
        mouthRound: 0.2 * open,
        mouthW: 1 - 0.2 * chew,
        teeth: open > 0.2 ? 1 : 0,
        puff: c.pose.puff + 0.45 * chewing,
        mouthX: 0.18 * Math.sin(((c.t - last) / 6.5) * 2 * Math.PI) * chewing,
        squash: 1 - 0.035 * dip,
      };
    },
  },

  hit: {
    kind: "override",
    description:
      "Physical impact reaction from a direction: the hit part snaps away from the impact (head whip / body squash), knees buckle, arms fling out and dangle, then a damped spring settles back. params: from ('top' | 'front' | 'back'), strength.",
    fn: (c) => {
      const k = Number(c.params.strength ?? 1);
      const from = String(c.params.from ?? "top");
      const s = springStep(c.t / 30, 2.2, 0.32); // 0 -> overshoot -> 1
      const imp = Math.exp(-c.t / 5); // sharp impulse
      const a = (1 - s * 0.85) * k * (c.t > 0 ? 1 : 0) + imp * 0.3 * k;
      const fling = progress(c.t, 0, 3, ease.outQuad) * (1 - progress(c.t, 6, 20, ease.inOutSine));
      const dirFwd = from === "front" ? -1 : from === "back" ? 1 : 0;
      const top = from === "top" ? 1 : 0.35;
      return {
        // vertical impact: squash + buckle; horizontal: whip away from the hit
        squash: 1 - 0.14 * a * top,
        hipY: c.pose.hipY - 34 * a * top,
        neck: c.pose.neck + (0.22 * top + 0.3 * dirFwd) * a,
        head: c.pose.head + (0.2 * top + 0.35 * dirFwd) * a,
        lean: c.pose.lean + (0.08 * top + 0.22 * dirFwd) * a,
        shrug: c.pose.shrug + 14 * fling * k,
        aFsh: lerp(c.pose.aFsh, 1.35 + 0.4 * dirFwd, fling * k),
        aFel: lerp(c.pose.aFel, 0.35, fling),
        aBsh: lerp(c.pose.aBsh, 1.05 + 0.4 * dirFwd, fling * k),
        aBel: lerp(c.pose.aBel, 0.4, fling),
        hFopen: 1,
        hBopen: 1,
      };
    },
  },

  offset: {
    kind: "additive",
    description: "Generic additive pose offset (params: any pose channels). With long blend-in it makes a slow 'creep' / moving hold.",
    fn: (c) => {
      const out: PartialPose = {};
      for (const [k, val] of Object.entries(c.params)) if (typeof val === "number") (out as Record<string, number>)[k] = val;
      return out;
    },
  },

  nod: {
    kind: "additive",
    description: "Additive head nods.",
    fn: (c) => ({ head: 0.12 * Math.max(0, osc(c.t, 14)), neck: 0.05 * Math.max(0, osc(c.t, 14, -0.1)) }),
  },
};

/**
 * Externally authored clips (Blender -> blender/clips/export_clip.py -> JSON).
 * Each JSON in src/clips becomes a regular named clip.
 */
export const KEYED_CLIPS: Record<string, KeyedClipData> = { warmUp: warmUp as KeyedClipData };
for (const [name, data] of Object.entries(KEYED_CLIPS)) CLIPS[name] = keyedClip(data);

export const CLIP_NAMES = Object.keys(CLIPS);

/** Default elbow pole re-exported for clip authors. */
export { ELBOW_POLE, solvePose, anchorPoint };
