# STATUS — Stickman Video Factory

_Last updated: 2026-10-09 (local Windows session, branch `claude/local-studio-bonk`, based on `claude/nice-babbage-j91qfr` @ be46f13)._

## Current milestone
**Milestone 2 — local production studio + second demo: ~85 % complete.**
Delivered: local environment, cross-platform pipeline, asset library with
licence registry, sound system, engine quality upgrades, new park set, new
demo **BONK!** (19 s, with sound, byte-reproducible), Godot cutout-rig
integration + working godot-mcp, Blender Grease Pencil rig lab, cross-engine
benchmark. Missing for 100 %: Blender MCP not yet usable from this app
(configuration, see Unresolved), Context7 still needs an API key, no music/
voice/lip-sync, Kenney *character* art not adopted in the main demo (style
mismatch — by decision, see TOOLING_AUDIT).
Milestone 1 (THE SURPRISE, first demo) remains complete.

## Deliverables (all verified this session)
| Output | How to reproduce | Verified |
|---|---|---|
| `out/bonk.mp4` — **BONK!** 1080×1920, 30 fps, 570 f (19.00 s), H.264 + AAC 48 kHz, 13.8 MB | `npm run render` (~2 min) | decode ok, 0 frozen frames, audio peak −0.6 dB, 14/15 authored cue onsets detected, **two renders (concurrency 4 vs 2) byte-identical**: MD5 `df4e86b64fb6e4fd5bbdcdef9e014cf5` |
| `out/the-surprise.mp4` — re-rendered with the new engine (turns, smears, arm blending) | `npm run render:surprise` | 1080×1920, 30 fps, 720 f, 24.00 s, decode ok, 0 frozen. New MD5 `341e0719592ba9c52accb1f09ee2e29f` (old MD5 in history no longer applies — engine output changed intentionally) |
| `out/godot-bridge.mp4` — Godot-rigged Kenney characters composited over the SVG park | `npm run godot:render && npm run render:godot-bridge` | 1080×1920, 120 f |
| `out/qa/bonk-low.mp4` — quarter-res preview with sound | `npm run render:preview` (33 s) | 270×480, 570 f, AAC |
| Live preview | `npm run dev` → http://localhost:3000/Bonk | Studio loaded in the app browser: 6 compositions listed, Bonk renders, 0 console errors |

`out/` and `public/renders/` are git-ignored build outputs.

### BONK! — beat sheet (`src/scenes/bonk.ts`)
1 Hello (0–80): park wide; Bo waits with a ball, Pip strolls in and waves.
2 Catch (76–145): Bo's underhand toss (wind-up, release f96) → Pip's catch
absorbs the hit (f116). 3 Too hard (146–222): Pip's huge overhand wind-up
(camera push-in on the anticipation), release f180 over Bo's head; Bo spins to
watch; the ball smacks the tree (f212, leaves, canopy rattle) and ricochets
onto Bo's head (f220, stars). 4 Down (222–340): Bo wobbles and topples toward
Pip, who hops back and doubles up laughing, pointing; the ball bounces to the
tree. 5 Payback (340–505): Bo gets up glaring and rubbing the bump, spots the
ball, steps in, picks it up, turns and lobs it — boing off the laughing Pip's
head (f486); Pip fumbles a catch (f504). 6 Even (505–570): both crack up.
Two characters, 30 moves/actions (11 distinct clips), 15 authored SFX cues + auto footsteps/
landings, 19 camera keys, 4 shakes, 5 FX, 11 ball states (5 ballistic arcs, 4
toRef-targeted).

## Local environment (detected; non-sensitive)
| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200, x64 |
| CPU | Intel Core i7-12700K, 12 cores / 20 threads |
| GPU | NVIDIA GeForce RTX 4070, 12 GB VRAM, driver 610.74 (nvidia-smi OK) — not modified |
| RAM / disk | 31.7 GB / C: 103 GB free |
| Node / npm / pnpm | 24.11.0 / 11.6.1 / present |
| Git / GitHub CLI | 2.51.2 / gh 2.94.0 (authenticated, push rights verified) |
| FFmpeg / ffprobe | 9.0.1 full build (winget) — drawtext works, no glob patterns on Windows |
| Python | **not installed** (only the Microsoft Store alias). Not needed: Blender bundles Python; the old hook that required python3 was replaced |
| Chromium | Remotion headless shell (bundled); app browser pane for Studio checks |
| Claude Code | 2.1.263 (desktop app, local) |
| Godot | 4.6.2 stable (winget, pre-installed; 4.7.2 available, not upgraded) |
| Blender | **5.2.2 LTS — installed this session** (official MSI via winget; UAC approved by the user) |
| Repo state | folder was a plain copy (no `.git`) identical to remote HEAD be46f13; attached to origin without touching files — no local changes existed |

