import {
  add,
  angleOf,
  clamp,
  dir,
  len,
  rotate,
  scale,
  sub,
  v,
  wrapAngle,
  type Vec2,
} from "./math";
import type { CharacterSpec, Joints, Pose } from "./types";

// ---------------------------------------------------------------------------
// Hierarchy (parent -> child), solved every frame:
//
//   root ─ pelvis ─ spineMid ─ chest ─┬─ neckTop ─ head
//                │                     ├─ shoulderF ─ elbowF ─ wristF (hand)
//                │                     └─ shoulderB ─ elbowB ─ wristB (hand)
//                ├─ hipF ─ kneeF ─ ankleF (foot)   ← two-bone IK to foot target
//                └─ hipB ─ kneeB ─ ankleB (foot)   ← two-bone IK to foot target
// ---------------------------------------------------------------------------

/** Lowest shoulder angle (arm swung behind the back), radians. */
export const SHOULDER_MIN = -1.6;

export const JOINT_LIMITS = {
  elbow: [-0.1, 2.75] as const,
  knee: [-2.8, 0] as const,
  neck: [-0.55, 0.55] as const,
  head: [-0.5, 0.5] as const,
};

/** "Up" vector for a spine segment leaning `a` radians forward. */
export const up = (a: number): Vec2 => ({ x: Math.sin(a), y: -Math.cos(a) });

export const legLength = (s: CharacterSpec) => s.thigh + s.shin;
export const standHipHeight = (s: CharacterSpec) => legLength(s) * 0.975 + s.ankleH;

/** Neutral standing pose, feet a little apart, relaxed arms. */
export const restPose = (s: CharacterSpec, x = 0, floorY = 0, facing = 1): Pose => ({
  x,
  y: floorY,
  facing,
  bodyRot: 0,
  hipY: standHipHeight(s),
  hipX: 0,
  lean: 0.02,
  chest: 0.0,
  neck: 0.04,
  head: 0.0,
  squash: 1,
  shrug: 0,
  aFsh: 0.1,
  aFel: 0.28,
  aFwr: 0.1,
  aBsh: -0.08,
  aBel: 0.32,
  aBwr: 0.1,
  armGrav: 0.85,
  hFopen: 0.3,
  hFpoint: 0,
  hBopen: 0.3,
  hBpoint: 0,
  fFx: x + 12 * Math.sign(facing || 1),
  fFy: floorY - s.ankleH,
  fFrot: 0,
  fBx: x - 12 * Math.sign(facing || 1),
  fBy: floorY - s.ankleH,
  fBrot: 0,
  plantF: 1,
  plantB: 1,
  faceTurn: 0.55,
  eyeX: 0.35,
  eyeY: 0,
  blink: 0,
  lidTop: 0,
  squint: 0,
  eyeScale: 1,
  pupil: 1,
  browY: 0,
  browTilt: 0,
  browAsym: 0,
  mouthW: 1,
  mouthOpen: 0,
  smile: 0.25,
  mouthRound: 0,
  mouthX: 0,
  teeth: 0,
  cheek: 0.25,
  puff: 0,
  sweat: 0,
  crossEye: 0,
  hairSwing: 0,
  hairStretch: 1,
});

// ---------------------------------------------------------------------------
// Two-bone analytic IK with a pole vector choosing the bend side.
// ---------------------------------------------------------------------------
export interface IKResult {
  joint: Vec2;
  end: Vec2;
  upperAngle: number;
  lowerRel: number;
  reached: boolean;
}

