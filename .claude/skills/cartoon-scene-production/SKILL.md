---
name: cartoon-scene-production
description: Produce a complete animated cartoon scene in this repo — SceneDef data (characters, props with static/ballistic/attach states, keyed params, FX, camera, draw order), set/props rendering, Remotion composition registration, probing positions and iterating to a reviewed render. Use when building or modifying a scene in src/scenes, adding props or set pieces, wiring a new composition, or making characters interact with objects.
---

# Cartoon Scene Production

## Files
- Scene data: `src/scenes/<name>.ts` exporting a `SceneDef`
  (`src/engine/scene.ts` documents every field).
- Composition: register in `src/Root.tsx` via
  `makeSceneComponent(def)` (`src/compositions/SceneComposition.tsx`).
- Renderer: `src/render/SceneView.tsx` (camera, parallax, draw order,
  shadows, onion-skin smears), `Room.tsx` (set), `Props.tsx` (props),
  `Fx.tsx` (dust, puff, smoke, confetti, sparkle, impactLines, ...).

## Props
`PropTrack.states` is a time-ordered list:
- `static {pos, rot}`
- `ballistic {to, dur, peak, spin|endRot, bounces, skid, fromPos?}` — a true
  parabola from the previous state's position at `from` (constant x speed,
  constant gravity), landing exactly on the authored frame and spot.
- `attach {char, part, offset, rot, inheritRot, blend}` — follows a
  character anchor; offset/rot mirror with facing.
Also: `layer` + `layerKeys` (back/front/char:<id>), `shadow`, `smear`,
`hidden` ranges, keyed `params` (e.g. `glow`, `flame`, `unroll`, `squash`).
New prop art = a component in `PROP_RENDERERS` (origin conventions noted
per prop).

## Procedure
1. Draft the SceneDef from the director's beat sheet.
2. **Probe** real positions before hand-placing props:
   `npx tsx scripts/probe.ts 262 300 342` prints head/mouth/hand anchors and
   prop positions per frame. Make ballistic `to` points match the receiving
   anchor at the landing frame (otherwise the attach blend pops).
3. Iterate quickly at quarter resolution (~25 s for 24 s of video):
   `npx remotion render TheSurprise out/qa/low.mp4 --scale=0.25`
   then `scripts/contact-sheet.sh out/qa/low.mp4 out/qa/sheets 6` and read
   the sheets. Full-res spot checks: `node scripts/stills.mjs <Comp> out/qa/stills 0.5 <frames...>`.
4. Fix staging/clip issues, re-run `npx tsx scripts/qa-motion.ts`.
5. Final render + verification via the video-rendering skill.

## Acceptance checks
- `qa-motion`: PASS, static seconds 0, no unexpected prop jumps.
- Draw order correct: characters hidden by doors (`hidden` + `drawOrder`
  with `set:door` between them), held props in front of the holder, props
  resting on furniture behind the reaching character until they move.
- No head/prop interpenetration in sheets; actions stay inside frame.

## Common failure modes
- Dangling `else` in draw-order code once hid every character — always
  check the first contact sheet for presence of all characters.
- A character's head drawn over a prop it is reaching for (stand closer, cap
  `maxLean`).
- Prop attachment switches without matching positions → pops (qa-motion
  "prop jumps"). Use `blend` 2–4 frames and probe to align.
