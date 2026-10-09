// Labelled contact sheets from a video for sequential-motion QA (cross-platform).
// Usage: node scripts/contact-sheet.mjs <video> <outdir> [every=6] [cols=6] [rows=4] [start=0] [end=999999]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [vid, outDir, every = "6", cols = "6", rows = "4", start = "0", end = "999999"] = process.argv.slice(2);
if (!vid || !outDir) {
  console.error("usage: node scripts/contact-sheet.mjs <video> <outdir> [every] [cols] [rows] [start] [end]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^sheet_\d+\.png$/.test(f)) fs.rmSync(path.join(outDir, f));
const label = `drawtext=text='%{eif\\:n*${every}+${start}\\:d}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6`;
const vf = [
  `select='between(n\\,${start}\\,${end})*not(mod(n-${start}\\,${every}))'`,
  "scale=270:-1",
  label,
  `tile=${cols}x${rows}:padding=4:color=white`,
].join(",");
const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", vid, "-vf", vf, "-fps_mode", "vfr", path.join(outDir, "sheet_%02d.png")], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith("sheet_")).sort()) console.log(path.join(outDir, f));
