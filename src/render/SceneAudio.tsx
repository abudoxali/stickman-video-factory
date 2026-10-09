import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { resolveSceneAudio } from "../engine/audio";
import type { SceneDef } from "../engine/scene";

/**
 * Plays a scene's resolved sound effects. Each cue is a Sequence starting at
 * its frame, so audio is frame-locked in Studio preview and in renders.
 */
export const SceneAudio: React.FC<{ def: SceneDef }> = ({ def }) => {
  const cues = resolveSceneAudio(def);
  return (
    <>
      {cues.map((c, i) => (
        <Sequence key={`${c.at}-${i}`} from={c.at} durationInFrames={Math.max(1, def.durationInFrames - c.at)} layout="none" name={c.label}>
          <Audio src={staticFile(c.file)} volume={c.volume} playbackRate={c.rate} />
        </Sequence>
      ))}
    </>
  );
};