export const solveTwoBone = (
  a: Vec2,
  target: Vec2,
  l1: number,
  l2: number,
  pole: Vec2,
): IKResult => {
  const d0 = sub(target, a);
  const raw = len(d0);
  const u = raw < 1e-6 ? { x: 0, y: 1 } : scale(d0, 1 / raw);
  const minD = Math.abs(l1 - l2) + 1e-3;
  const maxD = l1 + l2 - 1e-4;
  const d = clamp(raw, minD, maxD);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  let n = { x: -u.y, y: u.x };
  if (n.x * pole.x + n.y * pole.y < 0) n = { x: -n.x, y: -n.y };
  const joint = add(a, add(scale(u, l1 * cosA), scale(n, l1 * sinA)));
  const end = add(a, scale(u, d));
  const upperAngle = angleOf(sub(joint, a));
  const lowerRel = wrapAngle(angleOf(sub(end, joint)) - upperAngle);
  return { joint, end, upperAngle, lowerRel, reached: raw <= maxD + 1e-3 };
};

/** Forward kinematics for a two-bone chain from angles (rig convention). */
const chain = (a: Vec2, upperAngle: number, rel: number, l1: number, l2: number) => {
  const j = add(a, scale(dir(upperAngle), l1));
  const e = add(j, scale(dir(upperAngle + rel), l2));
  return { j, e, lowerAngle: upperAngle + rel };
};

export const ELBOW_POLE = v(-0.25, 1);
export const KNEE_POLE = v(1, 0.12);

/**
 * Visual mirror factor during turns. The body narrows to about a third of its
 * width (reads as the torso rotating through a front view) while the renderer
 * keeps the head round and turns the face to camera — the classic cartoon
 * turn, instead of a paper-thin edge-on frame.
 */
export const TURN_MIN_SCALE = 0.34;
export const facingScale = (facing: number) => {
  const s = facing >= 0 ? 1 : -1;
  return s * Math.max(TURN_MIN_SCALE, Math.abs(facing));
};

export const makeTransforms = (pose: Pose) => {
  const sx = facingScale(pose.facing);
  const root = v(pose.x, pose.y);
  const toWorld = (p: Vec2): Vec2 => {
    const r = rotate(p, pose.bodyRot);
    return v(root.x + r.x * sx, root.y + r.y);
  };
  const toLocal = (p: Vec2): Vec2 => {
    const q = v((p.x - root.x) / sx, p.y - root.y);
    return rotate(q, -pose.bodyRot);
  };
  return { toWorld, toLocal, sx, root };
};

/** Shoulder pivot in local space (used by IK reach helpers before full solve). */
export const localShoulder = (s: CharacterSpec, pose: Pose, side: "F" | "B") => {
  const P = v(pose.hipX, -pose.hipY);
  const l = (s.torso / 2) * pose.squash;
  const M = add(P, scale(up(pose.lean), l));
  const ta = pose.lean + pose.chest;
  const C = add(M, scale(up(ta), l));
  const sh = add(C, scale(up(ta), pose.shrug - s.torso * 0.1 * pose.squash));
  return add(sh, v(side === "F" ? 4 : -6, 0));
};

/**
 * Resolve a pose into joints. Feet are IK targets; if a planted foot would be
 * out of reach the pelvis drops (never the limb stretching), which is what
 * gives walks and landings their weight.
 */
