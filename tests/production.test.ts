import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../src/assets/manifest.json";
import { PIP } from "../src/characters";
import { anchorPoint } from "../src/engine/anchors";
import { resolveSceneAudio, sfxFiles } from "../src/engine/audio";
import { dist } from "../src/engine/math";
import { armToPolar, blendArmPolar, facingScale, TURN_MIN_SCALE } from "../src/engine/rig";
import { evaluateScene, getRuntime, limbSmears } from "../src/engine/runtime";
import { SCENES } from "../src/scenes";
import { bonk } from "../src/scenes/bonk";

describe("hand-space arm blending", () => {
  it("hits both endpoints exactly and keeps the reach between them", () => {
    const a = { sh: 0.1, el: 0.3 };
    const b = { sh: 2.6, el: 1.9 };
    expect(blendArmPolar(PIP, a, b, 0)).toEqual(a);
    expect(blendArmPolar(PIP, a, b, 1)).toEqual(b);
    const ra = armToPolar(PIP.upperArm, PIP.foreArm, a.sh, a.el).reach;
    const rb = armToPolar(PIP.upperArm, PIP.foreArm, b.sh, b.el).reach;
    let prev = ra;
    for (let i = 1; i < 20; i++) {
      const m = blendArmPolar(PIP, a, b, i / 20);
      const r = armToPolar(PIP.upperArm, PIP.foreArm, m.sh, m.el).reach;
      // reach changes monotonically (no unfold-refold detour)
      expect(r).toBeLessThanOrEqual(prev + 1e-9);
      expect(r).toBeGreaterThanOrEqual(Math.min(ra, rb) - 1e-9);
      prev = r;
    }
  });
});

describe("turns", () => {
  it("never collapse the body narrower than the front-view minimum", () => {
    for (const f of [-1, -0.5, -0.01, 0, 0.01, 0.3, 1]) expect(Math.abs(facingScale(f))).toBeGreaterThanOrEqual(TURN_MIN_SCALE);
  });
});

describe("BONK! scene", () => {
  const rt = getRuntime(bonk);
  const ball = bonk.props.find((p) => p.id === "ball")!;

  it("ballistic toRef lands the ball exactly on the moving target", () => {
    for (const st of ball.states) {
      if (st.mode !== "ballistic" || !st.toRef || !("char" in st.toRef)) continue;
      const land = st.from + st.dur;
      const sf = evaluateScene(bonk, land);
      const c = sf.characters[st.toRef.char];
      const a = anchorPoint(c.spec, c.pose, c.joints, st.toRef.part);
      const off = st.toRef.offset ?? [0, 0];
      const d = dist(sf.props.ball, { x: a.x + off[0], y: a.y + off[1] });
      expect(Math.abs(d - (st.contact ?? 0))).toBeLessThan(0.5);
    }
  });

  it("hand-offs never pop the ball (catch, pick-up)", () => {
    for (const st of ball.states) {
      if (st.mode !== "attach" || st.from === 0) continue;
      const a = evaluateScene(bonk, st.from - 1).props.ball;
      const b = evaluateScene(bonk, st.from).props.ball;
      expect(dist(a, b)).toBeLessThan(45);
    }
  });

  it("smears appear on the fast throw whip and never when arms are slow", () => {
    const whip = evaluateScene(bonk, 96).characters.bo;
    expect(limbSmears(rt, "bo", 96, whip.joints).F).toBeDefined();
    const idle = evaluateScene(bonk, 30).characters.bo;
    expect(limbSmears(rt, "bo", 30, idle.joints)).toEqual({});
  });
});

describe("sound", () => {
  it("every scene cue resolves to an existing, licensed asset", () => {
    for (const def of Object.values(SCENES)) {
      for (const c of resolveSceneAudio(def)) {
        expect(fs.existsSync(path.join("public", c.file))).toBe(true);
        expect(c.at).toBeGreaterThanOrEqual(0);
        expect(c.at).toBeLessThan(def.durationInFrames);
      }
    }
  });

  it("auto footsteps follow locomotion contacts and skip tiptoe loudness", () => {
    const cues = resolveSceneAudio(bonk);
    const steps = cues.filter((c) => c.source === "footstep");
    expect(steps.length).toBeGreaterThan(8);
    const contacts = getRuntime(bonk).bakes.get("pip")!.events.filter((e) => e.kind === "contact");
    for (const e of contacts) expect(steps.some((s) => s.at === e.frame)).toBe(true);
    expect(cues.some((c) => c.source === "landing")).toBe(true);
  });

  it("asset registry: every pack declares source + license and ships its license file", () => {
    for (const p of Object.values(manifest.packs)) {
      expect(p.license).toMatch(/CC0|CC-BY|MIT|OFL/);
      expect(p.source).toMatch(/^https:\/\//);
      expect(fs.existsSync(path.join("public", p.dir, p.licenseFile))).toBe(true);
    }
    expect(() => sfxFiles("impact/nope")).toThrow();
  });
});
