# Stickman Video Factory

A code-driven 2D cartoon animation studio: expressive stickman-inspired
characters driven by a hierarchical rig, reusable motion clips and a
choreography system, composed and rendered deterministically with
[Remotion](https://www.remotion.dev).

Productions (vertical 1080×1920, 30 fps, told entirely through animation):

- **SHOW-OFF** (20 s, with sound) — Bo cannot reach a prized apple, Pip turns
  the rescue into a performance, and an off-screen ricochet supplies the
  punchline. Uses the Blender-authored reusable `warmUp` clip.
- **BONK!** (19 s, with sound) — a game of catch in the park goes wrong. Pip
  winds up a huge throw, the ball sails over Bo, smacks the tree and ricochets
  onto Bo's head; Bo topples, Pip doubles up laughing — until Bo picks up the
  ball and lobs it right off Pip's head. Both crack up.
- **THE SURPRISE** (24 s) — a birthday gift, a door burst, a box on a head.

## Quick start (Windows, macOS, Linux)
```bash
npm install
npm run dev              # Remotion Studio (live preview with sound): Bonk, TheSurprise, ...
npm test                 # rig / IK / locomotion / audio / asset-licence / markup tests
npm run scene:list       # catalogued compositions and SceneDef ids
npm run scene:validate   # schema + reference + timeline validation for every scene
npm run qa:all           # engine-level motion QA for every catalogued scene
npm run scene:preview -- show-off out/qa/show-off-low.mp4
npm run scene:render -- show-off out/show-off-final.mp4
npm run scene:verify -- show-off out/show-off-final.mp4
npm run render:preview   # quarter-res MP4 with sound in ~30 s -> out/qa/bonk-low.mp4
npm run render           # deterministic full-res MP4 with sound -> out/bonk.mp4
npm run verify           # ffprobe + decode + motion energy + audio-sync checks
```
Requires Node 20+ and FFmpeg/ffprobe on PATH. Rendering uses Remotion's
bundled headless Chromium. Optional local engines: Godot 4.5+ (`npm run
godot:render`, `npm run godot:editor`) and Blender 5.x (`npm run blender:render`).

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
Scenes are declarative data in `src/scenes/*.ts`; `src/scenes/index.ts` is the
single catalog used by Studio, validation, QA and rendering. Scaffold a new
vertical production without touching the engine:

```bash
npm run scene:new -- my-story
# edit src/scenes/myStory.ts, then add one catalog entry in src/scenes/index.ts
npm run scene:validate
npm run scene:preview -- my-story out/qa/my-story-low.mp4
npm run scene:render -- my-story out/my-story.mp4
npm run scene:verify -- my-story out/my-story.mp4
```

The validator rejects invalid dimensions/timelines, duplicate ids, unknown
clips/expressions/sounds/references, cyclic prop references and empty camera
shots. `FactoryExample` is a complete independent scene made only from the
existing characters, park, clips, ball physics, camera, FX and audio. A
character track looks like:
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
Motion vocabulary: walk / tiptoe / stagger / run, turn (through a front view),
jump & land, step, sit / standUp, fall / getUp; clips throw, catch, rubHead, point, reach, explain, talk, think, react,
celebrate, armsUp, panic, duck, push, pull, pickUp, handOver, hold, holdPath,
coverMouth, laugh, blow, hornBlow, shrug, wave, sneak, lookAround, flail and
additive dazedSway, giggle, nod, offset; 19 expressions (each with a body
posture). See `.claude/skills/motion-choreography/SKILL.md`.

## QA tooling
| Tool | What it proves |
|---|---|
| `npm test` | IK accuracy, limb lengths constant, planted feet don't slide, determinism |
| `npm run qa` | every frame: limb error, foot slip, IK miss, pops, head interpenetration, prop jumps, motion per second, event timeline |
| `scripts/contact-sheet.mjs` | sequential frame sheets for visual review |
| `scripts/stills.mjs` | full-res stills of chosen frames |
| `scripts/verify-render.mjs` | resolution/fps/frames/duration, full decode, motion energy, frame-MD5 reproducibility |

## Assets and other engines
- `public/assets/`: Kenney Impact Sounds + Interface Sounds (CC0), each with
  `asset.json` (source, author, license, date) and its license file; addressed
  as `"impact/impactPunch_heavy"` etc. via `src/assets/manifest.json`.
- `godot/cutout-lab`: Kenney Modular Characters (CC0) rigged on Skeleton2D
  bones with AnimationTree blending; Movie Maker renders transparent PNG
  sequences that Remotion composites (`GodotBridge` composition). Includes the
  godot-mcp editor add-on (localhost) — see `.mcp.json`.
- `blender/gp_rig_lab.py`: Grease Pencil v3 stickman deformed by an armature,
  rendered headless to transparent PNGs.
- `blender/clips/warm_up.py` + `scripts/blender-clips.mjs`: editable Blender
  action → reusable JSON motion clip. Run `npm run blender:clip:export` after
  editing `out/blender/clip_lab.blend`, or `npm run blender:clip:rebuild` to
  rebuild the authored action and export it.

## Claude Code setup
Project skills in `.claude/skills/` (6 studio skills + 8 official Remotion
skills), subagents in `.claude/agents/`, plugins `context7` and
`commit-commands` enabled in `.claude/settings.json`, a cross-platform
typecheck hook (Node), and the `godot` MCP server in `.mcp.json`.
`CLAUDE.md` is the project brief; `STATUS.md` is the single status file.

## Project status
See [STATUS.md](STATUS.md).
