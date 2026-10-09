---
name: animation-director
description: Turn a story beat or script into professional animated staging for this studio — beat sheet, blocking (who stands where), timing in frames, acting choices per character, camera framings and the emotional arc — expressed as a SceneDef in src/scenes/. Use when asked to plan, direct, stage, block or "make a scene/story/short" with the cartoon characters, or when a scene reads as static, confusing or unfunny.
---

# Animation Director

You own clarity, staging, timing and the emotional progression of a scene.
The engine animates whatever you author; bad direction cannot be fixed by
better interpolation.

## When to use
- A new story, gag or beat needs to become an animated scene.
- An existing scene is hard to read without narration, feels static, or a
  beat lands flat.
- Camera work feels random or a framing hides the action.

## Inputs you need
- The beat list (what happens, in order, and why it is funny/moving).
- Characters available: `src/characters/index.ts` (Pip: tall, curious,
  springy; Bo: short, round, mischievous). New characters = a new
  `CharacterSpec` (see the character-rigging skill).
- The set: `src/render/Room.tsx` exposes `ROOM` coordinates (floor y = 1500,
  door x 110–310, desk x 700–1050 top 1222, window). World units = px at zoom 1.

## Procedure
1. **Write the beat sheet in frames** (30 fps). Put it as the doc comment at
   the top of the scene file, like `src/scenes/theSurprise.ts`. Each beat gets
   a frame range and one sentence of visible action (no dialogue needed).
2. **Block positions first.** Decide each character's x per beat. Rules that
   were learned the hard way in this repo:
   - Keep heads ≥ (headR_A + headR_B) ≈ 145 px apart unless they touch on
     purpose; leaning/laughing clips add 50–90 px of head travel.
   - A character reaching a prop should be able to do it with ≤ 0.15 rad
     auto-lean (shoulder-to-target ≤ 0.97 × arm length ≈ 159 px for Pip).
   - Never place a prop between two close characters if one must bend to it
     (their head will hit the other's body). Put it behind or beside them and
     add a `turn` move.
3. **Act it out per character**: for every beat choose locomotion moves,
   action clips, expression keys and look keys. Eyes lead, head follows
   (automatic, 4-frame lag); author a *look change before every reaction*.
   Use reaction delay: the reacting character starts 3–5 frames after the
   cause (Pip leaps 4 frames after the door bursts).
4. **Contrast**: give both characters different reactions to the same event
   (Pip panics → giggles → laughs; Bo is shocked → blind → annoyed → happy).
5. **Camera**: plan ≥ 3 intentional framings. Use `camera.keys` with eases:
   wide establishing → slow push-in on discovery (`inOutCubic`, 40–60 frames)
   → close-up for the intimate beat → fast whip-out on the surprise
   (`outCubic`, 8–10 frames) + `shakes` on impacts → medium two-shot → final
   push-in. Pan to follow any action that leaves frame (half visible width
   = 540 / zoom).
6. **Moving holds**: a held pose still needs life (breathing is automatic;
   add an `offset` additive clip with a long blend-in to creep closer, or a
   `giggle`/`nod` additive).
7. Hand the SceneDef to the production loop (cartoon-scene-production) and
   review with animation-qa.

## Acceptance checks
- The story is understandable with the sound off and no text.
- Every beat has at least one character in motion (`scripts/qa-motion.ts`
  reports `static seconds: 0`).
- ≥ 10 meaningful actions, ≥ 3 camera framings, clear anticipation before
  big actions, a final "button" (e.g. grin to camera).

## Common failure modes
- Slideshow feel: poses change but nothing travels → add locomotion and
  overlapping action, avoid long identical holds.
- Reaction on the same frame as the cause → reads as mechanical.
- Camera zoomed in while the action happens off-frame (check edges at the
  action's peak, e.g. a pick-up bend).
- Look-at targets on a prop attached to the *same character's hands* resolve
  against the pre-action pose (look is evaluated before clips) — use `"up"`,
  `"down"` or a point instead.
