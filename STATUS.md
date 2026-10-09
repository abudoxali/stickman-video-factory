# STATUS — Stickman Video Factory

_Last updated: 2026-10-10 on `claude/local-studio-bonk` (milestone-2 final pass: independent re-verification, ball-rest fix, Blender MCP, BONK! comparison)._

## V1 status

**V1 implementation complete — visual acceptance pending. Completion: 98%.**
The remaining 2% is owner review of the final SHOW-OFF animation and merge
approval. There is no known critical production blocker.

The repository is now a reusable animation factory rather than a collection of
hardcoded demonstrations: one declarative `SceneDef` catalog drives Remotion
Studio, validation, preview, render, verification and animation QA. A new story
can be scaffolded, authored and rendered without modifying the motion engine.

## Implemented functionality

- Production Remotion/SVG pipeline with hierarchical Pip/Bo rigs, FK/IK,
  locomotion, foot planting, clip layers, expressions, look-at, secondary
  motion, smears, reusable sets, props/ballistics, camera and synchronized SFX.
- **SHOW-OFF**: 600-frame/20-second park story with staged opening, three reach
  attempts, reusable Blender `warmUp`, ball/apple interactions, close-ups,
  physical-comedy payoff and final character ending.
- Focused engine improvements: auto-framed keyed shots, subject bounds and
  framing QA, softened joints/silhouettes, `eat`/`hit` and keyed external clips,
  apple bite states, prop freeze-at-grab, retargeting, floor/contact fixes and
  character-filtered automatic landing sounds.
- Reusable authoring: schema/reference/timeline validator, single scene catalog,
  scene scaffolder, selected-scene CLI and independent `FactoryExample` proving
  reuse of characters, clips, park, ball, camera, FX and audio.
- Cross-platform output and QA: preview/full render, ffprobe/decode/motion/audio
  verifier with per-output JSON reports, contact sheets, stills and whole-catalog
  motion QA.

## Production architecture

```text
Story -> SceneDef -> validation/catalog -> TS rig + motion + camera + audio
      -> SVG SceneView in Remotion Studio -> deterministic PNG/WAV render
      -> FFmpeg H.264/AAC MP4 -> metadata/decode/motion/audio QA
```

Remotion remains the production compositor. Godot and Blender remain optional
contributing authoring engines; neither replaces the renderer.

## Scene and output status

| Composition | Frames | Status |
|---|---:|---|
| TheSurprise | 720 | registered; markup and full motion QA pass |
| MotionLibrary | 1020 | registered; markup and full motion QA pass |
| Bonk | 570 | existing verified 1080x1920 production preserved; regression QA pass |
| ShowOff | 600 | final 1080x1920 H.264/AAC output rendered and verified at `out/show-off-final.mp4` (MD5 `da9b865ffc174e79563f5fcca458740f`) |
| FactoryExample | 180 | independent authoring proof previewed, rendered and verified |

`out/` is intentionally ignored by Git. Exact production commands:

```bash
npm run dev
npm run scene:list
npm run scene:validate
npm run scene:new -- my-story
npm run scene:preview -- show-off out/qa/show-off-low.mp4
npm run scene:render -- show-off out/show-off-final.mp4
npm run scene:verify -- show-off out/show-off-final.mp4
npm run qa:all
```

## Blender and Godot

- Blender 5.2.2 LTS was used on this machine to export the editable 67-frame,
  11-channel `warmUp` action from `out/blender/clip_lab.blend` into tracked
  `src/clips/warmUp.json`. The clip is retargeted in SHOW-OFF and MotionLibrary.
  `npm run blender:clip:export` preserves animator edits; `blender:clip:rebuild`
  reconstructs the authored action before exporting.
