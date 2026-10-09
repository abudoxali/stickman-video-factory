import { sfxFiles } from "./audio";
import { CLIP_NAMES } from "./clips";
import { EXPRESSION_NAMES } from "./expressions";
import type { SceneDef, TargetRef } from "./scene";

export interface SceneValidationResult {
  ok: boolean;
  errors: string[];
}

const PROP_KINDS = new Set(["apple", "giftBox", "giftLid", "cupcake", "partyHorn", "crate", "ball"]);
const SCENE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ordered = (values: number[]) => values.every((value, index) => index === 0 || value >= values[index - 1]);

/** Runtime validation for agent-authored SceneDef data before preview/render. */
export const validateScene = (value: unknown): SceneValidationResult => {
  const errors: string[] = [];
  const error = (path: string, message: string) => errors.push(`${path}: ${message}`);
  if (!value || typeof value !== "object") return { ok: false, errors: ["scene: expected an object"] };
  const def = value as SceneDef;

  const positive = (path: string, n: unknown) => {
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) error(path, "expected a positive finite number");
  };
  positive("width", def.width);
  positive("height", def.height);
  positive("fps", def.fps);
  positive("durationInFrames", def.durationInFrames);
  if (!SCENE_ID.test(def.id ?? "")) error("id", "use lowercase kebab-case");

  const chars = Array.isArray(def.characters) ? def.characters : [];
  const props = Array.isArray(def.props) ? def.props : [];
  if (!Array.isArray(def.characters)) error("characters", "expected an array");
  if (!Array.isArray(def.props)) error("props", "expected an array");
  const charIds = new Set(chars.map((track) => track.id));
  const propIds = new Set(props.map((prop) => prop.id));
  if (charIds.size !== chars.length) error("characters", "character ids must be unique");
  if (propIds.size !== props.length) error("props", "prop ids must be unique");

  const frame = (path: string, n: unknown, allowEnd = false) => {
    const max = def.durationInFrames - (allowEnd ? 0 : 1);
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > max) error(path, `expected an integer frame in 0..${max}`);
  };
  const target = (path: string, ref: TargetRef | undefined) => {
    if (!ref) return;
    if ("char" in ref && !charIds.has(ref.char)) error(`${path}.char`, `unknown character "${ref.char}"`);
    if ("prop" in ref && !propIds.has(ref.prop)) error(`${path}.prop`, `unknown prop "${ref.prop}"`);
  };

  chars.forEach((track, ti) => {
    const p = `characters.${ti}`;
    if (!track.id) error(`${p}.id`, "required");
    if (track.facing !== 1 && track.facing !== -1) error(`${p}.facing`, "expected 1 or -1");
    if (!track.spec || typeof track.spec !== "object") error(`${p}.spec`, "required");
    track.actions.forEach((key, i) => {
      const k = `${p}.actions.${i}`;
      if (!CLIP_NAMES.includes(key.clip)) error(`${k}.clip`, `unknown clip "${key.clip}"`);
      frame(`${k}.start`, key.start);
      frame(`${k}.end`, key.end, true);
      if (!(key.end > key.start)) error(`${k}.end`, "must be greater than start");
    });
    if (!ordered(track.expressions.map((key) => key.at))) error(`${p}.expressions`, "must be ordered by frame");
    track.expressions.forEach((key, i) => {
      frame(`${p}.expressions.${i}.at`, key.at);
      if (!EXPRESSION_NAMES.includes(key.expr)) error(`${p}.expressions.${i}.expr`, `unknown expression "${key.expr}"`);
    });
    if (!ordered(track.look.map((key) => key.at))) error(`${p}.look`, "must be ordered by frame");
    track.look.forEach((key, i) => {
      frame(`${p}.look.${i}.at`, key.at);
      if (typeof key.target === "object") target(`${p}.look.${i}.target`, key.target);
    });
  });

  const propEdges = new Map<string, string[]>();
  props.forEach((prop, pi) => {
    const p = `props.${pi}`;
    if (!PROP_KINDS.has(prop.kind)) error(`${p}.kind`, `unknown prop kind "${prop.kind}"`);
    if (!Array.isArray(prop.states) || prop.states.length === 0) {
      error(`${p}.states`, "requires at least one state");
      return;
    }
    if (!ordered(prop.states.map((state) => state.from))) error(`${p}.states`, "must be ordered by from frame");
    const edges: string[] = [];
    prop.states.forEach((state, si) => {
      const s = `${p}.states.${si}`;
      frame(`${s}.from`, state.from);
      if ((state.mode === "ballistic" || state.mode === "slide") && (!(state.dur > 0) || !Number.isFinite(state.dur)))
        error(`${s}.dur`, "expected a positive finite duration");
      if (state.mode === "attach" && !charIds.has(state.char)) error(`${s}.char`, `unknown character "${state.char}"`);
      if (state.mode === "ballistic" && state.toRef) {
        target(`${s}.toRef`, state.toRef);
        if ("prop" in state.toRef) edges.push(state.toRef.prop);
      }
    });
    propEdges.set(prop.id, edges);
  });

  const visit = (id: string, stack: string[]): void => {
    const at = stack.indexOf(id);
    if (at >= 0) {
      error("props", `cyclic target reference ${[...stack.slice(at), id].join(" -> ")}`);
      return;
    }
    for (const next of propEdges.get(id) ?? []) visit(next, [...stack, id]);
  };
  for (const id of propEdges.keys()) visit(id, []);

  const cameraKeys = def.camera?.keys ?? [];
  if (!cameraKeys.length) error("camera.keys", "requires at least one key");
  if (!ordered(cameraKeys.map((key) => key.at))) error("camera.keys", "must be ordered by frame");
  cameraKeys.forEach((key, i) => {
    const p = `camera.keys.${i}`;
    frame(`${p}.at`, key.at);
    if (key.shot) {
      if (!key.shot.on.length) error(`${p}.shot.on`, "requires at least one subject");
      key.shot.on.forEach((id, oi) => {
        if (id.startsWith("prop:")) {
          if (!propIds.has(id.slice(5))) error(`${p}.shot.on.${oi}`, `unknown subject "${id}"`);
        } else if (!charIds.has(id)) error(`${p}.shot.on.${oi}`, `unknown subject "${id}"`);
      });
      if (key.shot.solveAt !== undefined) frame(`${p}.shot.solveAt`, key.shot.solveAt);
    }
  });

  const checkSound = (path: string, id: string | undefined, required = false) => {
    if (!id) {
      if (required) error(path, "required");
      return;
    }
    try {
      sfxFiles(id);
    } catch {
      error(path, `unknown sound "${id}"`);
    }
  };
  def.audio?.cues.forEach((cue, i) => {
    frame(`audio.cues.${i}.at`, cue.at);
    checkSound(`audio.cues.${i}.sfx`, cue.sfx, true);
  });
  checkSound("audio.footsteps.sfx", def.audio?.footsteps?.sfx);
  checkSound("audio.landings.sfx", def.audio?.landings?.sfx);
  def.audio?.footsteps?.chars?.forEach((id, i) => {
    if (!charIds.has(id)) error(`audio.footsteps.chars.${i}`, `unknown character "${id}"`);
  });
  def.audio?.landings?.chars?.forEach((id, i) => {
    if (!charIds.has(id)) error(`audio.landings.chars.${i}`, `unknown character "${id}"`);
  });

  const scanFinite = (node: unknown, path: string) => {
    if (typeof node === "number" && !Number.isFinite(node)) error(path, "must be finite");
    else if (Array.isArray(node)) node.forEach((item, i) => scanFinite(item, `${path}.${i}`));
    else if (node && typeof node === "object")
      Object.entries(node).forEach(([key, item]) => scanFinite(item, path ? `${path}.${key}` : key));
  };
  scanFinite(def, "");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
};

export function assertValidScene(value: unknown): asserts value is SceneDef {
  const result = validateScene(value);
  if (!result.ok) throw new Error(`Invalid scene:\n${result.errors.map((entry) => `- ${entry}`).join("\n")}`);
}
