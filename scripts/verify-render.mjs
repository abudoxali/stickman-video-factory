// Verify a rendered video: container metadata, full decode, per-frame motion
// energy, and (optionally) bit-exact reproducibility against a second render.
//
// Usage: node scripts/verify-render.mjs <video.mp4> [--compare other.mp4]
//        [--width 1080 --height 1920 --fps 30 --frames 720]
// Writes out/qa/render-report.json; exits non-zero when a hard check fails.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

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

const hard = [];
if (meta.width !== expect.width || meta.height !== expect.height) hard.push(`resolution ${meta.width}x${meta.height} != ${expect.width}x${expect.height}`);
if (Math.abs(meta.fps - expect.fps) > 0.01) hard.push(`fps ${meta.fps} != ${expect.fps}`);
if (meta.frames !== expect.frames) hard.push(`frames ${meta.frames} != ${expect.frames}`);
if (Math.abs(meta.duration - expect.frames / expect.fps) > 0.1) hard.push(`duration ${meta.duration}s`);
if (decodeErrors) hard.push(`decode errors: ${decodeErrors.slice(0, 300)}`);
if (repro && (repro.framesA !== repro.framesB || repro.identicalFrames !== repro.framesA)) hard.push(`not reproducible: ${JSON.stringify(repro)}`);

const report = { video, meta, decodeOk: !decodeErrors, motion: { perSecond, frozenTransitions: frozen, longestFreezeFrames: longestFreeze }, repro, hardFailures: hard };
fs.mkdirSync("out/qa", { recursive: true });
fs.writeFileSync("out/qa/render-report.json", JSON.stringify(report, null, 2));
console.log(`Render verification: ${video}`);
console.log(`  ${meta.codec}/${meta.pixFmt} ${meta.width}x${meta.height} @${meta.fps}fps, ${meta.frames} frames, ${meta.duration.toFixed(2)}s, ${(meta.sizeBytes / 1e6).toFixed(1)} MB`);
console.log(`  decode: ${decodeErrors ? "ERRORS" : "ok"}`);
console.log(`  motion energy/sec: ${perSecond.join(" ")}`);
console.log(`  frozen transitions: ${frozen}/${diffs.length}, longest freeze: ${longestFreeze} frames`);
if (repro) console.log(`  reproducibility: ${repro.identicalFrames}/${repro.framesA} frames bit-identical`);
for (const h of hard) console.log(`  FAIL ${h}`);
console.log(hard.length ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(hard.length ? 1 : 0);
