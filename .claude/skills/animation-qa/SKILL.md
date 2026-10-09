---
name: animation-qa
description: Inspect rendered and engine-level motion for animation problems — foot sliding, limb stretching, pops, frozen beats, interpenetration, unreadable staging, off-frame action, prop attachment pops — and recommend concrete revisions with frame numbers. Use after any change to a scene, clip, rig or renderer, before claiming a render is good, or when asked to review/critique an animation.
---

# Animation QA

Still frames do not prove motion. Combine the three evidence layers below
and only claim what you actually inspected.

## 1. Engine metrics (exact, every frame)
```
npx tsx scripts/qa-motion.ts            # writes out/qa/motion-report.json
```
Hard failures (exit 1): NaN channels, limb length error > 0.01 px (rig-local
space), planted-foot slip > 1 px, planted ankle IK miss > 0.75 px.
Warnings: joint pops (> 60 px/frame grounded, > 90 airborne; turn frames
excluded), sole samples below the floor, head-head interpenetration, prop
jumps on attachment switches, planner overlap warnings.
Also reports actions count, clips used, camera keys/zoom range and motion
per second (`static seconds` must be 0 for active beats).

## 2. Sequential frame inspection
```
npx remotion render <Comp> out/qa/low.mp4 --scale=0.25
node scripts/contact-sheet.mjs out/qa/low.mp4 out/qa/sheets 6          # whole film
node scripts/contact-sheet.mjs out/qa/low.mp4 out/qa/sheets 2 6 4 300  # a beat, every 2nd frame
node scripts/stills.mjs <Comp> out/qa/stills 0.5 262 290 342      # full-res spot checks
```
Read sheets in order. Look for: characters present, readable silhouettes,
anticipation before big moves, arcs (not straight-line teleports), heads
clear of props/other heads, hands actually on the props they touch, action
inside the frame, camera framing the subject of each beat.

## 3. Pose-channel forensics (to find *why*)
Probe anchors: `npx tsx scripts/probe.ts <frames...>`.
For channel stacking, evaluate the character with layers removed (actions,
look, expressions) and compare `lean/neck/head/aFsh` — the layer whose
removal changes the value is the culprit. This found every major bug in
THE SURPRISE (IK wrap-around through the back, look-at on self-attached
prop, spring saturation).

## Report format
For each issue: frame range · symptom · cause (layer/channel) · concrete fix
(file + value). Then re-run all three layers and state what changed.

## Common failure modes & their usual fixes
| Symptom | Usual cause | Fix |
|---|---|---|
| Hand swings out/through body during a blend | angle-space blend between distant configurations | crossfade into a near-body clip; shoulder range normalisation |
| Elbow over the head | pole vector | `ELBOW_POLE`/shared hold poles |
| Head inside a prop or other head | stacked lean offsets, blocking | stand closer, cap `maxLean`, reduce clip lean |
| Posture pops at move start/end | unsmoothed style weight | smooth in bake post-pass |
| Dead second | long hold with no secondary | `offset` creep, giggle/nod additive |
| Character missing | draw order / hidden ranges | check first sheet |

Never declare success from a typecheck or a single frame.

## Additional automated checks
- `npm test` renders every 3rd frame (plus first/last) of every scene to SVG
  markup and fails on any `NaN` (React drops such elements silently in
  Chromium — this caught a last-frame smear bug).
- `npm run qa:all` runs engine QA on every scene; `npm run bench` A/Bs arm
  blending; `node scripts/bench-engines.mjs` times Remotion SVG / PixiJS (GPU and
  SwiftShader) / Godot / Blender on the same 120-frame workload.
- Audio sync: `npm run verify` (see video-rendering) checks cue onsets.
