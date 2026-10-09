import React from "react";
import { getStaticFiles, Img, staticFile, useCurrentFrame } from "remotion";

/**
 * Plays an external PNG sequence (Godot Movie Maker / Blender renders) frame-
 * locked to the composition, so other engines can contribute layers to a
 * Remotion scene. Files: public/<dir>/<prefix><NNN...>.png.
 * If the sequence has not been rendered yet, shows a hint instead of failing.
 */
export const FrameSequence: React.FC<{
  dir: string;
  prefix?: string;
  digits?: number;
  count: number;
  from?: number;
  loop?: boolean;
  style?: React.CSSProperties;
}> = ({ dir, prefix = "frame", digits = 8, count, from = 0, loop = false, style }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0 || (!loop && local >= count)) return null;
  const i = loop ? ((local % count) + count) % count : local;
  const file = `${dir}/${prefix}${String(i).padStart(digits, "0")}.png`;
  const available = getStaticFiles().some((f) => f.name === file);
  if (!available) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", color: "#2a2238", fontSize: 40, fontFamily: "sans-serif" }}>
        missing {file} — run `npm run godot:render`
      </div>
    );
  }
  return <Img src={staticFile(file)} style={style} />;
};
