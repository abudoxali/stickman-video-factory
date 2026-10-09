// Builds and renders the Godot cutout lab (godot/cutout-lab) with Movie Maker
// into a PNG sequence that Remotion can composite (src/render/FrameSequence.tsx).
// Requires Godot 4.5+ on PATH, or GODOT_BIN=/path/to/godot.
// Usage: node scripts/godot-render.mjs [--opaque] [--frames 120] [--out public/renders/godot-lab]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const godot = process.env.GODOT_BIN ?? "godot";
const proj = "godot/cutout-lab";
const out = path.resolve(opt("out", "public/renders/godot-lab"));
const frames = opt("frames", "120");
const run = (a, label) => {
  const t = Date.now();
  const r = spawnSync(godot, a, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0 || /SCRIPT ERROR|Parse Error/.test(log)) {
    console.error(log);
    throw new Error(`${label} failed (${r.error?.message ?? r.status})`);
  }
  console.log(`${label}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return log;
};
run(["--headless", "--path", proj, "--import"], "import");
run(["--headless", "--path", proj, "--script", "res://tools/build.gd"], "build scenes");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const log = run(
  ["--path", proj, "--write-movie", path.join(out, "frame.png"), "--fixed-fps", "30", "--quit-after", frames, "--resolution", "540x960", "--", ...(args.includes("--opaque") ? [] : ["--transparent"])],
  "movie maker",
);
console.log((/\d+ frames at .*/.exec(log) ?? [""])[0]);
fs.rmSync(path.join(out, "frame.wav"), { force: true });
console.log(`${fs.readdirSync(out).filter((f) => f.endsWith(".png")).length} frames -> ${out}`);
