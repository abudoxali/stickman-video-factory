# Stickman Video Factory

A code-driven 2D cartoon animation studio: expressive stickman-inspired
characters driven by a hierarchical rig, reusable motion clips and a
choreography system, composed and rendered deterministically with
[Remotion](https://www.remotion.dev).

The first production is **THE SURPRISE** — a 24-second vertical (1080×1920,
30 fps) physical-comedy short told entirely through animation: no narration,
no captions.

> Pip wanders in whistling, double-takes at a mysterious gift, tiptoes over
> and peeks under the glowing lid — just as Bo bursts through the door with a
> party horn. Pip leaps in fright, swats the box, and it flips through the air
> onto Bo's head. When Bo finally pulls it off, the birthday cupcake is
> sitting on his head, candle still lit. Pip laughs, blows it out, hands Bo
> the horn — toot, confetti, grins to camera.

## Quick start
```bash
npm install
npm run dev              # Remotion Studio: TheSurprise, MotionLibrary, RigLab, PixiBench
npm test                 # rig / IK / locomotion / determinism tests
npm run qa               # engine-level motion QA for the demo
npm run render           # deterministic MP4 -> out/the-surprise.mp4
npm run verify           # ffprobe + decode + motion-energy checks
```
Requires Node 20+, FFmpeg/ffprobe for verification scripts. Rendering uses
Remotion's bundled headless Chromium.

A second composition, **MotionLibrary** (29 s, labelled), is a test reel
for the motion vocabulary the demo doesn't use (run, sit/stand, fall/get-up,
push/pull with a sliding crate, point, explain, talk, shrug, wave, duck, …).

## How it works
```
SceneDef (JSON-compatible data: moves, clips, expressions, look-at, props, camera)
   │
   ├─ locomotion planner ── feet planned as plant/swing segments (no sliding),
   │                        pelvis bob + IK pelvis drop, arm swing from feet
   ├─ layer evaluator ───── base → breathing → expression → look-at (eyes lead)
   │                        → action clips (blend in/out) → blinks
   ├─ spring secondary ──── hair, torso follow-through, head nod (cached sim)
   ├─ rig solve ─────────── FK spine/arms + two-bone IK, constant limb lengths
   ├─ props ─────────────── static / ballistic (true parabola) / attached
   └─ camera ───────────── keyed framings with easing + trauma shake
   ▼
SVG renderer (Remotion composition) → PNG frames → x264 MP4
```
Every frame is a pure function of the frame number, so frames render in any
order, in parallel, and reproduce bit-exactly.

### Authoring a scene
Scenes are data in `src/scenes/*.ts`. A character track looks like:
```ts
{
  id: "pip", spec: PIP, x: -90, facing: 1,
  moves: [{ type: "walk", start: 4, to: 470 },
          { type: "walk", start: 172, to: 640, style: "tiptoe" },
          { type: "jump", start: 304, to: 640, height: 150, turn: true }],
  actions: [{ clip: "think", start: 118, end: 166 },
            { clip: "reach", start: 236, end: 262, params: { target: { point: [772, 1104] } } }],
  expressions: [{ at: 93, expr: "surprised", blend: 3 }],
  look: [{ at: 91, target: { prop: "box" }, blend: 3 }],
}
```
Motion vocabulary: walk / tiptoe / stagger / run, turn, jump & land, step,
sit / standUp, fall / getUp; clips point, reach, explain, talk, think, react,
celebrate, armsUp, panic, duck, push, pull, pickUp, handOver, hold, holdPath,
coverMouth, laugh, blow, hornBlow, shrug, wave, sneak, lookAround, flail and
additive dazedSway, giggle, nod, offset; 19 expressions (each with a body
posture). See `.claude/skills/motion-choreography/SKILL.md`.

## QA tooling
| Tool | What it proves |
|---|---|
| `npm test` | IK accuracy, limb lengths constant, planted feet don't slide, determinism |
| `npm run qa` | every frame: limb error, foot slip, IK miss, pops, head interpenetration, prop jumps, motion per second, event timeline |
| `scripts/contact-sheet.sh` | sequential frame sheets for visual review |
| `scripts/stills.mjs` | full-res stills of chosen frames |
| `scripts/verify-render.mjs` | resolution/fps/frames/duration, full decode, motion energy, frame-MD5 reproducibility |

## Claude Code setup
Project skills in `.claude/skills/` (6 studio skills + 8 official Remotion
skills), subagents in `.claude/agents/`, plugins `context7` and
`commit-commands` enabled in `.claude/settings.json`, and a typecheck hook.
`CLAUDE.md` is the project brief; `STATUS.md` is the single status file.

## Project status
See [STATUS.md](STATUS.md).
