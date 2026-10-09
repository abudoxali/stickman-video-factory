import React from "react";
import { hash, noise1 } from "../engine/math";
import { INK } from "./Props";

/**
 * "Party Room" set. World units; characters stand on FLOOR_Y = 1500.
 * Everything is a pure function of the frame (environmental motion is
 * deterministic). Layers:
 *   RoomBack  – walls, window, shelf, desk, rug (behind everyone)
 *   Doorway   – dark opening behind the door (drawn before characters)
 *   DoorPanel – the door leaf; drawn between characters per scene draw order
 *   RoomFore  – parallax foreground plant (drawn last, camera depth 1.25)
 */
export const ROOM = {
  floorY: 1500,
  door: { x0: 110, x1: 310, top: 960, bottom: 1474 },
  desk: { x0: 700, x1: 1050, top: 1222 },
  window: { x0: 420, x1: 700, y0: 470, y1: 860 },
};

const C = {
  ceiling: "#e7c9a8",
  wall: "#f7e6cc",
  wallDot: "#efd5b3",
  wainscot: "#ecc79b",
  rail: "#d7a875",
  base: "#b9805a",
  floor: "#c98b5a",
  floorLine: "#ad7247",
  rug: "#ffd166",
  rugBand: "#f2a541",
  wood: "#8a5a44",
  woodDark: "#6e4535",
  door: "#c0694b",
  doorDark: "#a15238",
  sky0: "#7cc6ff",
  sky1: "#d6f0ff",
  hill: "#8fd18a",
  curtain: "#f28f6b",
  curtainDark: "#d8714f",
};

