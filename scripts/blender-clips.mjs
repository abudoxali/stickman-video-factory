// Export an editable Blender action into the production keyed-clip format.
// Default preserves animator edits in out/blender/clip_lab.blend and only exports.
// --author rebuilds warmUp from tracked Python against the tracked lab rig first.
// Usage: node scripts/blender-clips.mjs [--action warmUp] [--blend out/blender/clip_lab.blend]
//        [--out src/clips/warmUp.json] [--author]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (key, fallback) => {
  const index = args.indexOf(`--${key}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const candidates = [
  process.env.BLENDER_BIN,
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].filter(Boolean);
const blender = candidates.find((candidate) => candidate === "blender" || fs.existsSync(candidate));
if (!blender) throw new Error("Blender was not found. Set BLENDER_BIN or install Blender 5.x.");

const action = opt("action", "warmUp");
const output = path.resolve(opt("out", `src/clips/${action}.json`));
const editableBlend = path.resolve(opt("blend", "out/blender/clip_lab.blend"));
const author = args.includes("--author");
const sourceBlend = path.resolve(author ? opt("base", "out/blender/gp_rig_lab.blend") : editableBlend);
if (!fs.existsSync(sourceBlend)) throw new Error(`Blender file not found: ${sourceBlend}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.mkdirSync(path.dirname(editableBlend), { recursive: true });

const blenderArgs = ["-b", sourceBlend];
if (author) {
  if (action !== "warmUp") throw new Error("--author currently supports the tracked warmUp authoring script");
  blenderArgs.push(
    "--python", "blender/clips/warm_up.py",
    "--python-expr", `import bpy; bpy.ops.wm.save_as_mainfile(filepath=r'${editableBlend.replace(/\\/g, "/").replace(/'/g, "\\'")}')`,
  );
}
blenderArgs.push("--python", "blender/clips/export_clip.py", "--", "--action", action, "--out", output);

const result = spawnSync(blender, blenderArgs, { encoding: "utf8" });
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const exported = /CLIP_EXPORTED .*/.exec(log)?.[0];
if (result.status !== 0 || !exported) {
  console.error(log.slice(-5000) || result.error?.message);
  process.exit(1);
}
if (author) console.log(/WARMUP_AUTHORED .*/.exec(log)?.[0] ?? "WARMUP_AUTHORED");
console.log(exported);
console.log(`editable: ${editableBlend}\nproduction: ${output}`);
