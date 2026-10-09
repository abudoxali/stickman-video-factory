import type { Vec2 } from "./math";

/**
 * Proportions and look of a character. All lengths are world units (px at
 * camera zoom 1). The rig keeps these lengths fixed for every frame: limbs
 * never stretch, only rotate (squash/stretch is a separate, explicit channel).
 */
export interface CharacterSpec {
  id: string;
  name: string;
  headR: number;
  neck: number;
  torso: number;
  torsoTopW: number;
  torsoBotW: number;
  upperArm: number;
  foreArm: number;
  handR: number;
  thigh: number;
  shin: number;
  ankleH: number;
  footLen: number;
  limbW: number;
  legW: number;
  outline: number;
  colors: {
    ink: string;
    skin: string;
    shirt: string;
    shirtShade: string;
    pants: string;
    pantsShade: string;
    shoe: string;
    shoeSole: string;
    accent: string;
    cheek: string;
    hair: string;
  };
  hair: "tuft" | "quiff";
  /** Personality defaults for locomotion. */
  gait: {
    stepFrames: number;
    stride: number;
    bob: number;
    lift: number;
    armSwing: number;
    lean: number;
    bounce: number;
  };
  /** Idle breathing/sway character. */
  idle: { breathRate: number; sway: number };
  seed: number;
}

/**
 * The full animatable state of a character at one frame. Every channel is a
 * plain number so layers can be blended generically (lerp) and the whole pose
 * is JSON-serialisable for QA dumps.
 *
 * Angles are radians in the rig convention (0 = down, + = forward).
 */
export interface Pose {
  // --- root & body -------------------------------------------------------
  x: number; // world x of the ground point under the pelvis
  y: number; // world y of that ground point (floor, or raised while airborne)
  facing: number; // -1..1, sign = direction, |facing| < 1 only during turns
  bodyRot: number; // whole-body rotation around the root (falls, tumbles)
  hipY: number; // pelvis height above root (positive = up)
  hipX: number; // pelvis forward offset in local space
  lean: number; // lower spine angle from vertical, + = forward
  chest: number; // extra upper-spine bend
  neck: number;
  head: number;
  squash: number; // 1 = neutral, <1 squashed, >1 stretched (volume preserved)
  shrug: number; // shoulder raise in px
  // --- arms: F = near (in front of torso), B = far --------------------------
  aFsh: number;
  aFel: number;
  aFwr: number;
  aBsh: number;
  aBel: number;
  aBwr: number;
  armGrav: number; // 1 = arm angles are world-hanging, 0 = inherit torso rotation
  hFopen: number;
  hFpoint: number;
  hBopen: number;
  hBpoint: number;
  // --- feet (world ankle targets, legs are always solved by IK) ------------
  fFx: number;
  fFy: number;
  fFrot: number;
  fBx: number;
  fBy: number;
  fBrot: number;
  plantF: number; // 1 = foot locked to ground, pelvis drops to keep reach
  plantB: number;
  // --- face ----------------------------------------------------------------
  faceTurn: number; // 1 = profile toward facing, 0 = toward camera, <0 = over shoulder
  eyeX: number;
  eyeY: number;
  blink: number;
  lidTop: number;
  squint: number;
  eyeScale: number;
  pupil: number;
  browY: number;
  browTilt: number;
  browAsym: number;
  mouthW: number;
  mouthOpen: number;
  smile: number;
  mouthRound: number;
  mouthX: number;
  teeth: number;
  cheek: number;
  puff: number; // cheeks puffed (blowing)
  sweat: number;
  crossEye: number;
  shine: number; // 0..1 sparkling eyes (desire, delight)
  // --- secondary (written by the spring simulation) ------------------------
  hairSwing: number;
  hairStretch: number;
}

export type PoseChannel = keyof Pose;
export type PartialPose = Partial<Pose>;

/** World-space joints after forward kinematics + IK. */
export interface Joints {
  root: Vec2;
  pelvis: Vec2;
  spineMid: Vec2;
  chest: Vec2;
  shoulderF: Vec2;
  shoulderB: Vec2;
  neckTop: Vec2;
  headC: Vec2;
  headAngle: number;
  elbowF: Vec2;
  wristF: Vec2;
  handAngleF: number;
  elbowB: Vec2;
  wristB: Vec2;
  handAngleB: number;
  hipF: Vec2;
  kneeF: Vec2;
  ankleF: Vec2;
  footAngleF: number;
  hipB: Vec2;
  kneeB: Vec2;
  ankleB: Vec2;
  footAngleB: number;
  /** Local-space joints (before root transform), handy for renderers. */
  local: Omit<Joints, "local" | "toWorld" | "toLocal">;
  toWorld: (p: Vec2) => Vec2;
  toLocal: (p: Vec2) => Vec2;
}
