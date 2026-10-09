import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BO, PIP } from "../characters";
import { EXPRESSION_NAMES, type ExpressionName } from "../engine/expressions";
import { evaluateScene } from "../engine/runtime";
import type { SceneDef } from "../engine/scene";
import { CharacterShadow, CharacterView } from "../render/Character";

/**
 * Rig lab: one character per expression, cycling idle so faces, posture and
 * breathing can be inspected side by side. Used for character-design QA.
 */
const FLOOR = 520;
const COLS = 3;

const mkCell = (expr: ExpressionName, i: number): SceneDef => ({
  id: `lab-${expr}`,
  width: 360,
  height: 640,
  fps: 30,
  durationInFrames: 120,
  floorY: FLOOR,
  characters: [
    {
      id: "c",
      spec: i % 2 ? BO : PIP,
      x: 180,
      facing: 1,
      moves: [],
      actions: [],
      expressions: [{ at: 0, expr }],
      look: [{ at: 0, target: "camera" }],
    },
  ],
  props: [],
  camera: { keys: [], shakes: [] },
  fx: [],
  set: {},
});

export const RigLab: React.FC = () => {
  const frame = useCurrentFrame();
  const cells = useMemo(() => EXPRESSION_NAMES.slice(0, 12).map(mkCell), []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#f4efe6" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        {cells.map((def, i) => {
          const sf = evaluateScene(def, frame);
          const ch = sf.characters.c;
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          return (
            <g key={def.id} transform={`translate(${col * 360} ${row * 480 - 60}) scale(0.82) translate(40 30)`}>
              <CharacterShadow pose={ch.pose} joints={ch.joints} floorY={FLOOR} s={ch.spec} />
              <CharacterView s={ch.spec} pose={ch.pose} joints={ch.joints} />
              <text x={180} y={FLOOR + 50} textAnchor="middle" fontFamily="Helvetica, Arial" fontSize={30} fill="#2a2238">
                {EXPRESSION_NAMES[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