## Verified functionality
**Tests** `npm test`: **22/22 pass** — rig/IK/locomotion/determinism (11),
production (8: hand-space blend endpoints + monotonic reach, turn width floor,
ballistic `toRef` lands within 0.5 px of the moving anchor, hand-offs never pop
> 45 px, smears appear on whips and never at idle, every SFX cue resolves to a
file on disk, footsteps == locomotion contacts, every asset pack has source +
licence file), render-markup (3: every 3rd frame of every scene renders to SVG
with no NaN).

**Engine motion QA** (`npm run qa:all`, every frame):
| Scene | limb error | planted slip | IK miss | floor pen. | static s | pops (>60 px/f) |
|---|---|---|---|---|---|---|
| bonk (570 f) | ≤ 7e-14 px | **0.00 px** | 0.00 px | 0 | 0 | Bo 21 / Pip 14 — all at throw whips & bonk reaction (smeared) |
| the-surprise (720 f) | ≤ 9e-14 px | 0.00 px | 0.00 px | 2 samples | 0 | Pip 26 (was 28) / Bo 57 |
| motion-library (870 f) | ≤ 7e-14 px | 0.16 px | 0.00 px | 2 samples | 0 | 23 / 20 |

**Visual review performed** (sequential frames — not real-time playback):
key-frame stills (24 frames, 40 %), quarter-res contact sheets every 4th frame
of the whole film and every 3rd frame of f240–537, full-res frames extracted
from the final MP4. Defects found and fixed through this loop:
1. Ball pinned between Pip's hands during his one-arm wind-up → re-attach to the throwing hand at f150.
2. Pip cut off at frame edge (f256–282, f556–569) → reframed.
3. Rebounding ball passed in front of Bo's body; Bo's fall would land on the ball → new trajectory (ball returns to the tree side).
4. Bo's head went into the tree trunk during the pick-up → tree moved left, Bo steps in.
5. rubHead arm crossed the face (×2): root cause was Bo facing away while looking over his shoulder → Bo turns to face Pip; far hand rubs the back of the head; renderer keeps a far hand *behind* the head when it is behind the head centre.
6. Guessed contact points were 200 px off → engine feature `toRef`/`contact` (ballistic lands on the moving anchor).
7. React console error on the last frame (NaN smear: trajectory read past the end) → fixed + permanent markup test.

## Engine / animation improvements this session
| Problem (from STATUS "known limitations") | Change | Evidence |
|---|---|---|
| Hands arc wide between distant poses (angle-space blend) | Override layers blend arms in **hand space** (shoulder-centred polar: direction + reach; elbow re-solved; bend side kept). Per-clip opt-out `armBlend: "angle"` | A/B `npm run bench`: wrist detour ratio 1.572→1.555 (surprise), 1.380→1.373 (reel), 1.228→1.214 (bonk); eval 0.30→0.21 ms/frame. **Honest: small gain** — most blend windows overlap other moving layers |
| No limb smears (120–180 px/frame wrist jumps) | **Smear frames**: wrists > 42 px/f draw the swept forearm area + tapered hand trail + speed lines from the cached trajectory (`limbSmears`) | visible on every throw/flail; test asserts on/off |
| Flat edge-on turns (body to 12 % width) | **Front-view turns**: body ≥ 34 % width, head counter-scaled round, face swings to camera mid-turn | visible f183–191, f432–440 |
| Missing sound | **Sound system**: authored cues + automatic footsteps (locomotion contact events; tiptoe quieter, runs louder) and landing thuds; Remotion `<Audio>` per cue → identical in Studio and final mix | verifier: 14/15 onsets; byte-reproducible AAC |
| Prop contacts needed manual probing | **Ballistic `toRef` + `contact`**: arcs land on a character anchor/prop as it is at the landing frame | test: < 0.5 px error |
| — | **New clips**: `throw` (wind-up/tension tremble/accelerating whip/follow-through, counter-swing), `catch` (ready, widen, absorb recoil, spring settle), `rubHead` | BONK! |
| — | **Park set** (reusable): sky, rotating sun, drifting clouds, birds, butterfly, hills, fence, flowers, swaying grass, tree with `treeShake` rattle; FX `stars` and `leaves`; FX `follow` now works (was declared, never wired) | BONK! |

