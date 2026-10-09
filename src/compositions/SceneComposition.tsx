import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneDef } from "../engine/scene";
import { SceneAudio } from "../render/SceneAudio";
import { SceneView } from "../render/SceneView";

/** Renders any SceneDef. The scene is passed as a module-level object so caches stay warm. */
export const makeSceneComponent = (def: SceneDef, debug = false): React.FC => {
  const C: React.FC = () => {
    const frame = useCurrentFrame();
    return (
      <AbsoluteFill style={{ backgroundColor: "#2a2238" }}>
        <SceneView def={def} frame={frame} debug={debug} />
        {def.audio && <SceneAudio def={def} />}
      </AbsoluteFill>
    );
  };
  C.displayName = `Scene(${def.id})`;
  return C;
};