export const solvePose = (s: CharacterSpec, pose0: Pose): { pose: Pose; joints: Joints } => {
  const pose = { ...pose0 };
  const { toWorld, toLocal } = makeTransforms(pose);
  const L = legLength(s) * 0.999;

  const ankleFL = toLocal(v(pose.fFx, pose.fFy));
  const ankleBL = toLocal(v(pose.fBx, pose.fBy));

  // Pelvis reach constraint (soft, weighted by how planted each foot is).
  const maxHip = (ank: Vec2, hipOffX: number) => {
    const dx = ank.x - (pose.hipX + hipOffX);
    if (Math.abs(dx) >= L) return -ank.y; // degenerate: foot way off, pelvis at foot height
    return Math.sqrt(L * L - dx * dx) - ank.y;
  };
  const limF = maxHip(ankleFL, 3);
  const limB = maxHip(ankleBL, -3);
  let hipY = pose.hipY;
  const plantF = clamp(pose.plantF, 0, 1);
  const plantB = clamp(pose.plantB, 0, 1);
  if (hipY > limF) hipY += (limF - hipY) * plantF;
  if (hipY > limB) hipY += (limB - hipY) * plantB;
  pose.hipY = hipY;

  const P = v(pose.hipX, -pose.hipY);
  const l = (s.torso / 2) * pose.squash;
  const M = add(P, scale(up(pose.lean), l));
  const torsoAngle = pose.lean + pose.chest;
  const C = add(M, scale(up(torsoAngle), l));
  const sh = add(C, scale(up(torsoAngle), pose.shrug - s.torso * 0.1 * pose.squash));
  const shoulderF = add(sh, v(4, 0));
  const shoulderB = add(sh, v(-6, 0));
  const neck = clamp(pose.neck, ...JOINT_LIMITS.neck);
  const headTilt = clamp(pose.head, ...JOINT_LIMITS.head);
  const neckTop = add(C, scale(up(torsoAngle + neck), s.neck * pose.squash));
  const headAngle = torsoAngle + neck + headTilt;
  const headC = add(neckTop, scale(up(headAngle), s.headR * 0.86 * pose.squash));

  const inherit = (1 - pose.armGrav) * torsoAngle;
  const armF = chain(
    shoulderF,
    pose.aFsh - inherit,
    clamp(pose.aFel, ...JOINT_LIMITS.elbow),
    s.upperArm,
    s.foreArm,
  );
  const armB = chain(
    shoulderB,
    pose.aBsh - inherit,
    clamp(pose.aBel, ...JOINT_LIMITS.elbow),
    s.upperArm,
    s.foreArm,
  );

  const hipF = add(P, v(3, 0));
  const hipB = add(P, v(-3, 0));
  const legF = solveTwoBone(hipF, ankleFL, s.thigh, s.shin, KNEE_POLE);
  const legB = solveTwoBone(hipB, ankleBL, s.thigh, s.shin, KNEE_POLE);

  const local = {
    root: v(0, 0),
    pelvis: P,
    spineMid: M,
    chest: C,
    shoulderF,
    shoulderB,
    neckTop,
    headC,
    headAngle,
    elbowF: armF.j,
    wristF: armF.e,
    handAngleF: armF.lowerAngle + pose.aFwr,
    elbowB: armB.j,
    wristB: armB.e,
    handAngleB: armB.lowerAngle + pose.aBwr,
    hipF,
    kneeF: legF.joint,
    ankleF: legF.end,
    footAngleF: pose.fFrot,
    hipB,
    kneeB: legB.joint,
    ankleB: legB.end,
    footAngleB: pose.fBrot,
  };

  const W = toWorld;
  const joints: Joints = {
    root: v(pose.x, pose.y),
    pelvis: W(P),
    spineMid: W(M),
    chest: W(C),
    shoulderF: W(shoulderF),
    shoulderB: W(shoulderB),
    neckTop: W(neckTop),
    headC: W(headC),
    headAngle,
    elbowF: W(armF.j),
    wristF: W(armF.e),
    handAngleF: local.handAngleF,
    elbowB: W(armB.j),
    wristB: W(armB.e),
    handAngleB: local.handAngleB,
    hipF: W(hipF),
    kneeF: W(legF.joint),
    ankleF: W(legF.end),
    footAngleF: pose.fFrot,
    hipB: W(hipB),
    kneeB: W(legB.joint),
    ankleB: W(legB.end),
    footAngleB: pose.fBrot,
    local,
    toWorld,
    toLocal,
  };
  return { pose, joints };
};

// ---------------------------------------------------------------------------
// Hand-space arm blending.
//
// Lerping shoulder and elbow angles independently between two distant poses
// makes the hand swing out on a wide detour (the elbow unfolds and refolds
// while the shoulder turns). Real arms move the hand along an arc around the
// shoulder while the reach distance changes monotonically. So we blend the
// wrist in shoulder-centred polar coordinates (direction + reach) and solve
// the elbow back from the reach. The elbow keeps its bend side, limbs keep
// their length, and the direction follows the same way round as the
// angle-space blend would (never "through the back" unexpectedly).
// ---------------------------------------------------------------------------