## Pipeline (selected architecture)
```
Claude Code → SceneDef (src/scenes/*.ts, JSON-compatible data)
   → TS rig/motion engine (src/engine: locomotion bake, layered clips, hand-space blends,
     IK, springs, smears, toRef ballistics, camera, audio cue resolution)
   → SVG renderer (src/render) + <Audio> cues + optional external layers (FrameSequence:
     Godot / Blender transparent PNG sequences)
   → Remotion (Studio preview | PNG frames + WAV) → FFmpeg (x264 -threads 1, AAC, bitexact) → MP4
   → verify-render (metadata, decode, motion energy, audio sync, frame-MD5 repro)
```
Remotion + own engine stay the production path. Godot and Blender contribute
layers through `FrameSequence` (proved by `GodotBridge`); neither replaces the
engine (see benchmark).

## Assets and licensing (`public/assets/*/asset.json` + licence files; registry `src/assets/manifest.json`)
| Pack | Source | Licence (verified from the archive's own licence file) | In repo | Used |
|---|---|---|---|---|
| Kenney Impact Sounds 1.0 | kenney.nl/assets/impact-sounds | CC0 1.0 | `public/assets/kenney-impact-sounds` (130 OGG) | BONK! footsteps, catches, bonk, tree, bounces |
| Kenney Interface Sounds 1.0 | kenney.nl/assets/interface-sounds | CC0 1.0 | `public/assets/kenney-interface-sounds` (100 OGG) | pluck (throws), bong (bonk ring/boing), click |
| Kenney Modular Characters | kenney.nl/assets/modular-characters | CC0 1.0 | subset in `godot/cutout-lab/assets/kenney-modular-characters` (129 PNG) | Godot Skeleton2D cutout rig (2 outfits) |
| Kenney Toon Characters 1 | kenney.nl/assets/toon-characters | CC0 1.0 | **not copied** (evaluated only) | pose sprites + small parts (≤106 px); raster, would need 5–10× upscaling at 1080×1920 |
| OpenGameArt | opengameart.org | per-asset licences differ (CC0/CC-BY/GPL…) | nothing taken | no asset needed that Kenney CC0 did not cover; per-asset licence checks would be required |

## Claude Code capabilities (verified)
- **Skills discoverable in this local session** (listed in the session's skill
  registry): animation-director, animation-qa, cartoon-scene-production,
  character-rigging, motion-choreography, video-rendering + 8 official Remotion
  skills (best-practices, captions, create, docs, markup, multimedia, render,
  studio). Skills updated this session with the new features (toRef, audio,
  park, throw/catch, hand-space blending, smears, cross-platform scripts).
- **Subagents** discoverable: animation-director, rigging-engineer,
  motion-designer, render-engineer, visual-qa-reviewer.
- **Hook** fixed: the bash hook needed `python3` (absent on Windows) and so
  silently never ran here. Replaced by `.claude/hooks/typecheck-on-edit.mjs`
  (Node). Tested: exit 2 + errors on a type error, exit 0 clean / non-TS.
- **MCP servers**
  | Server | State | Evidence |
  |---|---|---|
  | **godot-mcp** 4.1.11 (`.mcp.json`, project scope, via `scripts/godot-mcp-server.mjs`) | ✅ **functional** with the editor open | source reviewed (binds 127.0.0.1; fixed-string PowerShell for WSL IP only; docs fetch only docs.godotengine.org); 21 tools listed; through MCP: opened `kid_red.tscn`, read the bone tree and 6-clip library, read `wave` tracks/keys, **added a keyframe (read back 6 keys), removed it (5 keys), updated a bone property** (`node scripts/godot-mcp-smoke.mjs`). `claude mcp list` shows it "pending approval" until you approve it in an interactive `claude` session |
  | **Blender MCP** (official Blender Lab extension 1.0.1, user-level desktop extension) | ⚠️ installed, **not usable yet** | CLI tools: "Blender executable not found at 'blender'" — server started before Blender was installed and Blender is not on PATH. Live tools: no add-on listening on :9876 |
  | Context7 (plugin) | ⚠️ needs `CONTEXT7_API_KEY` (unchanged) | not active in this session |
  | MCP_DOCKER (user config) | ✘ fails to connect (Docker gateway not running) | not part of this project |
- **GitHub**: gh authenticated; branch pushed; draft PR (see git section).

## TOOLING_AUDIT
| Technology | Purpose | Licence | Version | Integration | Evidence | Decision |
|---|---|---|---|---|---|---|
| Remotion | composition, Studio, rendering, audio mix | Remotion License (free for individuals/small companies) | 4.0.534 | ✅ | all renders; Studio in app browser | **Accepted (production)** |
| Own TS engine (`src/engine`) | rig, IK, locomotion, clips, blends, smears, ballistics, audio cues | project | — | ✅ | QA tables above | **Accepted (production)** |
| Remotion Agent Skills | agent guidance | unverified (no root LICENSE) | 4.0.534 | ✅ 8 skills | discoverable | **Accepted** |
| **Godot** | 2D cutout rigs (Skeleton2D/Bone2D), AnimationPlayer, AnimationTree blending, Movie Maker export | MIT | 4.6.2 | ✅ `godot/cutout-lab` (scenes generated by `tools/build.gd`) | rig from Kenney parts: idle/walk/wave/cheer/surprised + RESET, Blend2+OneShot+Transition tree, facial texture swaps; transparent RGBA frames; **frames byte-identical across runs**; fastest renderer (24 ms/f, +162 MB) | **Accepted as contributing engine** (layers via FrameSequence). Not production: rigid single-piece Kenney limbs → no elbow/knee bends and no foot lock (feet slide in the walk), raster art without our ink outline |
| **godot-mcp** (satelliteoflove) | agent edits scenes/animations in the editor | MIT | 4.1.11 | ✅ | see MCP table | **Accepted (local only)** |
| **Blender** | Grease Pencil v3 strokes deformed by an armature, pose keyframes, transparent PNG | GPL-3.0+ | 5.2.2 LTS | ✅ CLI (`blender/gp_rig_lab.py`) | GP stickman with real elbow/knee bends (vertex groups + GP Armature modifier), crouch→jump→land squash→wave with forearm overlap; 120 f in 17–21 s (146–173 ms/f EEVEE 540×960); **pixel-identical across runs** (PNG metadata differs) | **Accepted for asset/FX authoring only**; slowest path, axis/sign conventions make scripted posing laborious; no advantage over the TS rig for our style |
| Blender MCP (Blender Lab) | agent access to Blender | GPL-3.0+ | 1.0.1 | ⚠️ | not connected (see MCP) | Re-test after configuration |
| PixiJS | WebGL renderer candidate | MIT | 8.22.0 | ✅ benchmark | **re-measured with a real GPU**: `--gl=angle` 44 ms/f vs SVG 50 ms/f (same 120 f @540×960), SwiftShader 82 ms/f — but PixiBench draws simplified silhouettes | **Still rejected for production**: parity speed only with less detail; SVG remains |
| Kenney asset packs | sounds, character parts | CC0 | see Assets | ✅ | licence files in archives | **Accepted** |
| FFmpeg | encode/mux/inspect | LGPL/GPL | 9.0.1 | ✅ | byte-reproducible MP4 with AAC | **Accepted** |
| Context7 | version-specific docs | MIT | remote | ⚠️ needs API key | unchanged | Accepted, needs key |
| Motion Canvas, Bones, Matter.js, Rough.js, Graft, Repomix, Lottie/Rive | — | — | — | — | evaluated in milestone 1 (see git history of this file) | Rejected / not needed (unchanged: no new evidence) |

## Performance (measured on this machine)
Cross-engine, identical workload: 120 frames, 540×960, two animated characters
(`node scripts/bench-engines.mjs`, end-to-end incl. startup/bundling; peak RSS
delta of the engine's processes, GPU sampled with nvidia-smi incl. desktop baseline):
| Renderer | time | ms/frame | peak memory | GPU peak/mean |
|---|---|---|---|---|
| Remotion SVG (BONK!, full detail) | 6.0 s | 50 | +2145 MB | 32 % / 25 % |
| Remotion PixiJS, SwiftShader GL | 9.8 s | 82 | +2868 MB | 43 % / 28 % |
| Remotion PixiJS, GPU (ANGLE) | 5.3 s | 44 | +2245 MB | 29 % / 15 % |
| Godot Movie Maker (GL compat.) | 2.8 s | 24 | +162 MB | 14 % / 12 % |
| Blender GP + EEVEE | 20.7 s | 173 | +584 MB | 53 % / 34 % |

Production renders: BONK! 1080×1920 570 f — frames 56 s, audio 7 s, x264
single-thread encode 38–62 s (≈2 min total); quarter-res preview with audio
33 s; THE SURPRISE 720 f — frames 39 s, encode 87 s. Engine evaluation
0.15–0.21 ms/frame per scene. Godot import+build+render of the lab: ~5.5 s.

Motion-quality comparison (same review method): our engine — 0 px planted
slip, two-bone limbs, IK reach, springs, smears, expressions with posture;
Godot Kenney rig — rigid limbs (no bends), feet slide during the walk, face via
texture swaps; Blender GP rig — real bends, but every pose hand-keyed in
Python with no IK/foot lock.

## Hybrid cloud + local workflow
- GitHub is the source of truth; everything portable is in the repo (`.claude/`
  skills/agents/hook/settings, `.mcp.json`, scripts, Godot project, Blender
  script, assets with licences). No absolute machine paths in sources (the
  Blender launcher only *tries* standard install paths; `BLENDER_BIN` /
  `GODOT_BIN` override).
- All npm scripts are Node-based and work in Windows shells (no bash/python
  dependency); verified locally on Windows, the same commands ran in the Linux
  cloud container in milestone 1.
- Cloud sessions: coding, tests, QA, Remotion renders. Local sessions: Godot/
  Blender, GPU benchmarks, godot-mcp. Cloud cannot reach local apps (by design);
  the godot MCP server there simply reports "Not connected".
- No services are exposed publicly: Studio on localhost:3000, godot-mcp on
  127.0.0.1:6550, Blender MCP add-on (when used) localhost:9876.

## Unresolved issues / limitations
- **Blender MCP**: to make it usable — (1) add `C:\Program Files\Blender Foundation\Blender 5.2` to the user PATH *or* set `BLENDER_PATH` to `blender.exe`, then restart the Claude desktop app (CLI tools); (2) for live tools install the "MCP" add-on from the Blender Lab extensions repository (https://lab.blender.org/) in Blender → enable → start its server. Not done automatically (changes user environment / needs UI).
- Context7 needs a `CONTEXT7_API_KEY`.
- godot-mcp requires a one-time approval of the project MCP server in an interactive `claude` session.
- BONK!: one quiet bounce cue (f265, vol 0.2) is masked by louder sound (14/15 onsets); fast whips still register as >60 px/frame "pops" (intentional, smeared); no music bed, no voices/lip-sync.
- Arm hand-space blending gives only a ~1 % path improvement in real scenes.
- Characters remain 3/4-profile rigs (front view only mid-turn); mitten hands.
- The Godot lab uses `AnimationTree` with global z-order between characters (tree order within each); fine for non-overlapping characters.
- Kenney character art is not in the main demo (style mismatch + raster scale), by decision.

## Next exact task
Make the Blender MCP usable and use it once: set `BLENDER_PATH`, restart the
desktop app, install/enable the Blender Lab MCP add-on, then via MCP open
`out/blender/gp_rig_lab.blend`, list objects, and key one pose change; record
the result here. After that: add a music bed + per-character vocal "grunt" SFX
to BONK! (CC0 packs) and extend `verify-render --scene` to check loudness (LUFS).

## QA history (milestone 1, still valid)
1. No characters rendered (dangling `else` in draw order). 2. Think-pose elbow
over head → pole vector. 3. IK unwrap swung arms through the back → shoulder
range normalisation. 4. Head overlapping the gift → restaged + `maxLean`.
5. Arm across face during lid lift → upright posture. 6. Pick-up/laugh head
collisions → restaged. 7. Look-at before clips → authored "up". 8. Tiptoe
posture pops → smoothed style weights. 9. 270 px elbow flip in hold→holdPath →
shared poles. 10. Run flight lean pop → grounded weighting. 11. Bo off-frame in
the reel → camera pan. 12. Non-reproducible MP4s → multi-threaded x264 → pinned
single-thread encode (kept in `render-final.mjs`).
