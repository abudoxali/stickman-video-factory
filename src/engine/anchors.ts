import { add, dir, rotate, scale, v, vlerp, type Vec2 } from "./math";
import { up } from "./rig";
import type { AnchorPart } from "./scene";
import type { CharacterSpec, Joints, Pose } from "./types";

/**
 * Named attachment points on a solved character, in world space. Used for
 * look-at targets, prop attachment and self-contact IK (hand to chin, hands
 * to mouth, hand on belly).
 */
export const anchorPoint = (
  s: CharacterSpec,
  pose: Pose,
  j: Joints,
  part: AnchorPart | "shoulderF" | "shoulderB",
): Vec2 => {
  const L = j.local;
  const W = j.toWorld;
  const ft = pose.faceTurn;
  const onHead = (lx: number, ly: number) => W(add(L.headC, rotate(v(lx, ly), L.headAngle)));
  switch (part) {
    case "head":
      return j.headC;
    case "headTop":
      return W(add(L.headC, scale(up(L.headAngle), s.headR * pose.squash)));
    case "mouth":
      return onHead(s.headR * 0.5 * ft, s.headR * 0.42);
    case "chin":
      return onHead(s.headR * 0.42 * ft, s.headR * 0.86);
    case "chest":
      return W(add(vlerp(L.spineMid, L.chest, 0.6), v(s.torsoTopW * 0.42, 0)));
    case "belly":
      return W(add(vlerp(L.pelvis, L.spineMid, 0.6), v(s.torsoBotW * 0.5, 0)));
    case "pelvis":
      return j.pelvis;
    case "handF":
      return W(add(L.wristF, scale(dir(L.handAngleF), s.handR * 0.8)));
    case "handB":
      return W(add(L.wristB, scale(dir(L.handAngleB), s.handR * 0.8)));
    case "hands": {
      const a = W(add(L.wristF, scale(dir(L.handAngleF), s.handR * 0.8)));
      const b = W(add(L.wristB, scale(dir(L.handAngleB), s.handR * 0.8)));
      return vlerp(a, b, 0.5);
    }
    case "feet":
      return vlerp(j.ankleF, j.ankleB, 0.5);
    case "shoulderF":
      return j.shoulderF;
    case "shoulderB":
      return j.shoulderB;
  }
};

/** World-space rotation of an anchor (for props that inherit rotation). */
export const anchorRotation = (pose: Pose, j: Joints, part: AnchorPart): number => {
  const sgn = pose.facing >= 0 ? 1 : -1;
  // local rig angles -> SVG world rotation (radians, clockwise positive)
  switch (part) {
    case "head":
    case "headTop":
    case "mouth":
    case "chin":
      return sgn * (j.local.headAngle + pose.bodyRot);
    case "handF":
      return sgn * (pose.bodyRot - j.local.handAngleF) ;
    case "handB":
      return sgn * (pose.bodyRot - j.local.handAngleB);
    default:
      return sgn * pose.bodyRot;
  }
};