const Bunting: React.FC<{ frame: number }> = ({ frame }) => {
  const x0 = -60;
  const x1 = 1140;
  const y0 = 300;
  const n = 15;
  const colors = ["#ff6f59", "#ffd23f", "#22b8a7", "#6b4a8f", "#f05c97"];
  const pt = (t: number) => {
    const x = x0 + (x1 - x0) * t;
    const sag = 90 * 4 * t * (1 - t);
    const sway = 6 * Math.sin(frame / 22 + t * 3) * Math.sin(Math.PI * t);
    return { x, y: y0 + sag + sway };
  };
  const path = Array.from({ length: 41 }, (_, i) => pt(i / 40));
  return (
    <g>
      <path d={`M${path.map((p) => `${p.x} ${p.y}`).join(" L")}`} stroke={INK} strokeWidth={4} fill="none" />
      {Array.from({ length: n }).map((_, i) => {
        const t = (i + 0.5) / n;
        const p = pt(t);
        const a = 6 * Math.sin(frame / 15 + i * 1.3);
        return (
          <path
            key={i}
            d="M-22 0 L22 0 L0 46 Z"
            transform={`translate(${p.x} ${p.y}) rotate(${a})`}
            fill={colors[i % colors.length]}
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
};

const Balloon: React.FC<{ x: number; y: number; color: string; frame: number; seed: number; tie: { x: number; y: number } }> = ({
  x,
  y,
  color,
  frame,
  seed,
  tie,
}) => {
  const bx = x + 10 * noise1(frame / 40, seed);
  const by = y + 6 * noise1(frame / 33, seed + 3);
  const rot = 6 * noise1(frame / 45, seed + 7);
  return (
    <g>
      <path d={`M${tie.x} ${tie.y} Q${(tie.x + bx) / 2 + 20} ${(tie.y + by) / 2} ${bx} ${by + 62}`} stroke={INK} strokeWidth={2.5} fill="none" />
      <g transform={`translate(${bx} ${by}) rotate(${rot})`}>
        <ellipse cx={0} cy={0} rx={46} ry={56} fill={color} stroke={INK} strokeWidth={5} />
        <ellipse cx={-16} cy={-20} rx={9} ry={16} fill="#ffffff" opacity={0.55} transform="rotate(25 -16 -20)" />
        <path d="M-7 58 L7 58 L0 50 Z" fill={color} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      </g>
    </g>
  );
};

export const RoomBack: React.FC<{ frame: number; lamp?: number; parallaxSky?: { dx: number; dy: number } }> = ({
  frame,
  lamp = 0,
  parallaxSky = { dx: 0, dy: 0 },
}) => {
  const W = ROOM.window;
  const D = ROOM.desk;
  const floorY = ROOM.floorY;
  const cloudX = (base: number, speed: number) => ((base + frame * speed) % 520) - 120;
  const pend = 3.5 * Math.sin(frame / 34);
  return (
    <g>
      {/* ceiling + wall */}
      <rect x={-600} y={-400} width={2400} height={640} fill={C.ceiling} />
      <rect x={-600} y={230} width={2400} height={1250} fill={C.wall} />
      {Array.from({ length: 13 * 16 }).map((_, i) => {
        const cx = -560 + (i % 26) * 90 + ((Math.floor(i / 26) % 2) * 45);
        const cy = 290 + Math.floor(i / 26) * 110;
        return cy < 1140 ? <circle key={i} cx={cx} cy={cy} r={7} fill={C.wallDot} /> : null;
      })}
      <rect x={-600} y={226} width={2400} height={18} fill={C.rail} stroke={INK} strokeWidth={4} />
      {/* wainscot */}
      <rect x={-600} y={1150} width={2400} height={320} fill={C.wainscot} />
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={-560 + i * 150} y={1190} width={120} height={230} rx={6} fill="none" stroke={C.rail} strokeWidth={5} />
      ))}
      <rect x={-600} y={1142} width={2400} height={16} fill={C.rail} stroke={INK} strokeWidth={4} />
      {/* window */}
      <rect x={W.x0 - 18} y={W.y0 - 18} width={W.x1 - W.x0 + 36} height={W.y1 - W.y0 + 36} rx={10} fill="#fffaf2" stroke={INK} strokeWidth={5} />
      <defs>
        <clipPath id="win">
          <rect x={W.x0} y={W.y0} width={W.x1 - W.x0} height={W.y1 - W.y0} />
        </clipPath>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.sky0} />
          <stop offset="1" stopColor={C.sky1} />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lampGlow">
          <stop offset="0" stopColor="#fff2b3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff2b3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#win)">
        <g transform={`translate(${parallaxSky.dx} ${parallaxSky.dy})`}>
          <rect x={W.x0 - 200} y={W.y0 - 200} width={W.x1 - W.x0 + 400} height={W.y1 - W.y0 + 400} fill="url(#sky)" />
          {[
            [0, 0.35, 540],
            [260, 0.22, 620],
          ].map(([b, sp, cy], i) => {
            const x = W.x0 + cloudX(b, sp);
            return (
              <g key={i} transform={`translate(${x} ${cy})`}>
                <ellipse cx={0} cy={0} rx={60} ry={24} fill="#ffffff" />
                <ellipse cx={30} cy={-16} rx={34} ry={26} fill="#ffffff" />
                <ellipse cx={-26} cy={-10} rx={26} ry={20} fill="#ffffff" />
              </g>
            );
          })}
          <path d={`M${W.x0 - 200} 900 Q ${W.x0 + 60} 720 ${W.x0 + 200} 790 T ${W.x1 + 200} 760 L ${W.x1 + 200} 1000 L ${W.x0 - 200} 1000 Z`} fill={C.hill} stroke={INK} strokeWidth={4} />
          <circle cx={W.x0 + 210} cy={W.y0 + 70} r={34} fill="#fff3b0" />
        </g>
      </g>
      <path d={`M${(W.x0 + W.x1) / 2} ${W.y0} L${(W.x0 + W.x1) / 2} ${W.y1} M${W.x0} ${(W.y0 + W.y1) / 2} L${W.x1} ${(W.y0 + W.y1) / 2}`} stroke="#fffaf2" strokeWidth={14} />
      <rect x={W.x0} y={W.y0} width={W.x1 - W.x0} height={W.y1 - W.y0} fill="none" stroke={INK} strokeWidth={5} />
      {/* curtains with sway */}
      {[-1, 1].map((side) => {
        const x = side < 0 ? W.x0 - 30 : W.x1 + 30;
        const sw = 5 * Math.sin(frame / 28 + side);
        return (
          <path
            key={side}
            d={`M${x - 38 * side} ${W.y0 - 40} L${x + 26 * side} ${W.y0 - 40} Q${x + 10 * side + sw} ${(W.y0 + W.y1) / 2} ${x + 30 * side + sw * 1.6} ${W.y1 + 60} L${x - 34 * side + sw} ${W.y1 + 60} Q${x - 30 * side} ${(W.y0 + W.y1) / 2} ${x - 38 * side} ${W.y0 - 40} Z`}
            fill={C.curtain}
            stroke={INK}
            strokeWidth={5}
            strokeLinejoin="round"
          />
        );
      })}
      <rect x={W.x0 - 90} y={W.y0 - 52} width={W.x1 - W.x0 + 180} height={14} rx={7} fill={C.wood} stroke={INK} strokeWidth={4} />
      {/* framed drawing */}
      <g transform="translate(150 640)">
        <rect x={-70} y={-90} width={140} height={170} rx={6} fill={C.wood} stroke={INK} strokeWidth={5} />
        <rect x={-54} y={-74} width={108} height={138} fill="#fffaf2" stroke={INK} strokeWidth={3} />
        <circle cx={-22} cy={-44} r={14} fill="#ffd23f" />
        <circle cx={10} cy={0} r={12} fill="none" stroke={INK} strokeWidth={3} />
        <path d="M10 12 L10 38 M10 20 L-4 30 M10 20 L24 10 M10 38 L0 56 M10 38 L20 56" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      </g>
      {/* shelf above desk */}
      <g>
        <rect x={760} y={850} width={270} height={16} rx={4} fill={C.wood} stroke={INK} strokeWidth={4} />
        {[
          [778, 34, 92, "#22b8a7"],
          [814, 28, 80, "#ff6f59"],
          [844, 30, 98, "#6b4a8f"],
          [876, 24, 70, "#ffd23f"],
        ].map(([x, w, h, c], i) => (
          <rect key={i} x={Number(x)} y={850 - Number(h)} width={Number(w)} height={Number(h)} rx={3} fill={String(c)} stroke={INK} strokeWidth={4} transform={i === 3 ? `rotate(12 ${Number(x)} 850)` : undefined} />
        ))}
        <path d="M980 850 L970 800 L1010 800 L1000 850 Z" fill="#c98b5a" stroke={INK} strokeWidth={4} />
        {[0, 1, 2].map((i) => {
          const a = -0.6 + i * 0.6 + 0.04 * Math.sin(frame / 30 + i);
          return (
            <ellipse key={i} cx={990 + Math.sin(a) * 26} cy={790 - Math.cos(a) * 26} rx={10} ry={22} transform={`rotate(${(a * 180) / Math.PI} ${990 + Math.sin(a) * 26} ${790 - Math.cos(a) * 26})`} fill="#5fbf6a" stroke={INK} strokeWidth={3.5} />
          );
        })}
      </g>
      <Bunting frame={frame} />
      <Balloon x={372} y={800} color="#22b8a7" frame={frame} seed={1} tie={{ x: 330, y: 948 }} />
      <Balloon x={430} y={880} color="#ff6f59" frame={frame} seed={5} tie={{ x: 332, y: 952 }} />
      {/* pendant lamp */}
      <g transform={`rotate(${pend} 560 230)`}>
        <path d="M560 230 L560 360" stroke={INK} strokeWidth={4} />
        <path d="M510 410 Q560 340 610 410 Z" fill="#22b8a7" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <ellipse cx={560} cy={412} rx={18} ry={9} fill="#fff3b0" stroke={INK} strokeWidth={3} />
      </g>
      {/* baseboard + floor */}
      <rect x={-600} y={1440} width={2400} height={34} fill={C.base} stroke={INK} strokeWidth={4} />
      <rect x={-600} y={1474} width={2400} height={900} fill={C.floor} />
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 1474 + 30 * Math.pow(i + 1, 1.45);
        return <path key={i} d={`M-600 ${y} L1800 ${y}`} stroke={C.floorLine} strokeWidth={4} />;
      })}
      {Array.from({ length: 40 }).map((_, i) => {
        const row = i % 8;
        const yA = 1474 + 30 * Math.pow(row, 1.45);
        const yB = 1474 + 30 * Math.pow(row + 1, 1.45);
        const x = -560 + ((i * 263 + row * 131) % 2300);
        return <path key={`s${i}`} d={`M${x} ${yA} L${x} ${yB}`} stroke={C.floorLine} strokeWidth={4} />;
      })}
      {/* rug */}
      <ellipse cx={560} cy={1546} rx={430} ry={56} fill={C.rug} stroke={INK} strokeWidth={5} />
      <ellipse cx={560} cy={1546} rx={360} ry={38} fill="none" stroke={C.rugBand} strokeWidth={10} />
      {/* desk */}
      <g>
        <rect x={D.x0 + 18} y={D.top + 18} width={22} height={ROOM.floorY - D.top - 22} fill={C.woodDark} stroke={INK} strokeWidth={4} />
        <rect x={D.x1 - 150} y={D.top + 18} width={130} height={ROOM.floorY - D.top - 22} rx={4} fill={C.wood} stroke={INK} strokeWidth={4} />
        <rect x={D.x1 - 138} y={D.top + 40} width={106} height={70} rx={5} fill={C.woodDark} stroke={INK} strokeWidth={3.5} />
        <rect x={D.x1 - 138} y={D.top + 128} width={106} height={70} rx={5} fill={C.woodDark} stroke={INK} strokeWidth={3.5} />
        <circle cx={D.x1 - 85} cy={D.top + 75} r={6} fill="#ffd23f" stroke={INK} strokeWidth={3} />
        <circle cx={D.x1 - 85} cy={D.top + 163} r={6} fill="#ffd23f" stroke={INK} strokeWidth={3} />
        <rect x={D.x0} y={D.top} width={D.x1 - D.x0} height={24} rx={6} fill={C.wood} stroke={INK} strokeWidth={5} />
      </g>
      {/* desk lamp */}
      <g>
        {lamp > 0.01 && <ellipse cx={1000} cy={1150} rx={120} ry={90} fill="url(#lampGlow)" opacity={lamp} />}
        <ellipse cx={1010} cy={D.top - 4} rx={32} ry={9} fill={C.woodDark} stroke={INK} strokeWidth={4} />
        <path d={`M1010 ${D.top - 8} L1032 ${D.top - 120} L990 ${D.top - 168}`} stroke={INK} strokeWidth={7} fill="none" strokeLinejoin="round" />
        <path d={`M960 ${D.top - 150} L1010 ${D.top - 196} L1022 ${D.top - 140} Z`} fill="#ffd23f" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      </g>
      {/* sunbeam + dust motes */}
      <path d={`M${W.x0} ${W.y1} L${W.x1} ${W.y1} L${W.x1 + 420} ${floorY + 60} L${W.x0 + 260} ${floorY + 60} Z`} fill="url(#beam)" opacity={0.55} />
      {Array.from({ length: 14 }).map((_, i) => {
        const t = (frame / 300 + hash(i * 4.1)) % 1;
        const bx = W.x0 + 120 + hash(i * 9.7) * 300 + t * 220;
        const by = W.y1 + 60 + t * 520 + 18 * Math.sin(frame / 25 + i);
        return <circle key={`d${i}`} cx={bx} cy={by} r={2 + hash(i) * 2.5} fill="#fffbe8" opacity={0.75 * Math.sin(Math.PI * t)} />;
      })}
    </g>
  );
};

