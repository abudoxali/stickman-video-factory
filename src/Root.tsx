import React from "react";
import { Composition } from "remotion";
import { makeSceneComponent } from "./compositions/SceneComposition";
import { RigLab } from "./compositions/RigLab";
import { GODOT_BRIDGE_FRAMES, GodotBridge } from "./compositions/GodotBridge";
import { PixiBench } from "./bench/PixiBench";
import { MotionLibrary } from "./compositions/MotionLibrary";
import { theSurprise } from "./scenes/theSurprise";
import { SCENE_CATALOG } from "./scenes";

const SCENE_COMPONENTS = Object.fromEntries(
  SCENE_CATALOG.map((entry) => [entry.compositionId, entry.presentation === "motion-library" ? MotionLibrary : makeSceneComponent(entry.def)]),
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {SCENE_CATALOG.map(({ compositionId, def }) => (
        <Composition
          key={compositionId}
          id={compositionId}
          component={SCENE_COMPONENTS[compositionId]}
          durationInFrames={def.durationInFrames}
          fps={def.fps}
          width={def.width}
          height={def.height}
        />
      ))}
      <Composition id="PixiBench" component={PixiBench} durationInFrames={theSurprise.durationInFrames} fps={30} width={1080} height={1920} />
      <Composition id="GodotBridge" component={GodotBridge} durationInFrames={GODOT_BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
      <Composition id="RigLab" component={RigLab} durationInFrames={120} fps={30} width={1080} height={1920} />
    </>
  );
};
