import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { evaluateFraming } from "../src/engine/camera";
import { characterBox, outsideFraction, toScreen } from "../src/engine/framing";
import { keyedTime, type KeyedClipData } from "../src/engine/keyedClips";
import { evaluateScene } from "../src/engine/runtime";
import { resolveSceneAudio } from "../src/engine/audio";
import { validateScene } from "../src/engine/validateScene";
import { SCENE_CATALOG, SCENES } from "../src/scenes";
import { showOff } from "../src/scenes/showOff";
import { factoryExample } from "../src/scenes/factoryExample";
import { createSceneFile } from "../scripts/sceneTemplate";
import { resolveScene } from "../scripts/sceneCommands";

describe("scene factory", () => {
  it("validates every catalog scene", () => {
    for (const { def } of SCENE_CATALOG) expect(validateScene(def), def.id).toEqual({ ok: true, errors: [] });
  });

  it("keeps scene ids and composition ids unique in one catalog", () => {
    expect(new Set(SCENE_CATALOG.map((entry) => entry.def.id)).size).toBe(SCENE_CATALOG.length);
    expect(new Set(SCENE_CATALOG.map((entry) => entry.compositionId)).size).toBe(SCENE_CATALOG.length);
    expect(Object.keys(SCENES).sort()).toEqual(SCENE_CATALOG.map((entry) => entry.def.id).sort());
  });

  it("ships a standalone factory example through the same catalog", () => {
    expect(SCENE_CATALOG.find((entry) => entry.def.id === "factory-example")?.compositionId).toBe("FactoryExample");
  });

  it("scaffolds a syntactically valid scene module without touching the engine", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stickman-scene-"));
    const file = createSceneFile("hello-apple", dir);
    const source = fs.readFileSync(file, "utf8");
    const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
    expect(path.basename(file)).toBe("helloApple.ts");
    expect(result.diagnostics ?? []).toEqual([]);
    expect(() => createSceneFile("hello-apple", dir)).toThrow(/already exists/);
  });

  it("resolves CLI selections by scene id or Remotion composition id", () => {
    expect(resolveScene("show-off").compositionId).toBe("ShowOff");
    expect(resolveScene("FactoryExample").def.id).toBe("factory-example");
    expect(() => resolveScene("missing-scene")).toThrow(/Unknown scene/);
  });

  it("keeps the reusable ball stable before its authored release", () => {
    let previous = evaluateScene(factoryExample, 0).props.ball;
    for (let frame = 1; frame < 50; frame++) {
      const current = evaluateScene(factoryExample, frame).props.ball;
      expect(Math.hypot(current.x - previous.x, current.y - previous.y), `frame ${frame}`).toBeLessThan(75);
      previous = current;
    }
  });

  it("keeps Pip framed until the example's throw has finished", () => {
    for (let frame = 38; frame <= 82; frame++) {
      const scene = evaluateScene(factoryExample, frame);
      const camera = evaluateFraming(factoryExample, frame);
      const head = toScreen(factoryExample, camera, characterBox(scene.characters.pip, "head"));
      expect(outsideFraction(factoryExample, head), `frame ${frame}`).toBeLessThanOrEqual(0.04);
    }
  });

  it("rejects unsafe dimensions, references, timelines and empty shot subjects with paths", () => {
    const invalid = structuredClone(showOff) as unknown as typeof showOff;
    invalid.width = 0;
    invalid.characters[0].actions[0].clip = "missing-clip";
    invalid.props[0].states = [];
    invalid.camera.keys[0].shot!.on = [];
    invalid.audio!.cues[0].sfx = "missing/sound";
    const result = validateScene(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^width:/),
        expect.stringMatching(/^characters\.0\.actions\.0\.clip:/),
        expect.stringMatching(/^props\.0\.states:/),
        expect.stringMatching(/^camera\.keys\.0\.shot\.on:/),
        expect.stringMatching(/^audio\.cues\.0\.sfx:/),
      ]),
    );
  });

  it("rejects cyclic prop targets before runtime recursion", () => {
    const invalid = structuredClone(showOff) as unknown as typeof showOff;
    invalid.props[0].states = [{ from: 0, mode: "ballistic", to: [0, 0], toRef: { prop: "ball" }, dur: 10 }];
    invalid.props[1].states = [{ from: 0, mode: "ballistic", to: [0, 0], toRef: { prop: "apple" }, dur: 10 }];
    expect(validateScene(invalid).errors).toContain("props: cyclic target reference apple -> ball -> apple");
  });
});

describe("external keyed clips", () => {
  it("loops a single-frame clip without producing NaN", () => {
    const data: KeyedClipData = { id: "pose", source: "test", fps: 30, frames: 1, additive: [], channels: { head: [0] } };
    expect(keyedTime(data, 25, 60, { loop: true })).toBe(0);
  });
});

describe("SHOW-OFF payoff framing", () => {
  it("keeps the followed character's head inside frame throughout the fall", () => {
    for (let frame = 545; frame <= 554; frame++) {
      const scene = evaluateScene(showOff, frame);
      const camera = evaluateFraming(showOff, frame);
      const head = toScreen(showOff, camera, characterBox(scene.characters.pip, "head"));
      expect(outsideFraction(showOff, head), `frame ${frame}`).toBeLessThanOrEqual(0.04);
    }
  });

  it("can limit automatic landing sounds to selected characters", () => {
    const filtered = structuredClone(showOff);
    filtered.audio!.landings!.chars = ["bo"];
    const labels = resolveSceneAudio(filtered).map((cue) => cue.label);
    expect(labels).toContain("bo land");
    expect(labels).not.toContain("pip impact");
  });
});
