import React from "react";
import { clamp, lerp, noise1 } from "../engine/math";

export const INK = "#2a2238";
const O = 5;

export interface PropDrawProps {
  frame: number;
  params: Record<string, number>;
}

/** Gift box body. Origin: bottom centre. params: glow (0..1), squash */
export const GiftBox: React.FC<PropDrawProps> = ({ params }) => {
  const w = 152;
  const h = 120;
  const sq = params.squash ?? 1;
  const glow = clamp(params.glow ?? 0, 0, 1);
  return (
    <g transform={`scale(${1 / Math.sqrt(sq)} ${sq})`}>
      {glow > 0.01 && (
        <g opacity={glow}>
          <ellipse cx={0} cy={-h - 6} rx={w * 0.75} ry={34} fill="#ffe08a" opacity={0.55} />
          <ellipse cx={0} cy={-h - 4} rx={w * 0.45} ry={16} fill="#fff6c9" opacity={0.9} />
        </g>
      )}
      <rect x={-w / 2} y={-h} width={w} height={h} rx={8} fill="#e84a8a" stroke={INK} strokeWidth={O} />
      <rect x={-w / 2 + 6} y={-h + 6} width={18} height={h - 12} rx={4} fill="#c93a74" opacity={0.6} />
      <rect x={-13} y={-h} width={26} height={h} fill="#ffd23f" stroke={INK} strokeWidth={4} />
      <path d={`M${-w / 2 + 2} ${-h * 0.55} L${w / 2 - 2} ${-h * 0.55}`} stroke="#ffd23f" strokeWidth={14} />
      <path d={`M${-w / 2 + 2} ${-h * 0.55 - 7} L${w / 2 - 2} ${-h * 0.55 - 7} M${-w / 2 + 2} ${-h * 0.55 + 7} L${w / 2 - 2} ${-h * 0.55 + 7}`} stroke={INK} strokeWidth={3} />
      {/* tag */}
      <path d={`M${w / 2 - 4} ${-h * 0.45} l18 10 l-6 22 l-20 -8 z`} fill="#fffaf2" stroke={INK} strokeWidth={3} />
      <circle cx={w / 2 + 6} cy={-h * 0.45 + 12} r={2.5} fill={INK} />
    </g>
  );
};

/** Lid with bow. Origin: bottom centre of the lid. */
export const GiftLid: React.FC<PropDrawProps> = ({ frame, params }) => {
  const w = 164;
  const h = 28;
  const wob = (params.wobble ?? 0) * Math.sin(frame * 1.3) * 0.08;
  return (
    <g>
      <g transform={`rotate(${wob * 57}) translate(0 ${-h})`}>
        <path d="M0 0 C -30 -40 -62 -20 -42 2 C -30 10 -12 6 0 0 Z" fill="#ffd23f" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d="M0 0 C 30 -40 62 -20 42 2 C 30 10 12 6 0 0 Z" fill="#ffd23f" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-6 2 L-18 26 M6 2 L18 26" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <circle cx={0} cy={0} r={9} fill="#f2b400" stroke={INK} strokeWidth={4} />
      </g>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={7} fill="#f05c97" stroke={INK} strokeWidth={O} />
      <rect x={-14} y={-h} width={28} height={h} fill="#ffd23f" stroke={INK} strokeWidth={4} />
    </g>
  );
};

