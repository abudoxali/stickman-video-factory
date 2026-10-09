// Runs the Blender Grease Pencil rig lab headless (blender/gp_rig_lab.py) and
// renders a transparent PNG sequence for compositing / benchmarking.
// Finds Blender via BLENDER_BIN, PATH, or the standard install locations.
// Usage: node scripts/blender-render.mjs [--frames 120] [--out public/renders/blender-lab]
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const candidates = [
  process.env.BLENDER_BIN,
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].filter(Boolean);
const bin = candidates.find((c) => c === "blender" || fs.existsSync(c));
const r = spawnSync(
  bin,
  ["-b", "--factory-startup", "--python", "blender/gp_rig_lab.py", "--", "--out", opt("out", "public/renders/blender-lab"), "--frames", opt("frames", "120")],
  { encoding: "utf8" },
);
const log = (r.stdout ?? "") + (r.stderr ?? "");
const line = /BLENDER_LAB.*/.exec(log)?.[0];
if (r.status !== 0 || !line) {
  console.error(log.slice(-3000) || r.error?.message);
  process.exit(1);
}
console.log(line);
