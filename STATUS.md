# STATUS — Stickman Video Factory

_Last updated: 2026-10-09 (session on branch `claude/nice-babbage-j91qfr`)._

## Current implementation status
**Milestone 1 (first professional animation demo): delivered, ~85 % of the
milestone scope complete** (see "Known gaps" — Context7 docs blocked by quota,
IK-space blending and limb smears not implemented).

| Area | State |
|---|---|
| Remotion project (TS/React) | done — compositions `TheSurprise`, `MotionLibrary`, `RigLab`, `PixiBench`; Studio preview verified |
| Rig engine (FK + two-bone IK, joint limits, pelvis-drop grounding) | done, unit-tested |
| Locomotion planner (walk/tiptoe/stagger/brisk/run, turn, jump+land, step, sit/standUp, fall/getUp) | done, foot-slide-tested |
| Motion clips (29) + expressions (19, with posture) + look-at + blinks + breathing | done |
| Secondary motion (spring hair, torso follow-through, head nod) | done |
| Props (static / slide / ballistic+bounces / attach), FX, onion-skin prop smears | done |
| Camera (keyed framings, log-zoom easing, trauma shake, parallax) | done |
| Demo **THE SURPRISE** (24 s, 1080×1920, 30 fps) | rendered + verified |
| Motion-library test reel (clips not used in the demo) | rendered + QA'd |
| QA tooling (engine metrics, contact sheets, stills, ffprobe/repro) | done |
| Claude Code skills (6 project + 8 official Remotion), 5 subagents, hook, CLAUDE.md | done, discovery verified |

## Deliverables
- Demo: `out/the-surprise.mp4` (git-ignored render output; reproduce with
  `npm run render`). Reel: `out/motion-library.mp4`.
- Preview: `npm run dev` (Remotion Studio) → compositions above.
- Scene data: `src/scenes/theSurprise.ts`, `src/scenes/motionLibrary.ts`.

## Verified functionality (actual results)
**Unit tests** (`npm test`): 11/11 pass — IK accuracy (< 0.01 px), constant
limb lengths under random poses, planted feet never slide (normal/tiptoe/
stagger walks), run flight phase, jump landing/events, determinism across
runtimes, IK reach of planted feet, no NaNs.

**Engine motion QA** (`npm run qa`, every frame):
| Scene | limb error | planted slip | IK miss | static seconds | actions+moves | clips | camera |
|---|---|---|---|---|---|---|---|
| the-surprise (720 f) | ≤ 9e-14 px | 0.00 px | 0.00 px | 0 | 33 | 20 | 18 keys, zoom 1.06–2.18, 3 shakes |
| motion-library (870 f) | ≤ 7e-14 px | 0.16 px | 0.00 px | 0 | 32 | 14 + 8 move types | 6 keys |

Pop warnings (> 60 px/frame joint travel) remain only at deliberate fast
actions: Pip's startle flail (f 305–336), Bo's "Surprise!" arm snap
(305–307), Bo's blind panic (354–397), celebrate pumps.

**Render verification** (`node scripts/verify-render.mjs out/the-surprise.mp4 --compare out/qa/the-surprise-repeat.mp4`):
h264 / yuv420p, **1080×1920, 30 fps, 720 frames, 24.00 s**, 15.2 MB, full
decode OK, 0 frozen transitions (longest freeze 0 frames), motion energy
every second > 0.7, **reproducibility 720/720 frames bit-identical; the two
MP4 files are byte-identical** (independent renders at concurrency 4 and 2).

A third end-to-end run of the committed `scripts/render-final.sh` with the
final code produced the **same MD5 (`dd05cc6794aaf94f59cbea9e73e4a232`)** as
the delivered `out/the-surprise.mp4`. MotionLibrary reel: 1080×1920, 30 fps,
870 frames, 29.00 s, decode OK, 0 frozen transitions.

