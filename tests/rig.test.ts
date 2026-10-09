import { describe, expect, it } from "vitest";
import { BO, PIP } from "../src/characters";
import { bakeLocomotion } from "../src/engine/locomotion";
import { dist, rotate, v } from "../src/engine/math";
import { restPose, solvePose, solveTwoBone } from "../src/engine/rig";
import { evaluateCharacter, getRuntime } from "../src/engine/runtime";
import type { SceneDef } from "../src/engine/scene";

const FLOOR = 1500;

describe("two-bone IK", () => {
  it("reaches reachable targets exactly and keeps bone lengths", () => {
    for (let i = 0; i < 200; i++) {
      const a = v(0, 0);
      const ang = (i / 200) * Math.PI * 2;
      const r = 30 + (i % 7) * 20;
      const t = v(Math.cos(ang) * r, Math.sin(ang) * r);
      const ik = solveTwoBone(a, t, 90, 80, v(1, 0));
      expect(dist(ik.end, t)).toBeLessThan(0.01);
      expect(dist(a, ik.joint)).toBeCloseTo(90, 6);
      expect(dist(ik.joint, ik.end)).toBeCloseTo(80, 6);
    }
  });
  it("bends toward the pole", () => {
    const ik = solveTwoBone(v(0, 0), v(0, 150), 90, 80, v(1, 0));
    expect(ik.joint.x).toBeGreaterThan(0);
  });
});

describe("rig FK", () => {
  it("never changes limb lengths whatever the pose", () => {
    for (const s of [PIP, BO]) {
      for (let i = 0; i < 100; i++) {
        const p = restPose(s, 300, FLOOR, i % 2 ? 1 : -1);
        p.aFsh = Math.sin(i) * 3;
        p.aFel = Math.cos(i * 1.3) * 2;
        p.aBsh = Math.sin(i * 0.7) * 3;
        p.lean = Math.sin(i * 0.3) * 0.6;
        p.fFx = 300 + Math.sin(i) * 60;
        p.fFy = FLOOR - 12 - Math.abs(Math.cos(i)) * 80;
        p.bodyRot = Math.sin(i * 0.2) * 0.5;
        const { joints: j } = solvePose(s, p);
        expect(dist(j.shoulderF, j.elbowF)).toBeCloseTo(s.upperArm, 5);
        expect(dist(j.elbowF, j.wristF)).toBeCloseTo(s.foreArm, 5);
        expect(dist(j.hipF, j.kneeF)).toBeCloseTo(s.thigh, 5);
        expect(dist(j.kneeF, j.ankleF)).toBeCloseTo(s.shin, 5);
        expect(dist(j.hipB, j.kneeB)).toBeCloseTo(s.thigh, 5);
        expect(dist(j.kneeB, j.ankleB)).toBeCloseTo(s.shin, 5);
      }
    }
  });
});

/** World positions of toe and heel for a solved foot. */
const footPoints = (s: typeof PIP, ankle: { x: number; y: number }, rot: number, facing: number) => {
  const sg = facing >= 0 ? 1 : -1;
  const toe = rotate(v(0.7 * s.footLen, s.ankleH), rot);
  const heel = rotate(v(-0.3 * s.footLen, s.ankleH), rot);
  return {
    toe: v(ankle.x + toe.x * sg, ankle.y + toe.y),
    heel: v(ankle.x + heel.x * sg, ankle.y + heel.y),
  };
};

