import type { SceneAudioDef } from "./audio";
import type { ExpressionName } from "./expressions";
import type { LocoMove } from "./locomotion";
import type { EaseName } from "./math";
import type { CharacterSpec } from "./types";

// ---------------------------------------------------------------------------
// Scene definition: plain, JSON-compatible data an agent can author and edit.
// Frames are absolute composition frames (30 fps in the demos).
// ---------------------------------------------------------------------------

export type AnchorPart =
  | "head"
  | "headTop"
  | "mouth"
  | "chin"
  | "chest"
  | "belly"
  | "pelvis"
  | "handF"
  | "handB"
  | "hands"
  | "feet";

export type TargetRef =
  | { point: [number, number] }
  | { prop: string; offset?: [number, number] }
  | { char: string; part: AnchorPart; offset?: [number, number] };

export type LookTarget = TargetRef | "camera" | "ahead" | "down" | "up";

export interface ActionKey {
  clip: string;
  start: number;
  end: number;
  /** Blend-in frames (default 6). */
  in?: number;
  /** Blend-out frames (default 8). */
  out?: number;
  params?: Record<string, unknown>;
}

export interface ExprKey {
  at: number;
  expr: ExpressionName;
  /** Transition frames from the previous expression (default 6). */
  blend?: number;
  amount?: number;
}

export interface LookKey {
  at: number;
  target: LookTarget;
  blend?: number;
  /** Suppress the automatic blink that accompanies big look changes. */
  noBlink?: boolean;
}

export interface CharacterTrack {
  id: string;
  spec: CharacterSpec;
  x: number;
  facing: 1 | -1;
  moves: LocoMove[];
  actions: ActionKey[];
  expressions: ExprKey[];
  look: LookKey[];
  /** Frame ranges [from, to) during which the character is not drawn at all (e.g. behind a closed door). */
  hidden?: [number, number][];
  /** Frame ranges [from, to) during which the head is not drawn (covered by a prop). */
  hideHead?: [number, number][];
  /** Keyed render params, e.g. glow (warm light on the character). */
  renderParams?: Record<string, ParamKey[]>;
}

export type PropState =
  | { from: number; mode: "static"; pos: [number, number]; rot?: number }
  | {
      from: number;
      mode: "ballistic";
      to: [number, number];
      /**
       * Land on a moving target instead of "to": the anchor/prop/point as it
       * is at the landing frame (from + dur). Catches and hits then line up
       * exactly with hands and heads without manual probing.
       */
      toRef?: TargetRef;
      /**
       * With toRef: stop this many px short of the anchor, along the line back
       * to the throw origin (e.g. ball radius + head radius so surfaces touch).
       */
      contact?: number;
      dur: number;
      /** Extra apex height above the higher endpoint. */
      peak?: number;
      /** Total rotation in radians over the flight. */
      spin?: number;
      /** End rotation override (otherwise start + spin). */
      endRot?: number;
      fromPos?: [number, number];
      /** Bounces after landing: [height, frames] pairs. */
      bounces?: [number, number][];
      /** Horizontal travel per bounce (px). */
      skid?: number;
    }
  | {
      from: number;
      mode: "slide";
      /** Eased ground slide (pushed/pulled objects) from the previous position. */
      to: [number, number];
      dur: number;
      ease?: EaseName;
    }
  | {
      from: number;
      mode: "attach";
      char: string;
      part: AnchorPart;
      offset?: [number, number];
      rot?: number;
      /** Follow the anchor's rotation (head tilt / hand angle). */
      inheritRot?: boolean;
      /** Frames to blend from the previous position into the attachment. */
      blend?: number;
    };

export interface PropTrack {
  id: string;
  kind: string;
  states: PropState[];
  /** Draw order: "back" = behind characters, "front" = in front, or "char:<id>" = right after that character. */
  layer: PropLayer;
  /** Optional layer changes over time. */
  layerKeys?: { from: number; layer: PropLayer }[];
  /** Draw a floor shadow under the prop. */
  shadow?: boolean;
  /** Onion-skin smear frames when moving fast (default 3, 0 disables). */
  smear?: number;
  /** Frame ranges [from, to) where the prop is hidden. */
  hidden?: [number, number][];
  /** Free-form animated parameters, e.g. lid opening, glow, flame. Keyframed. */
  params?: Record<string, ParamKey[]>;
  scale?: number;
}

export type PropLayer = "back" | "front" | `char:${string}`;

export interface ParamKey {
  at: number;
  value: number;
  ease?: EaseName;
}

export interface CameraKey {
  at: number;
  x: number;
  y: number;
  zoom: number;
  rot?: number;
  /** Easing used to arrive at this key from the previous one. */
  ease?: EaseName;
}

export interface ShakeKey {
  at: number;
  amp: number;
  dur: number;
  freq?: number;
}

export interface FxKey {
  at: number;
  kind: "dust" | "puff" | "smoke" | "impactLines" | "confetti" | "sparkle" | "motionArc" | "breath" | "stars" | "leaves";
  x: number;
  y: number;
  dur?: number;
  scale?: number;
  dir?: number;
  /** Rotation in degrees (puff direction etc.). */
  angle?: number;
  /** Optional: attach the FX origin to a character anchor or prop. */
  follow?: TargetRef;
}

export interface SceneDef {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  floorY: number;
  characters: CharacterTrack[];
  props: PropTrack[];
  camera: { keys: CameraKey[]; shakes: ShakeKey[] };
  fx: FxKey[];
  /** Keyframed set-dressing parameters (door swing, lamp glow ...). */
  set: Record<string, ParamKey[]>;
  /** Which set to draw. */
  stage?: "room" | "park" | "plain";
  /**
   * Draw order tokens: "set:back", "set:doorway", "set:door", "shadows",
   * "char:<id>", "props:back", "props:front", "fx", "set:fore".
   */
  drawOrder?: string[];
  /** Spawn dust puffs automatically on jump landings / falls. */
  autoDust?: boolean;
  /** Smear frames on fast arms (default on). */
  limbSmears?: boolean;
  /** Sound effects: authored cues + automatic footsteps/landings (see engine/audio.ts). */
  audio?: SceneAudioDef;
}