**Preview verified:** `npx remotion studio --no-open` served HTTP 200; a
Playwright-driven Chromium session loaded the Studio, listed TheSurprise,
MotionLibrary, PixiBench, RigLab, showed TheSurprise as 1080×1920 / 30 fps /
00:24.00 with a rendered preview frame, and reported no page errors.

**Determinism investigation (real finding):** Remotion's default render path
produced runs differing in 177–205 frames (PSNR 48–65 dB). Bisected: engine
output identical across runtimes/evaluation orders; Chromium PNG frames
byte-identical across full runs (720/720); **multi-threaded x264 produced
different MP4s from identical PNGs** on the full sequence (a 41-frame test
had hidden it). Fix: `scripts/render-final.sh` = PNG frames → x264
`-threads 1` (≈ 2 min encode).

**Visual review performed** (sequential frames, not real-time playback):
quarter-res contact sheets of every 4th/6th frame of the whole demo and reel,
2–4-frame sheets around the big actions, full-res stills of key frames and
40 %-scale key frames from the final MP4. Issues found and fixed through
this loop are listed under "QA history".

## Demo content check (acceptance gate)
| Criterion | Result |
|---|---|
| Two distinct animated characters | ✅ Pip (tall, coral hoodie, antenna curl, springy gait) / Bo (short, round, teal sweater, quiff, quicker steps) |
| Multiple connected story beats | ✅ 6 beats (entrance → discovery → interaction → surprise → physical comedy → ending) |
| ≥ 10 meaningful actions | ✅ 33 authored moves/actions (walk, double take, think, tiptoe, reach+lift lid, door burst, leap+turn, flail, swat, box flight onto head, stagger, cover-mouth giggle, box pull-off+toss, laugh, turn, pick-up, blow out candle, hand-over, horn toot, celebrate, grin to camera) |
| Anticipation & follow-through | ✅ jump crouch, armsUp dip, point cock-back, sit counter-lean, landing compression with spring recovery, torso follow-through spring, hair/quiff springs |
| Believable foot contact | ✅ 0.00 px planted slip (measured), heel-strike/toe-off pivots, pelvis drops to keep reach |
| Non-trivial character–object interaction | ✅ lid lifted by IK hand, box swatted on a ballistic arc onto Bo's head (attached to head, then hands), box tossed, horn dropped/picked up/handed over, candle blown out |
| ≥ 3 intentional camera framings/transitions | ✅ wide establishing → push-in medium → close-up → whip-out two-shot with shake → medium → pick-up follow pan → final push-in |
| Meaningful secondary motion | ✅ hair/quiff springs, breathing, blinks (eyes lead head), torso follow-through, sway, balloons/bunting/curtains/pendant/dust motes/clouds |
| Consistent visual identity | ✅ one ink colour/outline weight, shared palette, single set |
| Verified MP4 render | ✅ see render verification |

## Tools actually installed / skills / MCP results
- **Installed (npm)**: remotion 4.0.534, @remotion/cli 4.0.534, react 19.2.3,
  typescript 5.9.3, pixi.js 8.22.0 (dev, benchmark only), vitest 3.2.7, tsx 4.x.
- **System**: Node 22.22.0, npm 10.9.4, Git 2.43.0, FFmpeg/ffprobe 6.1.1,
  Chromium (Remotion headless shell + Playwright 1194). 4 vCPU, no GPU.
- **Environment**: Claude Code 2.1.295 **cloud session** (claude.ai/code remote
  container, Linux). Plugins/skills persist via committed `.claude/` files.
- **Skills available** (verified with a fresh headless `claude -p` process):
  remotion-best-practices, remotion-create, remotion-markup, remotion-studio,
  remotion-render, remotion-docs, remotion-multimedia, remotion-captions,
  animation-director, character-rigging, motion-choreography,
  cartoon-scene-production, animation-qa, video-rendering.