export const Doorway: React.FC<{ frame: number; open: number }> = ({ open }) => {
  const d = ROOM.door;
  return (
    <g>
      <rect x={d.x0 - 22} y={d.top - 22} width={d.x1 - d.x0 + 44} height={d.bottom - d.top + 22} rx={6} fill={C.wood} stroke={INK} strokeWidth={5} />
      <rect x={d.x0} y={d.top} width={d.x1 - d.x0} height={d.bottom - d.top} fill="#3b2b3f" />
      <rect x={d.x0} y={d.top} width={d.x1 - d.x0} height={d.bottom - d.top} fill="#ffcf7a" opacity={0.18 * open} />
      <path d={`M${d.x0} ${d.bottom} L${d.x1} ${d.bottom} L${d.x1 + 40} ${d.bottom + 26} L${d.x0 - 40} ${d.bottom + 26} Z`} fill="#ffe0a0" opacity={0.35 * open} />
    </g>
  );
};

/** Door leaf, hinged on the left jamb. open: 0 closed .. 1 swung flat against the wall (can overshoot). */
export const DoorPanel: React.FC<{ open: number }> = ({ open }) => {
  const d = ROOM.door;
  const w = d.x1 - d.x0;
  const sx = 1 - 1.32 * open; // flips through the hinge toward the viewer
  const shade = Math.min(1, Math.abs(open - 0.75) < 0.4 ? 0.15 : 0);
  return (
    <g transform={`translate(${d.x0} 0) scale(${sx} 1) translate(${-d.x0} 0)`}>
      <rect x={d.x0} y={d.top} width={w} height={d.bottom - d.top} rx={4} fill={open > 0.76 ? C.doorDark : C.door} stroke={INK} strokeWidth={5 / Math.max(0.3, Math.abs(sx))} />
      <rect x={d.x0 + 26} y={d.top + 30} width={w - 52} height={190} rx={6} fill="none" stroke={C.doorDark} strokeWidth={8} />
      <rect x={d.x0 + 26} y={d.top + 250} width={w - 52} height={220} rx={6} fill="none" stroke={C.doorDark} strokeWidth={8} />
      <circle cx={d.x1 - 26} cy={d.top + 270} r={11} fill="#ffd23f" stroke={INK} strokeWidth={4} />
      {shade > 0 && <rect x={d.x0} y={d.top} width={w} height={d.bottom - d.top} fill={INK} opacity={shade} />}
    </g>
  );
};

