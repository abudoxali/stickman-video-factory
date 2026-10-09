import React from "react";
import { clamp, hash, noise1 } from "../engine/math";
import { INK } from "./Props";

/**
 * "Park" set — reusable outdoor stage in the same ink/flat-colour style as
 * the Party Room. World units; characters stand on PARK.floorY = 1500.
 * Every element is a pure function of the frame (deterministic environment
 * motion). Keyed set params (SceneDef.set):
 *   treeShake – impulse 0..1 (keyed spike) that rattles the canopy
 * Layers:
 *   ParkBack – sky, sun, clouds, hills, fence, lawn, tree, flowers, birds
 *   ParkFore – parallax foreground grass (camera depth 1.25)
 */
export const PARK = {
  floorY: 1500,
  /** Tree trunk: the ball can bounce off its right face at x = trunk.x1. */
  trunk: { x0: -70, x1: 32, top: 860 },
  canopy: { x: -30, y: 700 },
};

const C = {
  sky0: "#7cc6ff",
  sky1: "#e4f6ff",
  sun: "#ffd23f",
  sunHalo: "#fff1a8",
  hillFar: "#b7e4a6",
  hillNear: "#93d283",
  treeFar: "#6fbf72",
  lawn: "#86cf6e",
  lawnDark: "#6fbb5a",
  lawnLight: "#a3de86",
  path: "#ecd3a2",
  pathEdge: "#d9b97f",
  fence: "#fffaf2",
  fenceShade: "#e9dcc6",
  trunk: "#9a6345",
  trunkDark: "#7a4a33",
  leaf: "#4fb062",
  leafLight: "#73c97a",
  leafDark: "#3d9150",
  flowers: ["#ff6f59", "#ffd23f", "#f05c97", "#fffaf2"],
};

const Cloud: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path
      d="M-120 30 Q-150 30 -140 0 Q-130 -40 -85 -30 Q-70 -80 -15 -70 Q30 -105 70 -60 Q125 -70 125 -15 Q155 0 135 30 Z"
      fill="#ffffff"
      stroke={INK}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
    <path d="M-95 18 L110 18" stroke="#d9efff" strokeWidth={10} strokeLinecap="round" />
  </g>
);

const Bird: React.FC<{ x: number; y: number; flap: number; s: number }> = ({ x, y, flap, s }) => {
  const w = 22 * s;
  const h = 12 * s * flap;
  return (
    <path
      d={`M${x - w} ${y - h} Q${x - w / 2} ${y - h * 0.2} ${x} ${y} Q${x + w / 2} ${y - h * 0.2} ${x + w} ${y - h}`}
      stroke={INK}
      strokeWidth={4}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

const Flower: React.FC<{ x: number; y: number; color: string; frame: number; seed: number }> = ({ x, y, color, frame, seed }) => {
  const sway = 7 * Math.sin(frame / 26 + seed * 5) + 3 * noise1(frame / 18, seed);
  return (
    <g transform={`translate(${x} ${y}) rotate(${sway})`}>
      <path d="M0 0 Q4 -28 0 -54" stroke={C.leafDark} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M1 -22 Q16 -32 22 -24 Q12 -16 1 -22 Z" fill={C.leaf} stroke={INK} strokeWidth={2.5} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <circle key={i} cx={Math.cos(a) * 9} cy={-58 + Math.sin(a) * 9} r={8} fill={color} stroke={INK} strokeWidth={2.5} />;
      })}
      <circle cx={0} cy={-58} r={6} fill="#ffd23f" stroke={INK} strokeWidth={2.5} />
    </g>
  );
};

const Butterfly: React.FC<{ frame: number }> = ({ frame }) => {
  // lazy figure-eight drift near the flowers, wings flap fast
  const t = frame / 60;
  const x = 820 + 120 * Math.sin(t * 0.9) + 30 * noise1(frame / 30, 4);
  const y = 1300 + 50 * Math.sin(t * 1.8) + 20 * noise1(frame / 25, 9);
  const flap = 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.55));
  const dirX = Math.cos(t * 0.9) >= 0 ? 1 : -1;
  return (
    <g transform={`translate(${x} ${y}) scale(${dirX} 1)`}>
      <ellipse cx={-8 * flap} cy={-6} rx={12 * flap} ry={10} fill="#f05c97" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={8 * flap} cy={-6} rx={12 * flap} ry={10} fill="#ff8fb8" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={0} cy={0} rx={3} ry={9} fill={INK} />
    </g>
  );
};

/** Canopy rattle: a decaying oscillation after each treeShake impulse. */
const canopySway = (frame: number, shake: number) =>
  1.1 * Math.sin(frame / 38) + 0.6 * noise1(frame / 50, 3) + shake * 6 * Math.sin(frame * 1.3);

