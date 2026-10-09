import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FrameSequence } from "../render/FrameSequence";
import { ParkBack, ParkFore } from "../render/Park";

/**
 * Engine bridge demo: characters rigged and animated in Godot (Skeleton2D
 * cutout rig built from Kenney Modular Characters, AnimationTree blending,
 * rendered transparent with Movie Maker) composited over this studio's SVG
 * park set. Proves Godot/Blender frame sequences can join the Remotion
 * pipeline as layers. Regenerate with `npm run godot:render`.
 */
export const GODOT_BRIDGE_FRAMES = 120;

export const GodotBridge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#7cc6ff" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute" }}>
        <ParkBack frame={frame} />
      </svg>
      {/* Godot renders 540x960; ground line at y=770 -> 1540 at 2x */}
      <FrameSequence dir="renders/godot-lab" count={GODOT_BRIDGE_FRAMES} style={{ position: "absolute", left: 0, top: -40, width: 1080, height: 1920 }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute" }}>
        <ParkFore frame={frame} />
      </svg>
    </AbsoluteFill>
  );
};
