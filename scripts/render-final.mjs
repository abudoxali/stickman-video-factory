// Deterministic final render (cross-platform: Windows / macOS / Linux).
//
//   Remotion PNG frames  ->  pinned single-thread x264      \
//   Remotion WAV (audio) ->  AAC (ffmpeg native encoder)     >  MP4 (bitexact flags)
//
// Remotion's PNG frames are byte-identical across runs/concurrency, but
// multi-threaded x264 is not (different MP4s from identical PNGs on long
// sequences), so the video encode is pinned to one thread. Audio is rendered
// by Remotion from the same composition (so Studio preview == final mix) and
// muxed only when the composition actually has sound.
//
// Usage: node scripts/render-final.mjs <CompositionId> <out.mp4> [--concurrency 4] [--fps 30] [--scale 1] [--no-audio]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const [comp, out] = args;
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!comp || !out) {
  console.error("usage: node scripts/render-final.mjs <CompositionId> <out.mp4> [--concurrency 4] [--fps 30] [--scale 1] [--no-audio]");
  process.exit(1);
}
const conc = opt("concurrency", "4");
const fps = opt("fps", "30");
const scale = opt("scale", "1");
const wantAudio = !args.includes("--no-audio");

const sh = (cmd, a, { capture = false } = {}) => {
  const r = spawnSync(cmd, a, { stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", shell: process.platform === "win32" && cmd === "npx" });
  if (r.status !== 0) {
    if (capture) process.stderr.write(String(r.stderr ?? ""));
    throw new Error(`${cmd} ${a.join(" ")} failed (${r.status})`);
  }
  return capture ? String(r.stdout) + String(r.stderr) : "";
};

const work = path.join("out", "frames", `${comp}-${process.pid}`);
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(path.dirname(out) || ".", { recursive: true });

const t0 = Date.now();
sh("npx", ["remotion", "render", comp, work, "--sequence", "--image-format=png", `--concurrency=${conc}`, `--scale=${scale}`, "--log=error"]);
const t1 = Date.now();
const pngs = fs.readdirSync(work).filter((f) => f.endsWith(".png")).sort();
if (!pngs.length) throw new Error("no frames rendered");
const m = /^(.*?)(\d+)\.png$/.exec(pngs[0]);
const pattern = path.join(work, `${m[1]}%0${m[2].length}d.png`);
console.log(`rendered ${pngs.length} PNG frames in ${((t1 - t0) / 1000).toFixed(1)}s`);

let audio = null;
if (wantAudio) {
  const wav = path.join(work, "audio.wav");
  sh("npx", ["remotion", "render", comp, wav, "--codec=wav", "--log=error"]);
  const vd = sh("ffmpeg", ["-v", "info", "-i", wav, "-af", "volumedetect", "-f", "null", "-"], { capture: true });
  const max = Number(/max_volume: (-?[\d.]+) dB/.exec(vd)?.[1] ?? -91);
  if (max > -80) audio = wav;
  console.log(audio ? `audio rendered (peak ${max} dB)` : "composition is silent: no audio track");
}
const t2 = Date.now();

const enc = [
  "-v", "error", "-y",
  "-framerate", fps, "-start_number", String(Number(m[2])), "-i", pattern,
  ...(audio ? ["-i", audio] : []),
  "-map", "0:v:0", ...(audio ? ["-map", "1:a:0"] : []),
  "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-tune", "animation", "-threads", "1",
  ...(audio ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []),
  "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact",
  "-movflags", "+faststart", out,
];
sh("ffmpeg", enc);
const t3 = Date.now();
fs.rmSync(work, { recursive: true, force: true });
console.log(
  `rendered ${comp} -> ${out} (frames ${((t1 - t0) / 1000).toFixed(1)}s, audio ${((t2 - t1) / 1000).toFixed(1)}s, encode ${((t3 - t2) / 1000).toFixed(1)}s)`,
);
