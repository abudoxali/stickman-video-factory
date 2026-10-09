---
name: video-rendering
description: Preview and render this repo's Remotion compositions deterministically, then verify the MP4 (metadata, full decode, motion energy, bit-exact reproducibility) with ffprobe/ffmpeg. Use when asked to preview, render, export, give an MP4, check a render, or debug render failures/performance (including WebGL/PixiJS benchmark renders).
---

# Video Rendering

Builds on the official Remotion skills installed in `.claude/skills/`
(`remotion-render`, `remotion-studio`, `remotion-best-practices`). Read those
for CLI flags; this skill covers the project-specific loop.

## Compositions (src/Root.tsx)
- `TheSurprise` — 1080×1920, 30 fps, 720 frames (the demo).
- `RigLab` — expression/rig inspection sheet.
- `PixiBench` — PixiJS renderer benchmark (WebGL).

## Preview
```
npm run dev            # = remotion studio (prints URL; add --no-open in agents)
```
Scrub frames there; all motion is frame-driven so any frame renders alone.

## Render
```
npx remotion render TheSurprise out/the-surprise.mp4 --concurrency=4     # ~60 s on 4 vCPU
npx remotion render TheSurprise out/qa/low.mp4 --scale=0.25               # fast QA pass
npx remotion render PixiBench out/qa/pixi.mp4 --frames=0-149 --gl=swangle # WebGL benchmark
```
`remotion.config.ts` sets jpeg frames + overwrite. SVG scenes need no GL
flag; WebGL needs `--gl=swangle` (or `angle`) in GPU-less containers.

## Verify
```
node scripts/verify-render.mjs out/the-surprise.mp4 --compare out/qa/the-surprise-repeat.mp4
```
Checks resolution, fps, frame count, duration, full decode, per-second
motion energy, longest frozen run, and frame-by-frame MD5 equality against a
second independent render (determinism). Writes `out/qa/render-report.json`.

## Determinism rules
- No `Math.random`, `Date`, CSS animations/transitions or wall-clock timers in
  compositions; all motion derives from `useCurrentFrame()` (Remotion rule).
- Caches (locomotion bake, spring simulation) are keyed by the SceneDef
  object and simulate from frame 0 with fixed steps → identical in every
  render process regardless of frame order/concurrency.
- WebGL canvases need `preserveDrawingBuffer: true`, `autoStart: false`,
  and a `delayRender`/`continueRender` pair around init and each frame.

## Common failure modes
- Long renders blocked by a stuck `delayRender` (forgot `continueRender`).
- Memory reported warning about Docker limits is harmless here.
- `out/` is git-ignored: commit sources, not videos, unless asked.