/** Wrist relative to the shoulder for (shoulder, elbow) angles: [reach, direction]. */
export const armToPolar = (l1: number, l2: number, sh: number, el: number) => {
  const reach = Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(el)));
  const off = Math.atan2(l2 * Math.sin(el), l1 + l2 * Math.cos(el));
  return { reach, dirAngle: sh + off };
};

/** Inverse of armToPolar for a given elbow bend sign. */
export const armFromPolar = (l1: number, l2: number, reach: number, dirAngle: number, bendSign: 1 | -1) => {
  const r = clamp(reach, Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const cosEl = clamp((r * r - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const el = bendSign * Math.acos(cosEl);
  const off = Math.atan2(l2 * Math.sin(el), l1 + l2 * Math.cos(el));
  return { sh: dirAngle - off, el };
};

/**
 * Blend arm angles A -> B by weight w in hand space. Falls back to plain
 * angle lerp when the elbow changes bend side (no meaningful polar path).
 */
export const blendArmPolar = (
  s: Pick<CharacterSpec, "upperArm" | "foreArm">,
  a: { sh: number; el: number },
  b: { sh: number; el: number },
  w: number,
) => {
  const angle = { sh: a.sh + (b.sh - a.sh) * w, el: a.el + (b.el - a.el) * w };
  if (w <= 0) return { sh: a.sh, el: a.el };
  if (w >= 1) return { sh: b.sh, el: b.el };
  const sa = Math.sign(a.el) || 1;
  const sb = Math.sign(b.el) || 1;
  if (sa !== sb || Math.abs(a.el) < 0.05 || Math.abs(b.el) < 0.05) return angle;
  const pa = armToPolar(s.upperArm, s.foreArm, a.sh, a.el);
  const pb = armToPolar(s.upperArm, s.foreArm, b.sh, b.el);
  // Travel the same way round as the angle-space blend (keeps authored arcs
  // such as wind-ups going the intended direction).
  let d = pb.dirAngle - pa.dirAngle;
  const want = b.sh - a.sh;
  while (d - want > Math.PI) d -= Math.PI * 2;
  while (d - want < -Math.PI) d += Math.PI * 2;
  const reach = a.el === b.el ? pa.reach : pa.reach + (pb.reach - pa.reach) * w;
  return armFromPolar(s.upperArm, s.foreArm, reach, pa.dirAngle + d * w, sa as 1 | -1);
};

/**
 * Arm IK in pose terms: returns shoulder/elbow angles that put the wrist on
 * `worldTarget`, expressed in the pose's current armGrav convention so the
 * result blends cleanly with FK layers.
 */
export const reachAngles = (
  s: CharacterSpec,
  pose: Pose,
  side: "F" | "B",
  worldTarget: Vec2,
  pole: Vec2 = ELBOW_POLE,
) => {
  const { toLocal } = makeTransforms(pose);
  const shoulder = localShoulder(s, pose, side);
  const t = toLocal(worldTarget);
  const ik = solveTwoBone(shoulder, t, s.upperArm, s.foreArm, pole);
  const torsoAngle = pose.lean + pose.chest;
  // Express the angle inside the shoulder's range of motion
  // [SHOULDER_MIN, SHOULDER_MIN + 2PI): arms reach behind the back only a
  // little, but go up and over the head. Layer blending then interpolates
  // the anatomically plausible way (forward through the front), never the
  // "nearest" way through the back.
  let sh = ik.upperAngle + (1 - pose.armGrav) * torsoAngle;
  while (sh < SHOULDER_MIN) sh += Math.PI * 2;
  while (sh >= SHOULDER_MIN + Math.PI * 2) sh -= Math.PI * 2;
  return {
    sh,
    el: clamp(ik.lowerRel, ...JOINT_LIMITS.elbow),
    reached: ik.reached,
  };
};
