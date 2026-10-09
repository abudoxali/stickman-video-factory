// Prints a scene's resolved sound cues as JSON (used by verify-render's
// audio-sync check and handy when authoring).
// Usage: npx tsx scripts/audio-cues.ts <sceneId>
import { resolveSceneAudio } from "../src/engine/audio";
import { SCENES } from "../src/scenes";

const def = SCENES[process.argv[2] ?? ""];
if (!def) throw new Error(`unknown scene ${process.argv[2]}; one of ${Object.keys(SCENES).join(", ")}`);
console.log(JSON.stringify({ scene: def.id, fps: def.fps, cues: resolveSceneAudio(def) }));
