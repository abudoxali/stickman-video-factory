import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SceneView } from "../render/SceneView";
import { MOTION_LIBRARY_CAPTIONS, motionLibrary } from "../scenes/motionLibrary";

/** Labelled motion test reel (captions are QA labels, not storytelling). */
export const MotionLibrary: React.FC = () => {
  const frame = useCurrentFrame();
  const cap = MOTION_LIBRARY_CAPTIONS.find((c) => frame >= c.from && frame < c.to);
  return (
    <AbsoluteFill style={{ backgroundColor: "#2a2238" }}>
      <SceneView def={motionLibrary} frame={frame} />
      {cap && (
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 60,
            right: 60,
            padding: "22px 30px",
            borderRadius: 24,
            background: "rgba(42,34,56,0.85)",
            color: "#fffaf2",
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 40,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {cap.text}
        </div>
      )}
    </AbsoluteFill>
  );
};