/** Cupcake with candle. Origin: bottom centre. params: flame (0..1), frosting squish */
export const Cupcake: React.FC<PropDrawProps> = ({ frame, params }) => {
  const flame = clamp(params.flame ?? 1, 0, 1);
  const flick = 1 + 0.12 * noise1(frame / 2.2, 5);
  const sway = noise1(frame / 3, 9) * 4;
  return (
    <g>
      <path d="M-34 -2 L-40 -44 L40 -44 L34 -2 Z" fill="#7fd1f0" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {[-24, -8, 8, 24].map((x) => (
        <path key={x} d={`M${x} -40 L${x * 0.85} -4`} stroke="#4fb3d9" strokeWidth={4} />
      ))}
      <path
        d="M-44 -42 C -52 -62 -30 -70 -26 -66 C -24 -86 0 -92 6 -80 C 18 -96 42 -80 34 -66 C 52 -64 50 -44 40 -42 Z"
        fill="#ffb3d1"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {[
        [-26, -54, "#ffd23f"],
        [-6, -70, "#22b8a7"],
        [16, -58, "#ff6f59"],
        [28, -50, "#6b4a8f"],
        [-12, -50, "#ff6f59"],
      ].map(([x, y, c], i) => (
        <rect key={i} x={Number(x)} y={Number(y)} width={9} height={4} rx={2} fill={String(c)} transform={`rotate(${i * 37} ${x} ${y})`} />
      ))}
      <rect x={-5} y={-128} width={10} height={44} rx={3} fill="#fffaf2" stroke={INK} strokeWidth={3} />
      <path d="M-5 -120 L5 -114 M-5 -108 L5 -102 M-5 -96 L5 -90" stroke="#ff6f59" strokeWidth={3} />
      <path d="M0 -128 L0 -136" stroke={INK} strokeWidth={2.5} />
      {flame > 0.02 && (
        <g transform={`translate(${sway * 0.4} -136) scale(${flame * flick} ${flame * flick * (1 + 0.1 * noise1(frame / 1.7, 2))})`}>
          <ellipse cx={0} cy={-8} rx={26} ry={30} fill="#ffd27a" opacity={0.25} />
          <path d={`M0 0 C -11 -8 -8 -22 ${sway * 0.3} -34 C 9 -22 11 -8 0 0 Z`} fill="#ffb02e" stroke={INK} strokeWidth={2.5} />
          <path d={`M0 -2 C -5 -7 -4 -14 ${sway * 0.2} -20 C 4 -14 5 -7 0 -2 Z`} fill="#fff3b0" />
        </g>
      )}
    </g>
  );
};

/** Party horn held at the mouthpiece. Origin: mouthpiece; extends along +x. params: unroll 0..1 */
export const PartyHorn: React.FC<PropDrawProps> = ({ frame, params }) => {
  const u = clamp(params.unroll ?? 0, 0, 1);
  const L = 120;
  const flutter = Math.sin(frame * 1.7) * 3 * u;
  const segs = 14;
  const pts: string[] = [];
  // Unrolled length along x, the rest curls into a shrinking spiral.
  const straight = L * u;
  let x = 22;
  let y = 0;
  let ang = 0;
  const step = L / segs;
  for (let i = 0; i <= segs; i++) {
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    const along = i * step;
    if (along > straight) ang += 0.55 + (along - straight) / L;
    else ang = (flutter / 60) * (i / segs);
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step + (along < straight ? flutter / segs : 0);
  }
  return (
    <g>
      <path d={`M${pts.join(" L")}`} stroke={INK} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${pts.join(" L")}`} stroke="#ffd23f" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${pts.join(" L")}`} stroke="#ff6f59" strokeWidth={10} fill="none" strokeDasharray="10 12" strokeLinejoin="round" />
      <path d="M-4 -9 L24 -11 L24 11 L-4 9 Z" fill="#22b8a7" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    </g>
  );
};

/** Wooden crate (for push/pull demos). Origin bottom centre. */
export const Crate: React.FC<PropDrawProps> = () => (
  <g>
    <rect x={-70} y={-120} width={140} height={120} rx={6} fill="#c98b5a" stroke={INK} strokeWidth={O} />
    <path d="M-70 -60 L70 -60 M-62 -112 L62 -8 M-62 -8 L62 -112" stroke="#9a643d" strokeWidth={8} />
    <rect x={-70} y={-120} width={140} height={120} rx={6} fill="none" stroke={INK} strokeWidth={O} />
  </g>
);

/** Beach ball (pickup / hand-over demos). Origin centre. */
export const Ball: React.FC<PropDrawProps> = () => (
  <g>
    <circle r={30} fill="#fffaf2" stroke={INK} strokeWidth={O} />
    <path d="M0 -30 A30 30 0 0 1 26 15 L0 0 Z" fill="#ff6f59" />
    <path d="M26 15 A30 30 0 0 1 -26 15 L0 0 Z" fill="#22b8a7" />
    <path d="M-26 15 A30 30 0 0 1 0 -30 L0 0 Z" fill="#ffd23f" />
    <circle r={30} fill="none" stroke={INK} strokeWidth={O} />
    <circle r={6} fill="#fffaf2" stroke={INK} strokeWidth={3} />
  </g>
);

export const PROP_RENDERERS: Record<string, React.FC<PropDrawProps>> = {
  giftBox: GiftBox,
  giftLid: GiftLid,
  cupcake: Cupcake,
  partyHorn: PartyHorn,
  crate: Crate,
  ball: Ball,
};

/** Fraction helper for smear trails. */
export const trailOpacity = (i: number, n: number) => lerp(0.35, 0.08, i / Math.max(1, n - 1));