- **Subagents available** (same check): animation-director, rigging-engineer,
  motion-designer, render-engineer, visual-qa-reviewer.
- **Plugins** (`.claude/settings.json`, project scope): context7, commit-commands
  (component inventory verified via `claude plugin details`). code-review
  and pr-review-toolkit: already available via org-synced plugins (not reinstalled).
- **MCP**: Context7 remote MCP — installed + configured; HTTP handshake and
  `tools/list` succeed (`resolve-library-id`, `query-docs`), but
  `query-docs` returns "Monthly quota exceeded" anonymously; `claude mcp list`
  reports "Needs authentication". **Not usable for docs without a
  `CONTEXT7_API_KEY`.** Fallback used: official Remotion docs via the
  remotion-docs skill (Algolia search + `.md` pages, e.g. `gl-options.md`) and
  installed package typings (`node_modules/pixi.js/lib/**/*.d.ts`) for PixiJS v8.
- **Hook**: PostToolUse typecheck on TS edits (`.claude/hooks/typecheck-on-edit.sh`),
  tested: exit 0 on clean code, exit 2 with errors on broken code.

## TOOLING_AUDIT
| Technology | Repository | Purpose | License | Version | Integration | Where used | Evidence | Decision |
|---|---|---|---|---|---|---|---|---|
| Remotion | github.com/remotion-dev/remotion | composition, Studio preview, rendering | Remotion License: free for individuals/small companies, company license for larger for-profits | 4.0.534 | ✅ | `src/Root.tsx`, compositions, all renders | 720-frame renders, Studio | **Accepted** |
| Remotion Agent Skills | github.com/remotion-dev/skills | agent guidance for Remotion | no root LICENSE file found (HEAD/LICENSE 404) — unverified | skills CLI 1.7.1, skills v4.0.534 | ✅ installed project-local (`--copy`), 8 skills | `.claude/skills/remotion-*` | discovered by fresh `claude -p`; used: create (scaffold cmd), markup (frame-driven rules, no CSS animation), render (`--frames`, stills), studio, docs (Algolia lookup) | **Accepted** |
| Claude plugins official | github.com/anthropics/claude-plugins-official | context7, commit-commands | per plugin (Anthropic/MIT) | marketplace HEAD | ✅ project scope | `.claude/settings.json` | install success + `plugin details` | **Accepted** |
| Context7 | github.com/upstash/context7 | version-specific docs | MIT | remote MCP 4.2.0 | ⚠️ configured; docs quota-blocked | — | handshake + tools/list OK; query-docs "Monthly quota exceeded" | **Accepted, needs API key** |
| Graft | github.com/trailhq/Graft (npm @nanonets/graft) | codebase graph | MIT | 0.21.1 | dry-run only | — | dry-run: would modify `.claude/settings.json`, add hooks on every prompt/tool call and write user-level `~/.claude*` config | **Rejected** (overwrites Claude config; low value for ~45-file repo) |
| Repomix | github.com/yamadashy/repomix | repo packing | MIT | — | not installed | — | repo small; targeted reads sufficed | **Not needed** |
| PixiJS | github.com/pixijs/pixijs | WebGL 2D renderer candidate | MIT | 8.22.0 | ✅ benchmark composition | `src/bench/PixiBench.tsx` | same engine output rendered via WebGL (`--gl=swangle`); 150 frames: **38.1 s** (simplified silhouettes) vs **17.0 s** SVG full-detail scene; PNG frames deterministic across runs | **Rejected for production** (slower without GPU, no quality gain for vector cartoon art; kept as benchmark) |
| Motion Canvas | github.com/motion-canvas/motion-canvas | generator-based animation pipeline | MIT | 3.17.2 (npm, last publish 2025-02-16) | not installed, **no PoC built** | — | package/docs review | **Rejected**: competing renderer/editor/exporter pipeline overlapping Remotion; imperative generator timelines vs our JSON scene data |
| Bones | github.com/foundermafstat/bones | PixiJS rigging/animation studio | **no LICENSE file** (all rights reserved by default) | `@bones/runtime-pixi` 0.0.0, private, not on npm | shallow-cloned for inspection only | — | monorepo workspace package, rigs authored in GUI editor | **Rejected** (licensing, not distributable, GUI-authored assets) |
| Matter.js | github.com/liabru/matter-js | rigid-body physics | MIT | 0.20.0 (npm) | not installed | — | analytic ballistic+bounce gives exact landing frame/spot needed for comedic timing | **Rejected** |
| Rough.js | github.com/rough-stuff/rough | hand-drawn style | MIT | 4.6.6 | not installed | — | clean ink style chosen; seeded jitter adds risk | **Not adopted** |
| @remotion/lottie / Rive | remotion-dev / rive-app | prepared vector animations | Remotion / MIT | — | not installed | — | no prepared assets; procedural rig instead | **Not needed** |
| FFmpeg / ffprobe | ffmpeg.org | encode, inspect, contact sheets | LGPL/GPL | 6.1.1 | ✅ | `scripts/render-final.sh`, `verify-render.mjs`, `contact-sheet.sh` | found x264 multi-thread nondeterminism; single-thread encode byte-reproducible | **Accepted** |
| Vitest, tsx | vitest-dev/vitest, privatenumber/tsx | tests, TS scripts | MIT | 3.2.7 / 4.x | ✅ | `tests/`, `scripts/*.ts` | 11/11 tests | **Accepted** |

