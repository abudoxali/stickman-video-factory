// Cross-engine render benchmark: equal workload (120 frames, 540x960, two
// animated characters) through each accepted/evaluated renderer. Records wall
// time, peak resident memory of the engine's processes (sampled every 250 ms)
// and peak/mean GPU utilisation (nvidia-smi, when present).
//
// Usage: node scripts/bench-engines.mjs [remotion-svg|remotion-pixi-gpu|remotion-pixi-swangle|godot|blender ...]
// Writes out/bench/engines.json. Needs godot/blender on PATH (or GODOT_BIN /
// BLENDER_BIN) for those cases.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";

const isWin = process.platform === "win32";
const blender = process.env.BLENDER_BIN ?? (isWin ? "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" : "blender");
const godot = process.env.GODOT_BIN ?? "godot";
const remotion = (comp, extra) => ["npx", ["remotion", "render", comp, "out/bench/tmp", "--sequence", "--image-format=png", "--frames=0-119", "--scale=0.5", "--log=error", ...extra]];

const CASES = {
  "remotion-svg": { cmd: remotion("Bonk", []), procs: ["node", "chrome-headless-shell", "chrome"] },
  "remotion-pixi-swangle": { cmd: remotion("PixiBench", ["--gl=swangle"]), procs: ["node", "chrome-headless-shell", "chrome"] },
  "remotion-pixi-gpu": { cmd: remotion("PixiBench", ["--gl=angle"]), procs: ["node", "chrome-headless-shell", "chrome"] },
  godot: {
    cmd: [godot, ["--path", "godot/cutout-lab", "--write-movie", `${process.cwd()}/out/bench/tmp/frame.png`, "--fixed-fps", "30", "--quit-after", "120", "--resolution", "540x960", "--", "--transparent"]],
    procs: ["godot"],
  },
  blender: {
    cmd: [blender, ["-b", "--factory-startup", "--python", "blender/gp_rig_lab.py", "--", "--out", "out/bench/tmp", "--frames", "120", "--blend", "out/bench/gp.blend"]],
    procs: ["blender"],
  },
};

const memMB = (names) => {
  try {
    if (isWin) {
      const ps = `(Get-Process -Name ${names.map((n) => `'${n}*'`).join(",")} -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum`;
      return Number(execFileSync("powershell", ["-NoProfile", "-Command", ps]).toString().trim() || 0) / 1e6;
    }
    const out = execFileSync("ps", ["-A", "-o", "rss=,comm="]).toString();
    return out.split("\n").filter((l) => names.some((n) => l.includes(n))).reduce((s, l) => s + Number(l.trim().split(/\s+/)[0]) / 1e3, 0);
  } catch {
    return 0;
  }
};
const gpuUtil = () => {
  try {
    return Number(execFileSync("nvidia-smi", ["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"]).toString().trim());
  } catch {
    return null;
  }
};

const runCase = (name) =>
  new Promise((resolve) => {
    const { cmd, procs } = CASES[name];
    fs.rmSync("out/bench/tmp", { recursive: true, force: true });
    fs.mkdirSync("out/bench/tmp", { recursive: true });
    const base = memMB(procs);
    const t0 = Date.now();
    const child = spawn(cmd[0], cmd[1], { stdio: "ignore", shell: isWin && cmd[0] === "npx" });
    let peak = 0;
    const gpu = [];
    const timer = setInterval(() => {
      peak = Math.max(peak, memMB(procs) - base);
      const g = gpuUtil();
      if (g !== null) gpu.push(g);
    }, 250);
    child.on("exit", (code) => {
      clearInterval(timer);
      const sec = (Date.now() - t0) / 1000;
      const frames = fs.readdirSync("out/bench/tmp").filter((f) => f.endsWith(".png")).length;
      resolve({
        name,
        ok: code === 0 && frames >= 120,
        frames,
        seconds: Number(sec.toFixed(1)),
        msPerFrame: Math.round((sec * 1000) / Math.max(1, frames)),
        peakMemMB: Math.round(peak),
        gpuPeakPct: gpu.length ? Math.max(...gpu) : null,
        gpuMeanPct: gpu.length ? Math.round(gpu.reduce((a, b) => a + b, 0) / gpu.length) : null,
      });
    });
  });

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES);
const results = [];
for (const n of names) {
  const r = await runCase(n);
  results.push(r);
  console.log(
    `${n.padEnd(22)} ${r.ok ? "ok " : "FAIL"} ${r.frames}f ${String(r.seconds).padStart(6)}s ${String(r.msPerFrame).padStart(5)} ms/f  peak +${r.peakMemMB} MB  GPU peak ${r.gpuPeakPct ?? "-"}% mean ${r.gpuMeanPct ?? "-"}%`,
  );
}
fs.rmSync("out/bench/tmp", { recursive: true, force: true });
fs.mkdirSync("out/bench", { recursive: true });
fs.writeFileSync("out/bench/engines.json", JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
