import { describe, expect, it } from "vitest";
import warmUp from "../src/clips/warmUp.json";
import { BO, PIP } from "../src/characters";
import { anchorPoint } from "../src/engine/anchors";
import { cutFrames, evaluateFraming } from "../src/engine/camera";
import { CLIPS, type ClipCtx } from "../src/engine/clips";
import { characterBox, outsideFraction, toScreen } from "../src/engine/framing";
import type { KeyedClipData } from "../src/engine/keyedClips";
import { dist } from "../src/engine/math";
import { restPose } from "../src/engine/rig";
import { evaluateScene } from "../src/engine/runtime";
import { motionLibrary } from "../src/scenes/motionLibrary";
import { showOff } from "../src/scenes/showOff";

const ctxFor = (spec: typeof PIP, t: number, dur: number, params: Record<string, unknown> = {}): ClipCtx =>
  ({ t, dur, u: t / dur, frame: t, spec, pose: restPose(spec, 500, 1500, 1), loco: {} as ClipCtx["loco"], fwd: 1, params, target: () => ({ x: 0, y: 0 }), targetAt: () => ({ x: 0, y: 0 }), self: () => ({ x: 0, y: 0 }) }) as ClipCtx;

describe("Blender keyed clip (warmUp)", () => {
  const data = warmUp as KeyedClipData;

  it("is a per-frame export with every channel sampled", () => {
    expect(data.source).toBe("blender");
    expect(data.authoredWith).toMatch(/^Blender \d/);
    for (const arr of Object.values(data.channels)) expect(arr.length).toBe(data.frames);
  });

  it("retargets without changes: identical arm angles on Pip and Bo", () => {
    for (const t of [0, 12, 25, 40, 53]) {
      const a = CLIPS.warmUp.fn(ctxFor(PIP, t, 66));
      const b = CLIPS.warmUp.fn(ctxFor(BO, t, 66));
      expect(a.aFsh).toBeCloseTo(b.aFsh!, 9);
      expect(a.aFel).toBeCloseTo(b.aFel!, 9);
      expect(a.aBsh).toBeCloseTo(b.aBsh!, 9);
    }
  });

  it("expresses multi-turn windmill angles within half a turn of the base pose", () => {
    for (let t = 0; t <= 66; t++) {
      const out = CLIPS.warmUp.fn(ctxFor(PIP, t, 66));
      expect(Math.abs(out.aFsh! - restPose(PIP).aFsh)).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  it("blends out of the windmill without rewinding the arm (MotionLibrary, Bo)", () => {
    // regression: unwrapped 4*pi angles used to spin the arm backwards twice in the out-blend
    let prev = evaluateScene(motionLibrary, 938).characters.bo.joints.wristF;
    for (let f = 939; f <= 952; f++) {
      const w = evaluateScene(motionLibrary, f).characters.bo.joints.wristF;
      expect(dist(w, prev)).toBeLessThan(60);
      prev = w;
    }
  });
});

describe("camera shot keys", () => {
  it("frames each shot's characters with their heads inside the frame at the key", () => {
    for (const k of showOff.camera.keys) {
      if (!k.shot || k.shot.track) continue;
      const f = k.shot.solveAt ?? k.at;
      const cam = evaluateFraming(showOff, f);
      if (Math.abs(f - k.at) > 0) continue; // solved for another pose; checked at its own frame elsewhere
      const sf = evaluateScene(showOff, f);
      for (const id of k.shot.on.filter((s) => !s.startsWith("prop:"))) {
        const head = toScreen(showOff, cam, characterBox(sf.characters[id], "head"));
        expect(outsideFraction(showOff, head)).toBeLessThan(0.04);
      }
    }
  });

  it("cuts switch framing in one frame, moves never do", () => {
    const cuts = cutFrames(showOff);
    expect(cuts.length).toBeGreaterThanOrEqual(5);
    for (const c of cuts) {
      const a = evaluateFraming(showOff, c - 1);
      const b = evaluateFraming(showOff, c);
      const before = evaluateFraming(showOff, c - 2);
      // the frame before a cut holds the previous framing
      expect(Math.abs(a.zoom - before.zoom) + Math.hypot(a.x - before.x, a.y - before.y)).toBeLessThan(25);
      expect(Math.abs(Math.log(b.zoom / a.zoom)) + Math.hypot(a.x - b.x, a.y - b.y) / 100).toBeGreaterThan(0.05);
    }
  });
});

describe("SHOW-OFF interactions", () => {
  it("pick-up never pops the ball (grab point is frozen, no IK feedback)", () => {
    let prev = evaluateScene(showOff, 334).props.ball;
    for (let f = 335; f <= 372; f++) {
      const p = evaluateScene(showOff, f).props.ball;
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(75);
      prev = p;
    }
  });

  it("bites happen in profile with the apple at the mouth", () => {
    for (const f of [470, 486]) {
      const sf = evaluateScene(showOff, f);
      const bo = sf.characters.bo;
      expect(bo.pose.faceTurn).toBeGreaterThan(0.9);
      const mouth = anchorPoint(bo.spec, bo.pose, bo.joints, "mouth");
      expect(dist(mouth, sf.props.apple)).toBeLessThan(60);
    }
  });

  it("keeps both characters big and uncut on screen (framing targets)", () => {
    const stats: Record<string, { h: number; n: number; headCut: number }> = { bo: { h: 0, n: 0, headCut: 0 }, pip: { h: 0, n: 0, headCut: 0 } };
    for (let f = 1; f < showOff.durationInFrames; f += 5) {
      const cam = evaluateFraming(showOff, f);
      const prev = evaluateFraming(showOff, f - 1);
      const holding = Math.hypot(cam.x - prev.x, cam.y - prev.y) * cam.zoom < 4 && Math.abs(Math.log(cam.zoom / prev.zoom)) < 0.005;
      const sf = evaluateScene(showOff, f);
      for (const id of ["bo", "pip"]) {
        const body = toScreen(showOff, cam, characterBox(sf.characters[id]));
        if (outsideFraction(showOff, body) >= 0.98) continue;
        stats[id].h += (body.y1 - body.y0) / showOff.height;
        stats[id].n++;
        if (outsideFraction(showOff, toScreen(showOff, cam, characterBox(sf.characters[id], "head"))) > 0.04 && sf.characters[id].loco.moving < 0.3 && holding) stats[id].headCut++;
      }
    }
    for (const s of Object.values(stats)) {
      expect(s.h / s.n).toBeGreaterThan(0.42);
      expect(s.headCut).toBeLessThanOrEqual(3);
    }
  });
});
