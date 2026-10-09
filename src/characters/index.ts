import type { CharacterSpec } from "../engine/types";

/**
 * Pip — tall, springy, curious. Coral hoodie, antenna curl that never stops
 * reacting. Long limbs, light bouncy gait.
 */
export const PIP: CharacterSpec = {
  id: "pip",
  name: "Pip",
  headR: 69,
  neck: 14,
  torso: 134,
  torsoTopW: 70,
  torsoBotW: 68,
  upperArm: 84,
  foreArm: 80,
  handR: 16,
  thigh: 104,
  shin: 100,
  ankleH: 12,
  footLen: 52,
  limbW: 17,
  legW: 20,
  outline: 5,
  colors: {
    ink: "#2a2238",
    skin: "#ffe8d4",
    shirt: "#ff6f59",
    shirtShade: "#e2523e",
    pants: "#3d4a7a",
    pantsShade: "#2f3a64",
    shoe: "#fdfdfd",
    shoeSole: "#ffd23f",
    accent: "#ffd23f",
    cheek: "#ff8f8f",
    hair: "#2a2238",
  },
  hair: "tuft",
  gait: { stepFrames: 14, stride: 118, bob: 10, lift: 26, armSwing: 0.55, lean: 0.06, bounce: 1.25 },
  idle: { breathRate: 84, sway: 4 },
  seed: 1.7,
};

/**
 * Bo — short, round, mischievous party-planner. Teal sweater, floppy quiff,
 * quicker steps and bigger arm swing.
 */
export const BO: CharacterSpec = {
  id: "bo",
  name: "Bo",
  headR: 71,
  neck: 10,
  torso: 114,
  torsoTopW: 84,
  torsoBotW: 100,
  upperArm: 72,
  foreArm: 68,
  handR: 15,
  thigh: 84,
  shin: 80,
  ankleH: 11,
  footLen: 48,
  limbW: 17,
  legW: 21,
  outline: 5,
  colors: {
    ink: "#2a2238",
    skin: "#f6cfa8",
    shirt: "#22b8a7",
    shirtShade: "#17988a",
    pants: "#6b4a8f",
    pantsShade: "#573a77",
    shoe: "#ff6f59",
    shoeSole: "#fdfdfd",
    accent: "#ffd23f",
    cheek: "#ff8f8f",
    hair: "#6b3f2a",
  },
  hair: "quiff",
  gait: { stepFrames: 12, stride: 98, bob: 8, lift: 22, armSwing: 0.72, lean: 0.08, bounce: 1.1 },
  idle: { breathRate: 72, sway: 5 },
  seed: 4.3,
};

export const CHARACTERS = { pip: PIP, bo: BO };