- **Blender MCP (official Blender Lab extension) — configured and used live.**
  `BLENDER_PATH` set as a user environment variable (Blender 5.2.2 is not on
  PATH); Blender Lab repository added, add-on `mcp` 1.0.3 installed and enabled
  with Blender's own CLI (`--online-mode`); add-on source reviewed (socket binds
  localhost:9876). The bridge runs headless with `npm run blender:mcp`
  (`blender -b <file> --online-mode -c blender_mcp`). Through the live MCP tools
  (`get_objects_summary`, `execute_blender_code`) the `warmUp` action was
  authored, inspected and exported, and `clip_lab.blend` re-opened after
  restart (action 0–66, 34 F-curves). MCP inspection found a real rig bug: the
  lab bones' local Z axis is tilted out of the drawing plane (tail y = 0.153),
  so Euler-Z keys swung limbs toward the camera — authoring now uses axis-angle
  about the plane normal (angles hit targets within 0.02 rad, y = 0).
  Remaining user step for the extension's *CLI-mode* tools (`*_for_cli`):
  restart the Claude desktop app once so its MCP server inherits
  `BLENDER_PATH` (they reported "executable not found" in the old process).
- Godot MCP was verified live from this session on 2026-10-09: project info,
  opened `kid_red.tscn`, read its 6-clip library, added a keyframe to `wave`,
  read it back and removed it (scene left unsaved, files unchanged).
- Godot 4.6.2 integration, Skeleton2D/AnimationPlayer lab and localhost MCP
  configuration are preserved. The server lists 21 tools. This session's live
  edit/read recheck could not acquire the editor because its single client
  connection was already owned by another active MCP client; no process was
  killed or project state disturbed. Previously verified functional workflow
  and generated lab files remain intact.

## Verification evidence

- Dependencies: clean `npm ci` completed (484 packages).
- TypeScript and ESLint pass; **45/45** unit/production/render-markup tests pass;
  all five scenes pass `qa:all` with zero IK misses and no hard failures.
- All five catalog entries pass scene schema/reference/timeline validation.
- `FactoryExample` preview: 270x480, 180 frames, 6.02 s, clean decode, no frozen
  transitions, 2/2 audio onsets, peak -6.1 dB.
- SHOW-OFF preview: 270x480, 600 frames, 20.01 s, clean decode, no frozen
  transitions, 26/29 authored onsets detected (37 cues including automatic
  footsteps/landings), peak -0.7 dB.
- SHOW-OFF final (2026-10-10, after the ball-rest fix below): H.264/yuv420p
  1080x1920 at 30 fps, 600 frames/20.00 s, AAC 48 kHz stereo, 11.9 MB, peak
  -0.7 dB; full decode passes, 0/599 frozen transitions, 26/29 authored cue
  onsets detected. Renders at concurrency 4 and 2 are **byte-identical**
  (MD5 `da9b865ffc174e79563f5fcca458740f`). Before the fix, a re-render of the
  committed HEAD from a clean worktree reproduced the previous final exactly
  (MD5 `fa10fed3d6e545093e11bac2e17a5fcd`).
- Independent re-verification of commit b3a120c in a clean worktree: tsc and
  ESLint clean, 45/45 tests, all five scenes pass motion QA and validation.
- Fix after review of the f528–583 frames: the ball came to rest on top of the
  fallen Pip (prop overlapping his body, f550–562); it now bounces away over his
  head and rolls out of frame (dense sheet re-inspected).
- SHOW-OFF motion QA: limb error <= 7.1e-14 px, planted slip 0.00 px, IK miss
  0.00 px, floor penetration 0, no clipped character while acting. The one
  low-motion second is the intentional opening apple hold; render verification
  found no frozen frame transition.
- Visual QA inspected five whole-film sequential contact sheets, two dense
  sheets for frames 528-581 and three FactoryExample sheets. The late camera
  restaging keeps the impact/fall readable, avoids unintended head clipping,
  holds the reaction, then cuts cleanly to Bo for the final bite.

## SHOW-OFF compared with BONK!

