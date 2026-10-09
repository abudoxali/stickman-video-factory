// Verify a rendered video: container metadata, full decode, per-frame motion
// energy, and (optionally) bit-exact reproducibility against a second render.
//
// Usage: node scripts/verify-render.mjs <video.mp4> [--compare other.mp4]
//        [--width 1080 --height 1920 --fps 30 --frames 720]
//        [--scene <sceneId>]   audio: expect a non-silent track and check that
//                              every authored cue starts an audible onset at its frame
// Writes a scene/output-specific report; exits non-zero when a hard check fails.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const video = args[0];
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!video || !fs.existsSync(video)) {
  console.error(`video not found: ${video}`);
  process.exit(1);
}
const expect = {
  width: Number(opt("width", 1080)),
  height: Number(opt("height", 1920)),
  fps: Number(opt("fps", 30)),
  frames: Number(opt("frames", 720)),
};
const reportPath = opt("report", `out/qa/render-report-${video.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.json`);

const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { maxBuffer: 1 << 30, ...opts });

// 1) metadata
const probe = JSON.parse(
  run("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
    "stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,pix_fmt:format=duration,size,bit_rate", "-of", "json", video]).toString(),
);
const st = probe.streams[0];
const [fn, fd] = st.r_frame_rate.split("/").map(Number);
const meta = {
  codec: st.codec_name,
  pixFmt: st.pix_fmt,
  width: st.width,
  height: st.height,
  fps: fn / fd,
  frames: Number(st.nb_read_frames),
  duration: Number(probe.format.duration),
  sizeBytes: Number(probe.format.size),
};

// 2) full decode, any error is fatal
let decodeErrors = "";
try {
  run("ffmpeg", ["-v", "error", "-i", video, "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  decodeErrors = String(e.stderr ?? e.message);
}

// 3) motion energy from a small grayscale proxy (mean abs diff per frame)
const W = 108;
const H = 192;
const raw = run("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"]);
const n = Math.floor(raw.length / (W * H));
const diffs = [];
for (let i = 1; i < n; i++) {
  let s = 0;
  const a = (i - 1) * W * H;
  const b = i * W * H;
  for (let k = 0; k < W * H; k++) s += Math.abs(raw[b + k] - raw[a + k]);
  diffs.push(s / (W * H));
}
const perSecond = [];
for (let s = 0; s < Math.ceil(diffs.length / meta.fps); s++) {
  const seg = diffs.slice(s * meta.fps, (s + 1) * meta.fps);
  perSecond.push(Number((seg.reduce((x, y) => x + y, 0) / Math.max(1, seg.length)).toFixed(3)));
}
const frozen = diffs.filter((d) => d < 0.02).length; // bit-identical-ish consecutive frames
let longestFreeze = 0;
let run0 = 0;
for (const d of diffs) {
  run0 = d < 0.02 ? run0 + 1 : 0;
  longestFreeze = Math.max(longestFreeze, run0);
}

// 4) reproducibility
let repro = null;
const other = opt("compare", null);
if (other) {
  const md5 = (f) =>
    run("ffmpeg", ["-v", "error", "-i", f, "-f", "framemd5", "-"])
      .toString()
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(",").pop().trim());
  const A = md5(video);
  const B = md5(other);
  const mismatched = A.map((h, i) => (h === B[i] ? -1 : i)).filter((i) => i >= 0);
  repro = { framesA: A.length, framesB: B.length, identicalFrames: A.length - mismatched.length, firstMismatches: mismatched.slice(0, 10) };
}