describe("locomotion planner", () => {
  for (const style of ["normal", "tiptoe", "stagger"] as const) {
    it(`walk (${style}) reaches its target and planted feet never slide`, () => {
      const bake = bakeLocomotion(PIP, [{ type: "walk", start: 5, to: 760, style }], {
        x: 100,
        floorY: FLOOR,
        facing: 1,
        totalFrames: 200,
      });
      const last = bake.frames[bake.frames.length - 1];
      expect(last.x).toBeCloseTo(760, 3);
      for (const foot of ["F", "B"] as const) {
        for (let i = 1; i < bake.frames.length; i++) {
          const a = bake.frames[i - 1][foot];
          const b = bake.frames[i][foot];
          if (a.plant < 1 || b.plant < 1) continue;
          const pa = footPoints(PIP, a, a.rot, 1);
          const pb = footPoints(PIP, b, b.rot, 1);
          // One contact point (toe or heel) must stay fixed while planted.
          const slip = Math.min(dist(pa.toe, pb.toe), dist(pa.heel, pb.heel));
          expect(slip).toBeLessThan(0.75);
        }
      }
    });
  }

  it("run has a flight phase", () => {
    const bake = bakeLocomotion(BO, [{ type: "run", start: 0, to: 900 }], { x: 0, floorY: FLOOR, facing: 1, totalFrames: 120 });
    expect(bake.frames.some((f) => f.airborne === 1)).toBe(true);
  });

  it("jump lands where asked and records events", () => {
    const bake = bakeLocomotion(PIP, [{ type: "jump", start: 10, to: 300, height: 120 }], {
      x: 200,
      floorY: FLOOR,
      facing: 1,
      totalFrames: 100,
    });
    expect(bake.frames[99].x).toBeCloseTo(300, 3);
    expect(bake.events.some((e) => e.kind === "land")).toBe(true);
    expect(Math.min(...bake.frames.map((f) => f.y))).toBeLessThan(FLOOR - 100);
  });
});

const mkScene = (): SceneDef => ({
  id: "test",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 140,
  floorY: FLOOR,
  characters: [
    {
      id: "pip",
      spec: PIP,
      x: 100,
      facing: 1,
      moves: [{ type: "walk", start: 4, to: 600 }],
      actions: [{ clip: "point", start: 100, end: 130, params: { target: { point: [900, 1200] } } }],
      expressions: [{ at: 90, expr: "surprised" }],
      look: [{ at: 0, target: "ahead" }, { at: 95, target: { char: "bo", part: "head" } }],
    },
    {
      id: "bo",
      spec: BO,
      x: 850,
      facing: -1,
      moves: [],
      actions: [{ clip: "celebrate", start: 20, end: 120 }],
      expressions: [{ at: 0, expr: "happy" }],
      look: [{ at: 0, target: { char: "pip", part: "head" } }],
    },
  ],
  props: [],
  camera: { keys: [], shakes: [] },
  fx: [],
  set: {},
});

describe("scene evaluation", () => {
  it("is deterministic across independent runtimes", () => {
    const a = mkScene();
    const b = mkScene();
    for (const f of [0, 33, 77, 120, 139]) {
      const ra = evaluateCharacter(getRuntime(a), "pip", f).pose;
      const rb = evaluateCharacter(getRuntime(b), "pip", f).pose;
      expect(JSON.stringify(ra)).toEqual(JSON.stringify(rb));
    }
  });

  it("planted feet are actually reached by the leg IK (pelvis drops instead of stretching)", () => {
    const sc = mkScene();
    const rt = getRuntime(sc);
    for (let f = 0; f < 140; f++) {
      const { pose, joints } = evaluateCharacter(rt, "pip", f);
      if (pose.plantF >= 1) expect(dist(joints.ankleF, v(pose.fFx, pose.fFy))).toBeLessThan(0.5);
      if (pose.plantB >= 1) expect(dist(joints.ankleB, v(pose.fBx, pose.fBy))).toBeLessThan(0.5);
    }
  });

  it("produces no NaNs", () => {
    const sc = mkScene();
    const rt = getRuntime(sc);
    for (let f = 0; f < 140; f += 3) {
      for (const id of ["pip", "bo"]) {
        const { pose } = evaluateCharacter(rt, id, f);
        for (const [k, val] of Object.entries(pose)) expect(Number.isFinite(val), `${id}.${k}@${f}`).toBe(true);
      }
    }
  });
});