Visual comparison at matched beats (establishing, throw wind-up, reaction,
impact) plus measured framing: `out/bonk-vs-show-off.png` (BONK! frames from
the untouched baseline render `out/bonk-baseline-m2start.mp4`, MD5
`df4e86b64fb6e4fd5bbdcdef9e014cf5`). Same engine QA on both films:

| Metric (whole film) | BONK! | SHOW-OFF |
|---|---|---|
| Mean character screen height (Bo / Pip) | 0.30 / 0.34 | 0.57 / 0.47 |
| Frames cut by a frame edge while acting, camera holding (Bo / Pip) | 6 / 54 | 0 / 0 |
| Empty headroom above subjects | 0.45 | 0.35 |
| Subject span of frame height | 0.34 | 0.51 |
| Editing cuts | 0 | 9 |
| Abrupt camera frames | 4 | 7 (one deliberate whip-pan riding Pip's topple, f533–539; inspected) |
| Planted slip / IK miss / floor penetration | 0 / 0 / 0 | 0 / 0 / 0 |
| Authored SFX onsets detected | 14/15 | 26/29 |

Readability fixes visible in the comparison: the cocked throwing arm and ball
no longer cover the thrower's face (near arm drawn behind the head; ball on a
`behind:<char>` layer), the story object is staged in the vertical frame
instead of empty sky, and reactions get real close-ups via cuts.

- Framing: SHOW-OFF uses subject-bound auto-framing and explicit reaction cuts;
  important acting occupies more of the vertical frame with less empty space.
- Clipping/continuity: dense late-frame inspection found no unintended character
  clipping or missing props; the f572 hard cut separates the fall from the
  final reaction clearly.
- Motion: both retain intentional smeared whip/impact pops; SHOW-OFF adds a
  retargeted Blender action and reusable eat/hit acting. Foot/limb/contact QA
  remains within existing hard thresholds.
- Sound: SHOW-OFF separates the landing tail from the final bite and lowers the
  stacked impact pair; 26/29 authored onsets were detected versus BONK!'s
  existing 14/15 result. Quiet cues masked by louder simultaneous sounds remain
  a detector limitation, not missing tracks.
- Reusability: BONK! is a production demo; SHOW-OFF plus FactoryExample now sit
  on the validated catalog/scaffolder/selected-scene workflow.

## Tools and skills actually used

Remotion Studio/rendering, React/TypeScript, FFmpeg/ffprobe, Vitest, ESLint,
Blender 5.2.2, Godot MCP smoke tooling, Git/GitHub CLI, project skills for
animation direction, rigging, motion choreography, scene production, animation
QA and video rendering, plus Remotion creation/markup/multimedia/studio/render
guidance. Parallel read-only audit agents reviewed SHOW-OFF, authoring and
external-engine tooling before integration.

## Remaining limitations

- Uncommitted working-tree edits to `tests/factory.test.ts` and
  `tests/render-markup.test.tsx` (written 2026-10-10 00:35, outside this
  milestone's work) specify a "hand-drawn-stickman" visual style that is not
  implemented; they fail until it is. They were left untouched and are not part
  of any commit; the committed tree passes 45/45.

- Final artistic approval is subjective and pending owner review.
- Godot's editor accepts a single live MCP client; a fresh mutation test must
  wait until the currently connected client releases it.
- Fast intentional whip/impact poses can exceed the generic pop threshold but
  are smeared and visually inspected. Some quiet simultaneous SFX onsets are
  masked in waveform detection.
- The main production format is vertical 1080x1920. Arbitrary dimensions are
  validated, but horizontal/square presets were not added because they require
  deliberate shot reframing rather than blind crop/stretch.
- No paid voice generation, lip-sync, publishing backend or SaaS UI is included;
  these are outside V1 acceptance.

## Exact next action

Owner reviews `out/show-off-final.mp4` (also delivered as a file in the session) against `out/bonk-vs-show-off.png`; if accepted, approve and merge PR #1. Optional one-time step: restart the Claude desktop app so the Blender MCP extension's CLI-mode tools pick up `BLENDER_PATH`.
