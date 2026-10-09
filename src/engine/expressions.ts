import type { PartialPose, PoseChannel } from "./types";

/**
 * Expressions are more than faces: each one also carries a posture offset
 * (lean, head tilt, shoulder raise, arm tension) because emotion reads from
 * the silhouette first and the face second.
 */
export interface Expression {
  face: PartialPose;
  /** Additive offsets applied to the body (scaled by expression weight). */
  body: PartialPose;
}

export const FACE_CHANNELS: PoseChannel[] = [
  "lidTop",
  "squint",
  "eyeScale",
  "pupil",
  "browY",
  "browTilt",
  "browAsym",
  "mouthW",
  "mouthOpen",
  "smile",
  "mouthRound",
  "mouthX",
  "teeth",
  "cheek",
  "puff",
  "sweat",
  "crossEye",
  "shine",
];

export const EXPRESSIONS = {
  neutral: {
    face: { browY: 0, browTilt: 0, smile: 0.2, mouthOpen: 0, mouthW: 1, cheek: 0.2 },
    body: {},
  },
  happy: {
    face: { browY: 0.35, browTilt: 0.1, smile: 0.95, mouthOpen: 0.35, mouthW: 1.2, squint: 0.35, cheek: 0.75 },
    body: { lean: -0.04, head: -0.06, shrug: 2 },
  },
  sad: {
    face: { browY: -0.1, browTilt: 0.9, smile: -0.75, mouthW: 0.8, lidTop: 0.4, eyeY: 0.5, cheek: 0.1 },
    body: { lean: 0.08, chest: 0.1, neck: 0.16, head: 0.08, shrug: -6, aFsh: -0.1, aBsh: -0.1 },
  },
  confused: {
    face: { browY: 0.2, browAsym: 0.8, smile: -0.15, mouthX: 0.35, mouthW: 0.7, mouthRound: 0.2 },
    body: { head: -0.22, neck: -0.05, shrug: 6 },
  },
  shocked: {
    face: { browY: 1, browTilt: 0.2, eyeScale: 1.35, pupil: 0.55, mouthOpen: 1, mouthRound: 0.7, mouthW: 0.9, smile: -0.2 },
    body: { lean: -0.12, head: -0.08, shrug: 14, aFel: 0.4, aBel: 0.4 },
  },
  angry: {
    face: { browY: -0.8, browTilt: -1, lidTop: 0.35, smile: -0.6, mouthW: 1.1, teeth: 0.8, mouthOpen: 0.25, cheek: 0.6 },
    body: { lean: 0.1, neck: 0.15, head: 0.1, shrug: 8 },
  },
  excited: {
    face: { browY: 0.9, eyeScale: 1.18, smile: 1, mouthOpen: 0.75, mouthW: 1.25, cheek: 0.9 },
    body: { lean: -0.05, head: -0.12, shrug: 4 },
  },
  thinking: {
    face: { browY: 0.1, browAsym: 0.55, lidTop: 0.25, eyeY: -0.7, eyeX: 0.15, smile: 0, mouthX: 0.3, mouthW: 0.65 },
    body: { head: -0.2, neck: -0.08 },
  },
  worried: {
    face: { browY: 0.35, browTilt: 1, smile: -0.4, mouthW: 0.9, teeth: 0.7, mouthOpen: 0.15, sweat: 1, eyeScale: 1.1 },
    body: { lean: -0.03, shrug: 10, aFel: 0.3, aBel: 0.3 },
  },
  surprised: {
    face: { browY: 0.9, eyeScale: 1.22, pupil: 0.8, mouthOpen: 0.55, mouthRound: 1, mouthW: 0.6, smile: 0 },
    body: { lean: -0.06, head: -0.1, shrug: 8 },
  },
  curious: {
    face: { browY: 0.45, browAsym: 0.3, eyeScale: 1.12, smile: 0.35, mouthW: 0.7, mouthRound: 0.25, mouthOpen: 0.1 },
    body: { lean: 0.06, neck: 0.08, head: 0.04 },
  },
  amazed: {
    face: { browY: 0.75, eyeScale: 1.25, pupil: 1.25, smile: 0.6, mouthOpen: 0.5, mouthRound: 0.6, mouthW: 0.8, cheek: 0.7 },
    body: { lean: 0.02, neck: 0.0, head: -0.1 },
  },
  dazed: {
    face: { browY: 0.25, browAsym: -0.5, lidTop: 0.45, crossEye: 1, smile: -0.1, mouthX: -0.3, mouthOpen: 0.2, mouthRound: 0.3, mouthW: 0.7 },
    body: { head: 0.08, neck: 0.0 },
  },
  annoyed: {
    face: { browY: -0.45, browTilt: -0.5, lidTop: 0.55, smile: -0.35, mouthX: -0.25, mouthW: 0.8, cheek: 0.3 },
    body: { lean: -0.04, head: 0.08 },
  },
  laughing: {
    face: { browY: 0.4, browTilt: 0.5, squint: 1, smile: 1, mouthOpen: 0.95, mouthW: 1.3, cheek: 1 },
    body: { lean: -0.12, neck: -0.15, head: -0.15, shrug: 5 },
  },
  blowing: {
    face: { browY: 0.25, puff: 1, mouthRound: 1, mouthOpen: 0.3, mouthW: 0.45, smile: 0, squint: 0.3 },
    body: { lean: 0.14, neck: 0.15 },
  },
  whistling: {
    face: { browY: 0.3, mouthRound: 1, mouthOpen: 0.22, mouthW: 0.42, smile: 0.1, lidTop: 0.15, cheek: 0.45 },
    body: { head: -0.05 },
  },
  sneaky: {
    face: { browY: -0.15, browTilt: -0.3, lidTop: 0.3, smile: 0.55, mouthX: 0.3, mouthW: 0.8, cheek: 0.35 },
    body: { lean: 0.06, neck: 0.08, shrug: 8 },
  },
  grin: {
    face: { browY: 0.5, smile: 1, mouthW: 1.35, teeth: 1, mouthOpen: 0.3, cheek: 0.8, squint: 0.2 },
    body: { head: -0.05 },
  },
  smug: {
    face: { browY: 0.15, browAsym: 0.9, lidTop: 0.5, smile: 0.75, mouthX: 0.35, mouthW: 0.85, cheek: 0.45 },
    body: { lean: -0.08, head: -0.14, neck: -0.06, shrug: -2 },
  },
  longing: {
    face: { browY: 0.65, browTilt: 0.6, eyeScale: 1.25, pupil: 1.35, shine: 1, smile: 0.3, mouthOpen: 0.25, mouthRound: 0.4, mouthW: 0.7, cheek: 0.6 },
    body: { neck: -0.06, head: -0.06 },
  },
  determined: {
    face: { browY: -0.5, browTilt: -0.85, lidTop: 0.2, smile: -0.1, mouthW: 0.65, cheek: 0.4 },
    body: { lean: 0.08, neck: 0.06, shrug: 4 },
  },
  dejected: {
    face: { browY: -0.2, browTilt: 0.65, lidTop: 0.55, smile: -0.4, mouthW: 0.65, eyeY: 0.4, cheek: 0.1 },
    body: { lean: 0.1, chest: 0.12, neck: 0.18, head: 0.12, shrug: -8, aFsh: -0.08, aBsh: -0.08 },
  },
  deadpan: {
    face: { browY: -0.1, lidTop: 0.62, smile: 0, mouthW: 0.7, cheek: 0.1 },
    body: { head: 0.02 },
  },
  blissful: {
    face: { browY: 0.5, browTilt: 0.35, squint: 1, smile: 0.85, puff: 0.45, cheek: 1, mouthW: 0.8, shine: 0.4 },
    body: { head: -0.08, shrug: 3 },
  },
} satisfies Record<string, Expression>;

export type ExpressionName = keyof typeof EXPRESSIONS;
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS) as ExpressionName[];