export const RoomFore: React.FC<{ frame: number }> = ({ frame }) => {
  const leaf = (x: number, y: number, a: number, s: number, i: number) => {
    const sw = 2.5 * Math.sin(frame / 31 + i);
    return (
      <g key={i} transform={`translate(${x} ${y}) rotate(${a + sw}) scale(${s})`}>
        <path d="M0 0 C 40 -40 60 -140 0 -200 C -60 -140 -40 -40 0 0 Z" fill="#3f9a5a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d="M0 -10 L0 -180" stroke="#2f7a46" strokeWidth={6} />
      </g>
    );
  };
  return (
    <g>
      <g>
        {leaf(1160, 1830, -40, 1.25, 1)}
        {leaf(1160, 1830, -8, 1.4, 2)}
        {leaf(1160, 1830, 24, 1.15, 3)}
        {leaf(1160, 1830, -70, 1.0, 4)}
        <path d="M1060 1820 L1260 1820 L1235 2050 L1085 2050 Z" fill="#ff6f59" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <rect x={1050} y={1806} width={220} height={30} rx={8} fill="#e2523e" stroke={INK} strokeWidth={6} />
      </g>
      <g>
        {leaf(-90, 1900, 30, 1.2, 5)}
        {leaf(-90, 1900, 62, 1.05, 6)}
      </g>
    </g>
  );
};
