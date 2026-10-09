# Stickman Video Factory — code-driven 2D cartoon animation studio

Expressive stickman-inspired cartoon characters animated by a hierarchical
rig, reusable motion clips and a choreography/scene system, composed and
rendered deterministically with Remotion. Priority: **animation quality**
(believable, continuous, character-driven motion), not feature count.

## Stack (decided — see STATUS.md TOOLING_AUDIT for evidence)
- **Remotion 4.0.534** (React, TypeScript) — composition, preview (Studio), rendering.
- **Own rig/motion engine** in `src/engine/` (pure TS, renderer-agnostic): FK
  skeleton, two-bone IK, locomotion planner, clip layering, expressions,
  look-at, spring secondary motion, props physics (analytic ballistic), camera.
- **SVG renderer** in `src/render/` — production renderer.
- **PixiJS 8** — evaluated via `src/bench/PixiBench.tsx` (same engine output);
  not used for production. Do not add a second production renderer or engine
  (Motion Canvas, Bones, Matter.js were evaluated and rejected — STATUS.md).

## Layout
```
src/engine/      math, types, rig (FK/IK), anchors, expressions, locomotion,
                 clips, runtime (scene evaluation + caches), camera, scene (data types)
src/characters/  CharacterSpec definitions (Pip, Bo)
src/render/      Character (SVG), SceneView, Room (set), Props, Fx
src/scenes/      SceneDef data (theSurprise.ts = the demo)
src/compositions/ Remotion wrappers (SceneComposition, RigLab)
src/bench/       PixiJS renderer benchmark
scripts/         qa-motion.ts, probe.ts, stills.mjs, contact-sheet.sh,
                 render-final.sh, verify-render.mjs
tests/           vitest rig/locomotion/determinism tests
```

## Skills (`.claude/skills/`) — load the matching one before working
| Skill | Use for |
|---|---|
| animation-director | beat sheet, blocking, acting, camera plan |
| character-rigging | rig, IK, proportions, expressions, character drawing |
| motion-choreography | moves, clips, timing, anticipation/follow-through |
| cartoon-scene-production | SceneDef authoring, props, set, compositions |
| animation-qa | metrics + sequential frame review + channel forensics |
| video-rendering | preview, deterministic render, ffprobe verification |
| remotion-* (official, remotion-dev/skills) | Remotion APIs, Studio, render CLI, docs lookup |

## Agents (`.claude/agents/`)
animation-director (direction), rigging-engineer (rig), motion-designer
(clips/locomotion), render-engineer (render + verification),
visual-qa-reviewer (independent read-only review). Delegate only when the
specialisation helps; the main agent integrates and does final verification.

## Animation principles enforced in code
Anticipation (jump crouch, armsUp dip, point cock-back), slow in/out (eases on
every layer blend), arcs (angle-space interpolation, ballistic props), follow-
through/overlap (spring torso/hair/head-nod, staggered arm beats), squash &
stretch (torso/head only — limbs keep length), secondary motion (hair, breath,
blinks, environment), weight (pelvis drops to keep planted feet), staging
(look-at with eyes leading head), exaggeration via expressions + posture.

## Commands
```
npm run dev              # Remotion Studio preview
npm test                 # rig/IK/locomotion/determinism unit tests
npm run typecheck
npm run qa               # engine motion QA (hard fails on slide/stretch/NaN)
npm run probe -- 262 300 # anchor/prop positions at frames (authoring aid)
npm run render:preview   # quarter-res render for contact sheets (~25 s)
scripts/contact-sheet.sh out/qa/low.mp4 out/qa/sheets 6
node scripts/stills.mjs TheSurprise out/qa/stills 0.5 262 342
npm run render           # deterministic final MP4 (PNG frames -> x264)
npm run verify           # ffprobe/decode/motion/repro checks
```

## Quality acceptance rules
- `npm test` and `npm run qa` pass (limb error ≈ 0, planted slip 0 px, IK miss 0 px).
- No static second during active beats; pops only at intentional snaps.
- Visual review of contact sheets + full-res stills before claiming quality;
  never claim to have "watched" a video — say "inspected sequential frames".
- Final MP4: 1080×1920, 30 fps, expected frame count, decodes cleanly,
  reproducible (frame MD5s identical across two renders).

## Git workflow
- Develop on the assigned feature branch; commit meaningful steps with clear
  messages; push with `git push -u origin <branch>`; open a draft PR.
- `out/` is git-ignored (renders, QA artefacts). Never force-push.

## Safety
- Never commit secrets/.env; no credentials in code or STATUS.md.
- Hooks are lightweight (typecheck only). Do not add hooks that install
  packages or render.
- Review third-party skills/plugins before enabling (all current ones reviewed).

## Status updates
`STATUS.md` is the single canonical status file (incl. TOOLING_AUDIT). Update
it after every meaningful change. Do not create other progress reports.