export const ParkBack: React.FC<{ frame: number; treeShake?: number; parallaxSky?: { dx: number; dy: number } }> = ({
  frame,
  treeShake = 0,
  parallaxSky = { dx: 0, dy: 0 },
}) => {
  const F = PARK.floorY;
  const T = PARK.trunk;
  const sway = canopySway(frame, clamp(treeShake, 0, 1));
  const cloud = (base: number, speed: number, span = 1900) => ((base + frame * speed) % span) - 500;
  return (
    <g>
      <defs>
        <linearGradient id="park-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.sky0} />
          <stop offset="1" stopColor={C.sky1} />
        </linearGradient>
      </defs>
      {/* sky band (oversized so camera moves never reveal edges) */}
      <rect x={-1200} y={-1200} width={3600} height={2700} fill="url(#park-sky)" />
      {/* sky layer drifts with parallax */}
      <g transform={`translate(${parallaxSky.dx} ${parallaxSky.dy})`}>
        <g transform={`translate(850 330)`}>
          <circle r={150} fill={C.sunHalo} opacity={0.6} />
          <g transform={`rotate(${frame * 0.4})`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <path
                key={i}
                d="M0 -118 L0 -150"
                transform={`rotate(${i * 30})`}
                stroke="#ffb627"
                strokeWidth={9}
                strokeLinecap="round"
              />
            ))}
          </g>
          <circle r={92} fill={C.sun} stroke={INK} strokeWidth={5} />
        </g>
        <Cloud x={cloud(100, 0.55)} y={260} s={1.05} />
        <Cloud x={cloud(900, 0.38)} y={470} s={0.8} />
        <Cloud x={cloud(1500, 0.7)} y={150} s={0.65} />
        {/* birds cross the sky on a loop */}
        {[0, 1].map((i) => {
          const period = 300;
          const ph = (frame + i * 22 + 40) % period;
          const bx = -200 + ph * 5.2;
          const by = 560 + 40 * Math.sin(ph / 30 + i) + i * 46;
          const flap = 0.3 + 0.7 * Math.abs(Math.sin((frame + i * 5) * 0.32));
          return <Bird key={i} x={bx} y={by} flap={flap} s={1 - i * 0.2} />;
        })}
      </g>
      {/* far hills with lollipop trees */}
      <path d="M-1200 1120 Q-500 880 100 1060 Q520 900 900 1030 Q1300 920 2400 1080 L2400 1500 L-1200 1500 Z" fill={C.hillFar} stroke={INK} strokeWidth={4} />
      {[220, 470, 640, 1010].map((x, i) => (
        <g key={x} transform={`translate(${x} ${1010 + (i % 2) * 22}) rotate(${1.5 * Math.sin(frame / 45 + i)})`}>
          <path d="M0 0 L0 -60" stroke={C.trunkDark} strokeWidth={8} />
          <circle cx={0} cy={-82} r={34} fill={C.treeFar} stroke={INK} strokeWidth={4} />
        </g>
      ))}
      <path d="M-1200 1260 Q-300 1120 400 1230 Q800 1160 1300 1240 Q1800 1180 2400 1260 L2400 1500 L-1200 1500 Z" fill={C.hillNear} stroke={INK} strokeWidth={4} />
      {/* lawn */}
      <rect x={-1200} y={1330} width={3600} height={1400} fill={C.lawn} />
      <path d="M-1200 1330 L2400 1330" stroke={INK} strokeWidth={4} />
      {/* picket fence */}
      <g>
        <rect x={-1200} y={1262} width={3600} height={14} fill={C.fence} stroke={INK} strokeWidth={3.5} />
        <rect x={-1200} y={1306} width={3600} height={14} fill={C.fence} stroke={INK} strokeWidth={3.5} />
        {Array.from({ length: 48 }).map((_, i) => {
          const x = -1180 + i * 75;
          return (
            <path
              key={i}
              d={`M${x} 1338 L${x} 1232 L${x + 16} 1214 L${x + 32} 1232 L${x + 32} 1338 Z`}
              fill={C.fence}
              stroke={INK}
              strokeWidth={3.5}
              strokeLinejoin="round"
            />
          );
        })}
      </g>
      {/* bushes along the fence */}
      {[-260, 300, 560, 1180].map((x, i) => (
        <g key={x} transform={`translate(${x} 1342) scale(${1 + 0.015 * Math.sin(frame / 30 + i)})`}>
          <path d="M-90 0 Q-100 -50 -55 -60 Q-40 -100 5 -90 Q50 -105 70 -60 Q110 -50 95 0 Z" fill={C.leaf} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={-30} cy={-55} r={8} fill={C.leafLight} />
          <circle cx={35} cy={-62} r={7} fill={C.leafLight} />
        </g>
      ))}
      {/* lawn stripes + path the characters stand on */}
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M${-1200} ${1360 + i * 34} L2400 ${1360 + i * 34}`} stroke={i % 2 ? C.lawnDark : C.lawnLight} strokeWidth={5} opacity={0.35} />
      ))}
      <path d={`M-1200 ${F - 42} Q540 ${F - 58} 2400 ${F - 42} L2400 ${F + 64} Q540 ${F + 80} -1200 ${F + 64} Z`} fill={C.path} stroke={C.pathEdge} strokeWidth={5} />
      {Array.from({ length: 22 }).map((_, i) => {
        const x = -1100 + i * 160 + hash(i * 3.3) * 60;
        const y = F - 20 + hash(i * 7.1) * 60;
        return <ellipse key={i} cx={x} cy={y} rx={9 + hash(i) * 8} ry={4} fill={C.pathEdge} opacity={0.7} />;
      })}
      {/* flowers */}
      {[[600, 1400], [660, 1384], [940, 1408], [1000, 1390], [360, 1396], [-140, 1404], [1220, 1396]].map(([x, y], i) => (
        <Flower key={i} x={x} y={y} color={C.flowers[i % C.flowers.length]} frame={frame} seed={i + 1} />
      ))}
      {/* the big tree (left): trunk + canopy that sways and rattles */}
      <g>
        <path
          d={`M${T.x0 - 26} ${F + 6} Q${T.x0 + 6} ${F - 40} ${T.x0 + 8} ${F - 160} L${T.x0 + 22} ${T.top} L${T.x1 - 18} ${T.top} L${T.x1} ${F - 160} Q${T.x1 + 4} ${F - 40} ${T.x1 + 34} ${F + 6} Z`}
          fill={C.trunk}
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d={`M${T.x0 + 34} ${F - 40} L${T.x0 + 40} ${T.top + 60}`} stroke={C.trunkDark} strokeWidth={9} strokeLinecap="round" opacity={0.6} />
        <path d={`M${T.x0 + 70} ${F - 260} Q${T.x0 + 80} ${F - 300} ${T.x0 + 64} ${F - 330}`} stroke={C.trunkDark} strokeWidth={6} fill="none" strokeLinecap="round" />
        <ellipse cx={T.x0 + 56} cy={F - 420} rx={10} ry={14} fill={C.trunkDark} stroke={INK} strokeWidth={3} />
        <g transform={`rotate(${sway} ${(T.x0 + T.x1) / 2} ${T.top + 40})`}>
          <path d={`M${T.x1 - 24} ${T.top + 30} Q${T.x1 + 60} ${T.top - 20} ${T.x1 + 120} ${T.top - 70}`} stroke={C.trunk} strokeWidth={22} fill="none" strokeLinecap="round" />
          {[
            [-120, -40, 150],
            [60, -110, 170],
            [210, -10, 120],
            [-30, 90, 140],
            [150, 90, 120],
            [-170, 90, 100],
          ].map(([dx, dy, r], i) => (
            <circle key={`o${i}`} cx={PARK.canopy.x + dx} cy={PARK.canopy.y + dy} r={r + 5} fill={INK} />
          ))}
          {[
            [-120, -40, 150],
            [60, -110, 170],
            [210, -10, 120],
            [-30, 90, 140],
            [150, 90, 120],
            [-170, 90, 100],
          ].map(([dx, dy, r], i) => (
            <circle key={`f${i}`} cx={PARK.canopy.x + dx} cy={PARK.canopy.y + dy} r={r} fill={i % 2 ? C.leaf : C.leafLight} />
          ))}
          {Array.from({ length: 14 }).map((_, i) => {
            const a = hash(i * 9.7) * Math.PI * 2;
            const rr = 60 + hash(i * 4.1) * 170;
            return (
              <path
                key={i}
                d="M0 0 q6 -10 0 -18"
                transform={`translate(${PARK.canopy.x + Math.cos(a) * rr} ${PARK.canopy.y + Math.sin(a) * rr * 0.7}) rotate(${a * 57})`}
                stroke={C.leafDark}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </g>
      <Butterfly frame={frame} />
    </g>
  );
};

export const ParkFore: React.FC<{ frame: number }> = ({ frame }) => (
  <g>
    {Array.from({ length: 16 }).map((_, i) => {
      const x = -300 + i * 120 + hash(i * 2.7) * 50;
      const y = 1980 + hash(i * 5.3) * 40;
      const sway = 6 * Math.sin(frame / 22 + i * 0.9) + 3 * noise1(frame / 15, i);
      const h = 90 + hash(i * 1.9) * 70;
      return (
        <g key={i} transform={`translate(${x} ${y}) rotate(${sway})`}>
          <path
            d={`M-26 0 Q-22 ${-h * 0.6} -34 ${-h} Q-8 ${-h * 0.55} 0 ${-h * 0.4} Q8 ${-h * 0.9} 22 ${-h * 1.1} Q18 ${-h * 0.5} 30 0 Z`}
            fill={i % 2 ? "#5aa851" : "#4f9a48"}
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        </g>
      );
    })}
  </g>
);