## QA history (issues found by the loop and fixed)
1. No characters rendered (dangling `else` in draw order) — caught on first contact sheet.
2. Think pose elbow folded over the head — pole vector `(-0.7,1)` → `(-0.25,1)`.
3. IK angle unwrap swung arms "through the back" (−2.38 vs +2.18 rad) → shoulder range normalisation `[−1.6, −1.6+2π)`.
4. Pip's head overlapped the gift box (stacked leans 0.58 rad) → restaged + `maxLean` caps.
5. Near arm crossing the face during lid lift → upright posture.
6. Pick-up/laugh heads colliding with Bo → horn lands behind Pip, turn→pick-up→turn back; laugh rock reduced.
7. Bo looked down at a box on his own hands (look-at evaluated before clips) → authored "up"; documented.
8. Tiptoe posture popping 79–157 px at walk start/end → smoothed style weights in bake.
9. 270 px elbow flip in hold→holdPath crossfade → shared poles + hand-off before attachment switch.
10. Run flight frames dropped the run lean every stride (147 px head pop) → fixed grounded weighting.
11. Bo's fall out of frame in the reel → camera pan.
12. Non-reproducible MP4s → traced to multi-threaded x264, fixed.

## Known visual limitations
- Characters are 3/4-profile rigs; turns use a fast edge-on squash flip (no true front/back views).
- Layer blends interpolate joint angles; between distant poses the hand can arc wide (IK-space/hand-target blending not implemented).
- Fast gestures (startle flail, panic, Surprise! snap) peak at 120–140 px/frame wrist travel; no limb smear frames (only props get onion-skin smears).
- Look-at to a prop attached to the same character's hands resolves against the pre-action pose.
- During the swat (f ~318) the flying box passes in front of Pip's body.
- Hands are mittens (open/fist/point); no finger articulation; no lip-sync, no audio.
- Up to 2 sole samples per character dip ≤ 2.5 px below the floor at heel strikes.
- Lighting is flat apart from the gift glow and vignette.

## Next executable task
Implement hand-target (IK-space) blending for arm layers in
`src/engine/runtime.ts` `applyLayer` (blend wrist world targets, re-solve IK)
plus 1–2-frame limb smear drawing in `Character.tsx` for wrist speed
> 90 px/frame; re-run `npm run qa` and confirm the startle/panic pop
warnings drop, then re-render and verify.
