---
name: motion-choreography
description: Author and combine motion for the cartoon rig — locomotion moves (walk, run, tiptoe, stagger, turn, jump, step, sit, standUp, fall, getUp), action clips (point, reach, think, react, celebrate, panic, push, pull, pickUp, handOver, laugh, blow, ...), expression and look-at keys — with anticipation, follow-through, overlap and weight. Use when adding or tuning a motion, writing a new clip in src/engine/clips.ts, fixing pops/snaps/floaty or robotic movement, or timing actions between characters.
---

# Motion Choreography

## Vocabulary (all data, authored in a CharacterTrack)
- **moves** (`src/engine/locomotion.ts`, root motion, baked per scene):
  `walk {to, style: normal|tiptoe|stagger|brisk, stepFrames?, stride?}`,
  `run {to}`, `turn {to: 1|-1, frames}`, `jump {to?, height, crouch, land,
  turn?, depth}`, `step {foot, to}`, `sit {seatX, seatY}`, `standUp`, `fall`,
  `getUp`. Feet are planned as plant/swing segments: planted feet are
  locked (toe-pivot heel-off, heel-strike slap), the pelvis bobs and drops
  via IK, arm swing is derived from real foot separation.
- **actions** (`src/engine/clips.ts`, layered with blend-in/out):
  `{clip, start, end, in?, out?, params?}`. Override clips lerp channels;
  additive clips (`dazedSway`, `giggle`, `nod`, `offset`) add deltas.
  List: point, reach, explain, talk, think, react, celebrate, armsUp, panic,
  duck, push, pull, pickUp, handOver, hold, holdPath, coverMouth, laugh,
  blow, hornBlow, shrug, wave, sneak, lookAround, flail, dazedSway, giggle,
  offset, nod. (`npx tsx -e 'import {CLIP_NAMES} from "./src/engine/clips"; console.log(CLIP_NAMES)'`)
- **expressions**: `{at, expr, blend?, amount?}` — face + posture.
- **look**: `{at, target, blend?, noBlink?}`; target = `{char, part}`,
  `{prop}`, `{point}`, `"camera" | "ahead" | "up" | "down"`. A blink is
  added automatically on each look change (eyes lead, head lags 4 frames).
- Automatic layers: breathing, idle weight-shift, blinks, spring secondary
  motion (hair, torso follow-through after stops, head nod on landings).

## Procedure: write a new clip
1. Add `name: { kind, description, fn(c) }` to `CLIPS`. Use `c.t` (frames),
   `c.u` (0..1), `c.params`, `c.pose` (pose of lower layers), `c.self(part)`
   and `c.target(ref)` for world points, `reachAngles()` for IK.
2. Build **anticipation** into the curve (`progress(c.t, 0, 4)` dip, then
   `ease.outBack` for the main action) and **follow-through** (spring or
   decaying oscillation after the peak).
3. Output only the channels you control. Relative changes: `c.pose.lean + x`.
4. Arms: prefer IK targets from anchors for contact (chin, mouth, belly,
   props); prefer FK angles for expressive gestures.
5. Register in the clip gallery / a scene and run animation-qa.

## Timing rules of thumb (30 fps)
- Snap/take: 3–5 frames anticipation, 2–4 frames action, 8–14 frames settle.
- Reaction delay to an external event: 3–5 frames.
- Blend-in 6–10 frames for gestures; 2–3 only for shocks (but watch wrist
  speed: > 120 px/frame reads as a flicker, not a snap).
- Oscillating gestures (flail, panic, celebrate): angular speed
  ≤ ~0.6 rad/frame.

## Acceptance checks
- `npx tsx scripts/qa-motion.ts`: no hard failures; pops listed only at
  intended snaps.
- Contact sheet of the action at 2–4 frame spacing shows arcs, not
  straight-line teleports.

## Common failure modes (all seen in this repo)
- Style posture switching on at full weight on the first frame of a move
  (tiptoe crouch popped 79–157 px) → style weights are smoothed in the
  bake post-pass; keep any new weight ramped too.
- Crossfading from an IK pose (hand at mouth) straight to hanging FK arms
  swings the hand far out → crossfade into another near-body clip instead.
- A clip whose IK target is a prop attached to the same character switches
  meaning when the prop's attachment changes → end the clip (incl. blend-out)
  before the attachment switch.
- Overlapping moves: the planner delays a move that starts before the
  previous one ends and records a warning (printed by qa-motion/probe).
