---
name: character-rigging
description: Build, modify and validate the hierarchical 2D character rig in src/engine (FK skeleton, two-bone IK for legs and arms, joint limits, pelvis-drop foot grounding, expressions) and character specs in src/characters. Use when adding a new character, changing proportions, adding a joint/channel, fixing limb stretching, elbows/knees bending the wrong way, feet sinking or sliding, or face/expression rendering.
---

# Character Rigging

## Architecture (read before changing anything)
- `src/engine/types.ts` — `CharacterSpec` (proportions, colours, gait,
  idle) and `Pose` (flat numeric channels: every channel is blendable).
- `src/engine/rig.ts` — hierarchy root → pelvis → spineMid → chest →
  {neck → head, shoulders → elbows → wrists}, pelvis → hips → knees →
  ankles. `solvePose()` = FK for spine/arms + two-bone IK for legs.
  Angle convention: **0 = straight down, +π/2 = forward (+x), π = up**;
  `dir(a) = (sin a, cos a)`. Elbow bend > 0, knee bend < 0.
- Feet are **world-space IK targets** (`fFx/fFy`, `fBx/fBy`). If a planted
  foot is out of reach, the pelvis drops (`hipY` clamp) — limbs never
  stretch. This is what gives weight to walks and landings.
- `reachAngles()` converts a world hand target into shoulder/elbow angles in
  the pose's current `armGrav` convention and normalises the shoulder angle
  into the range `[SHOULDER_MIN, SHOULDER_MIN + 2π)` so blends swing through
  the front, never through the back.
- `src/engine/anchors.ts` — named points (head, headTop, mouth, chin, chest,
  belly, pelvis, handF, handB, hands, feet) used by look-at, props and
  self-contact clips.
- `src/engine/expressions.ts` — face channels + posture offsets per emotion.
- `src/render/Character.tsx` — SVG drawing in rig-local space (one
  `<g transform="translate scale(facing) rotate(bodyRot)">`), far limbs
  first, near arm last; hands near the face draw over the head.

## Procedure: new character
1. Copy a spec in `src/characters/index.ts`. Keep `thigh+shin` ≈ 1.5–2.4×
   `torso`, `headR` ≈ 0.5× torso for cartoon appeal (big head reads at
   phone size). Set a unique `seed` (blink schedule, idle sway).
2. Tune `gait` for personality: `stepFrames` (12 = brisk, 14 = relaxed),
   `bob`, `lift`, `armSwing`, `bounce` (>1 springy).
3. Add it to `scripts/qa-motion.ts` scenes if it gets its own scene; run the
   rig tests.
4. Render `RigLab` (`node scripts/stills.mjs RigLab out/qa 0.5 60`) and
   inspect all expressions. Avoid frames where a blink lands (blinks are on
   a deterministic schedule).

## Procedure: new joint or channel
1. Add the channel to `Pose` and a default in `restPose()`.
2. Consume it in `solvePose()` (and `localShoulder()` if it moves shoulders).
3. Draw it in `Character.tsx`.
4. Add a unit test in `tests/rig.test.ts` (lengths constant, no NaN).

## Acceptance checks (all automated)
- `npm test` — IK accuracy, constant limb lengths, planted feet never slide,
  determinism, no NaNs.
- `npx tsx scripts/qa-motion.ts` — `limbErr ≈ 0`, `slip 0.00px`,
  `ikErr 0.00px` for every character in the scene.

## Common failure modes
- Elbow folds over the head when the hand targets something above the
  shoulder → wrong pole vector; `ELBOW_POLE = (-0.25, 1)` (down, slightly
  back) works for chin/mouth/forward reaches.
- Two IK clips crossfading with different poles flip the elbow mid-blend
  (seen as a 270 px wrist jump) → share poles (`HOLD_POLE_F/B` in clips.ts).
- Stacked forward offsets (expression lean + clip lean + look pitch +
  auto-lean) push the head into props → audit with the channel probe
  (see animation-qa) and trim the largest contributor.
- World-space limb lengths shrink during turns: intentional edge-on flip
  (`facingScale`). Measure lengths in `joints.local`.
