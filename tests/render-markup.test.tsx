import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneView } from "../src/render/SceneView";
import { SCENES } from "../src/scenes";

// Renderer-level guard: every scene renders to SVG markup with no NaN
// coordinates/opacities (React logs those in Chromium and the element is
// silently dropped). Checks every 3rd frame plus the first and last frame.
describe("SVG renderer", () => {
  for (const def of Object.values(SCENES)) {
    it(`${def.id}: no NaN in rendered markup`, () => {
      const frames = new Set([0, def.durationInFrames - 1]);
      for (let f = 0; f < def.durationInFrames; f += 3) frames.add(f);
      const bad = [...frames].filter((f) => renderToStaticMarkup(<SceneView def={def} frame={f} />).includes("NaN"));
      expect(bad).toEqual([]);
    });
  }
});