// 5) audio: presence, level, cue sync (onset energy right after each cue frame)
let audio = null;
const scene = opt("scene", null);
const aProbe = JSON.parse(
  run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,sample_rate,channels,duration", "-of", "json", video]).toString(),
);
const ast = aProbe.streams?.[0];
if (ast) {
  // volumedetect reports on stderr
  const vd = spawnSync("ffmpeg", ["-v", "info", "-i", video, "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"], { maxBuffer: 1 << 30 });
  const txt = String(vd.stderr);
  audio = {
    codec: ast.codec_name,
    sampleRate: Number(ast.sample_rate),
    channels: ast.channels,
    duration: Number(ast.duration),
    maxVolumeDb: Number(/max_volume: (-?[\d.]+) dB/.exec(txt)?.[1] ?? NaN),
    meanVolumeDb: Number(/mean_volume: (-?[\d.]+) dB/.exec(txt)?.[1] ?? NaN),
  };
}
if (scene) {
  const cuesJson = execFileSync("npx", ["tsx", "scripts/audio-cues.ts", scene], { shell: process.platform === "win32" }).toString();
  const { cues, fps } = JSON.parse(cuesJson.slice(cuesJson.indexOf("{")));
  const SR = 8000;
  const pcm = ast ? run("ffmpeg", ["-v", "error", "-i", video, "-map", "0:a:0", "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"]) : Buffer.alloc(0);
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const rms = (t0, t1) => {
    const a = Math.max(0, Math.floor(t0 * SR));
    const b = Math.min(samples.length, Math.floor(t1 * SR));
    let e = 0;
    for (let i = a; i < b; i++) e += samples[i] * samples[i];
    return Math.sqrt(e / Math.max(1, b - a));
  };
  const authored = cues.filter((c) => c.source === "cue");
  const checked = authored.map((c) => {
    const t = c.at / fps;
    const before = rms(t - 0.12, t - 0.01);
    const after = rms(t, t + 0.09);
    return { at: c.at, label: c.label, before: Math.round(before), after: Math.round(after), onset: after > Math.max(60, before * 1.25) };
  });
  audio = { ...(audio ?? {}), cues: cues.length, authoredCues: authored.length, onsetsDetected: checked.filter((c) => c.onset).length, missed: checked.filter((c) => !c.onset) };
}

const hard = [];
if (meta.width !== expect.width || meta.height !== expect.height) hard.push(`resolution ${meta.width}x${meta.height} != ${expect.width}x${expect.height}`);
if (Math.abs(meta.fps - expect.fps) > 0.01) hard.push(`fps ${meta.fps} != ${expect.fps}`);
if (meta.frames !== expect.frames) hard.push(`frames ${meta.frames} != ${expect.frames}`);
if (Math.abs(meta.duration - expect.frames / expect.fps) > 0.1) hard.push(`duration ${meta.duration}s`);
if (decodeErrors) hard.push(`decode errors: ${decodeErrors.slice(0, 300)}`);
if (scene && !ast) hard.push("expected an audio track (scene has sound) but none found");
if (scene && audio && !(audio.maxVolumeDb > -60)) hard.push(`audio is silent (max ${audio.maxVolumeDb} dB)`);
if (scene && audio && audio.authoredCues && audio.onsetsDetected < Math.ceil(audio.authoredCues * 0.8))
  hard.push(`audio cues out of sync: ${audio.onsetsDetected}/${audio.authoredCues} onsets detected`);
if (repro && (repro.framesA !== repro.framesB || repro.identicalFrames !== repro.framesA)) hard.push(`not reproducible: ${JSON.stringify(repro)}`);

const report = { video, meta, audio, decodeOk: !decodeErrors, motion: { perSecond, frozenTransitions: frozen, longestFreezeFrames: longestFreeze }, repro, hardFailures: hard };
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Render verification: ${video}`);
console.log(`  ${meta.codec}/${meta.pixFmt} ${meta.width}x${meta.height} @${meta.fps}fps, ${meta.frames} frames, ${meta.duration.toFixed(2)}s, ${(meta.sizeBytes / 1e6).toFixed(1)} MB`);
console.log(`  decode: ${decodeErrors ? "ERRORS" : "ok"}`);
console.log(`  motion energy/sec: ${perSecond.join(" ")}`);
console.log(`  frozen transitions: ${frozen}/${diffs.length}, longest freeze: ${longestFreeze} frames`);
if (audio)
  console.log(
    `  audio: ${audio.codec ?? "none"} ${audio.sampleRate ?? ""}Hz ${audio.channels ?? ""}ch, peak ${audio.maxVolumeDb} dB, mean ${audio.meanVolumeDb} dB` +
      (audio.authoredCues ? `, cue onsets ${audio.onsetsDetected}/${audio.authoredCues} (${audio.cues} incl. auto footsteps/landings)` : ""),
  );
else console.log("  audio: none");
if (repro) console.log(`  reproducibility: ${repro.identicalFrames}/${repro.framesA} frames bit-identical`);
for (const h of hard) console.log(`  FAIL ${h}`);
console.log(hard.length ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(hard.length ? 1 : 0);
