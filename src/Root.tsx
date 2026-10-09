import React from "react";
import { Composition } from "remotion";
import { makeSceneComponent } from "./compositions/SceneComposition";
import { RigLab } from "./compositions/RigLab";
import { GODOT_BRIDGE_FRAMES, GodotBridge } from "./compositions/GodotBridge";
import { PixiBench } from "./bench/PixiBench";
import { MotionLibrary } from "./compositions/MotionLibrary";
import { motionLibrary } from "./scenes/motionLibrary";
import { theSurprise } from "./scenes/theSurprise";
import { bonk } from "./scenes/bonk";

const TheSurprise = makeSceneComponent(theSurprise);
const Bonk = makeSceneComponent(bonk);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TheSurprise"
        component={TheSurprise}
        durationInFrames={theSurprise.durationInFrames}
        fps={theSurprise.fps}
        width={theSurprise.width}
        height={theSurprise.height}
      />
      <Composition id="Bonk" component={Bonk} durationInFrames={bonk.durationInFrames} fps={bonk.fps} width={bonk.width} height={bonk.height} />
      <Composition id="MotionLibrary" component={MotionLibrary} durationInFrames={motionLibrary.durationInFrames} fps={30} width={1080} height={1920} />
      <Composition id="PixiBench" component={PixiBench} durationInFrames={theSurprise.durationInFrames} fps={30} width={1080} height={1920} />
      <Composition id="GodotBridge" component={GodotBridge} durationInFrames={GODOT_BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
      <Composition id="RigLab" component={RigLab} durationInFrames={120} fps={30} width={1080} height={1920} />
    </>
  );
};
