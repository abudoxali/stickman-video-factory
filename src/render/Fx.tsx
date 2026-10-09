import React from "react";
import { clamp, ease, hash, lerp } from "../engine/math";
import type { FxKey } from "../engine/scene";
import { INK } from "./Props";

/**
 * Small, deterministic accent effects. Each is a pure function of (frame - at)
 * so renders are reproducible. Kept deliberately restrained: FX punctuate
 * actions, they never replace them.
 */
export const Fx: React.FC<{ fx: FxKey; frame: number; origin?: { x: number; y: number } }> = ({ fx, frame, origin }) => {
  const dur = fx.dur ?? 18;
  const t = frame - fx.at;
  if (t < 0 || t > dur) return null;
  const u = t / dur;
  const s = fx.scale ?? 1;
  const x = origin?.x ?? fx.x;
  const y = origin?.y ?? fx.y;
  const dir = fx.dir ?? 1;
  switch (fx.kind) {
    case "dust": {
      return (
        <g transform={`translate(${x} ${y}) scale(${s})`} opacity={1 - ease.inQuad(u)}>
          {[0, 1, 2, 3, 4].map((i) => {
            const side = i % 2 ? 1 : -1;
            const spread = (18 + i * 9) * ease.outCubic(u);
            const rise = 10 * ease.outQuad(u) + i * 2;
            const r = (7 + i * 1.6) * (0.6 + 0.6 * ease.outQuad(u));
            return <circle key={i} cx={side * spread} cy={-rise} r={r} fill="#fffaf2" stroke={INK} strokeWidth={3} opacity={0.9} />;
          })}
        </g>
      );
    }
    case "impactLines": {
      const k = ease.outCubic(u);
      return (
        <g transform={`translate(${x} ${y}) scale(${s})`} opacity={1 - ease.inCubic(u)}>
          {Array.from({ length: 9 }).map((_, i) => {
            const a = (i / 9) * Math.PI * 2 + 0.3;
            const r0 = 70 + 40 * k;
            const r1 = r0 + 40 * (1 - u * 0.6);
            return (
              <path
                key={i}
                d={`M${Math.cos(a) * r0} ${Math.sin(a) * r0} L${Math.cos(a) * r1} ${Math.sin(a) * r1}`}
                stroke={INK}
                strokeWidth={7}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    }
    case "smoke": {
      return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
          {[0, 1, 2].map((i) => {
            const tt = clamp(u * 1.3 - i * 0.12, 0, 1);
            const yy = -tt * 150;
            const xx = Math.sin(tt * 7 + i) * 14 * tt;
            return (
              <circle key={i} cx={xx} cy={yy} r={8 + tt * 16} fill="#d9d4e3" stroke={INK} strokeWidth={2.5} opacity={(1 - tt) * 0.85} />
            );
          })}
          <path
            d={`M0 0 C ${-10 * dir} -30 ${14 * dir} -50 0 -${80 * ease.outCubic(u)}`}
            stroke="#b9b2c8"
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            opacity={1 - u}
          />
        </g>
      );
    }
    case "puff": {
      // blow lines streaming from a mouth in direction `dir`
      return (
        <g transform={`translate(${x} ${y}) rotate(${fx.angle ?? 0}) scale(${dir * s} ${s})`} opacity={1 - ease.inQuad(u)}>
          {[-14, 0, 14].map((oy, i) => {
            const st = 10 + 60 * ease.outCubic(clamp(u * 1.4 - i * 0.1, 0, 1));
            return (
              <path
                key={i}
                d={`M${st} ${oy * (0.6 + u)} q 20 ${-6 + i * 6} 44 ${oy * 0.4}`}
                stroke="#ffffff"
                strokeWidth={6}
                fill="none"
                strokeLinecap="round"
                opacity={0.95}
              />
            );
          })}
          {[-14, 0, 14].map((oy, i) => {
            const st = 10 + 60 * ease.outCubic(clamp(u * 1.4 - i * 0.1, 0, 1));
            return (
              <path
                key={`o${i}`}
                d={`M${st} ${oy * (0.6 + u)} q 20 ${-6 + i * 6} 44 ${oy * 0.4}`}
                stroke={INK}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                opacity={0.5}
              />
            );
          })}
        </g>
      );
    }
    case "confetti": {
      const colors = ["#ff6f59", "#ffd23f", "#22b8a7", "#6b4a8f", "#f05c97"];
      return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
          {Array.from({ length: 16 }).map((_, i) => {
            const a = -Math.PI / 2 + (hash(i * 3.3 + fx.at) - 0.5) * 2.2;
            const sp = 9 + hash(i * 7.1 + fx.at) * 8;
            const vx = Math.cos(a) * sp * dir;
            const vy = Math.sin(a) * sp;
            const tt = t;
            const px = vx * tt * 0.9;
            const py = vy * tt + 0.45 * tt * tt;
            const rot = (tt * (8 + i)) % 360;
            return (
              <rect
                key={i}
                x={px - 5}
                y={py - 3}
                width={10}
                height={6}
                rx={1.5}
                fill={colors[i % colors.length]}
                transform={`rotate(${rot} ${px} ${py})`}
                opacity={1 - ease.inCubic(u)}
              />
            );
          })}
        </g>
      );
    }
    case "sparkle": {
      return (
        <g transform={`translate(${x} ${y}) scale(${s})`}>
          {[0, 1, 2, 3].map((i) => {
            const tt = clamp(u * 1.5 - i * 0.15, 0, 1);
            const sz = Math.sin(Math.PI * tt) * 14;
            const px = Math.cos(i * 1.9) * (30 + 30 * tt);
            const py = -20 - Math.sin(i * 2.3 + 1) * 30 - 40 * tt;
            return (
              <path
                key={i}
                d={`M${px} ${py - sz} Q${px} ${py} ${px + sz} ${py} Q${px} ${py} ${px} ${py + sz} Q${px} ${py} ${px - sz} ${py} Q${px} ${py} ${px} ${py - sz} Z`}
                fill="#fff3b0"
                stroke="#f2b400"
                strokeWidth={2}
              />
            );
          })}
        </g>
      );
    }
    case "motionArc": {
      const k = ease.outCubic(u);
      return (
        <path
          d={`M${x} ${y} q ${60 * dir * s} ${-50 * s} ${120 * dir * s} 0`}
          stroke="#ffffff"
          strokeWidth={10 * (1 - k)}
          fill="none"
          strokeLinecap="round"
          opacity={0.8 * (1 - k)}
        />
      );
    }
    case "breath": {
      return (
        <g transform={`translate(${x + dir * 30 * u} ${y - 10 * u}) scale(${s * lerp(0.6, 1.2, u)})`} opacity={1 - u}>
          <circle r={10} fill="#ffffff" stroke={INK} strokeWidth={2.5} />
          <circle cx={dir * 14} cy={-6} r={7} fill="#ffffff" stroke={INK} strokeWidth={2.5} />
        </g>
      );
    }
  }
};
