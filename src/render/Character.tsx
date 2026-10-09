import React from "react";
import { add, clamp, dir, lerp, rotate, scale, sub, v, vlerp, type Vec2 } from "../engine/math";
import { facingScale, up } from "../engine/rig";
import type { LimbSmear } from "../engine/runtime";
import type { CharacterSpec, Joints, Pose } from "../engine/types";

// ---------------------------------------------------------------------------
// Small SVG path helpers
// ---------------------------------------------------------------------------
const r2 = (n: number) => Math.round(n * 100) / 100;
const P = (p: Vec2) => `${r2(p.x)} ${r2(p.y)}`;
const poly = (pts: Vec2[]) => `M${pts.map(P).join(" L")}`;
const deg = (rad: number) => (rad * 180) / Math.PI;
const perp = (d: Vec2) => v(-d.y, d.x);
const norm = (d: Vec2) => {
  const l = Math.hypot(d.x, d.y) || 1;
  return v(d.x / l, d.y / l);
};

/** Smooth closed outline around a spine polyline with per-point half-widths. */
const capsulePath = (spine: Vec2[], halfW: number[]) => {
  const n = spine.length;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(n - 1, i + 1)];
    const nn = perp(norm(sub(b, a)));
    left.push(add(spine[i], scale(nn, halfW[i])));
    right.push(sub(spine[i], scale(nn, halfW[i])));
  }
  const tDir = norm(sub(spine[n - 1], spine[n - 2]));
  const bDir = norm(sub(spine[0], spine[1]));
  const topCap = add(spine[n - 1], scale(tDir, halfW[n - 1] * 0.85));
  const botCap = add(spine[0], scale(bDir, halfW[0] * 0.55));
  // left side bottom->top through midpoints with quadratic smoothing
  let d = `M${P(left[0])}`;
  for (let i = 1; i < n; i++) {
    const m = vlerp(left[i - 1], left[i], 0.5);
    d += ` Q${P(left[i - 1])} ${P(m)}`;
  }
  d += ` L${P(left[n - 1])}`;
  d += ` Q${P(add(left[n - 1], scale(tDir, halfW[n - 1] * 0.9)))} ${P(topCap)}`;
  d += ` Q${P(add(right[n - 1], scale(tDir, halfW[n - 1] * 0.9)))} ${P(right[n - 1])}`;
  for (let i = n - 2; i >= 0; i--) {
    const m = vlerp(right[i + 1], right[i], 0.5);
    d += ` Q${P(right[i + 1])} ${P(m)}`;
  }
  d += ` L${P(right[0])}`;
  d += ` Q${P(add(right[0], scale(bDir, halfW[0] * 0.6)))} ${P(botCap)}`;
  d += ` Q${P(add(left[0], scale(bDir, halfW[0] * 0.6)))} ${P(left[0])} Z`;
  return d;
};

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [ar, ag, ab] = ch(pa);
  const [br, bg, bb] = ch(pb);
  const c = (x: number, y: number) => Math.round(lerp(x, y, t)).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
};

// ---------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------
const Limb: React.FC<{ pts: Vec2[]; w: number; color: string; ink: string; outline: number }> = ({
  pts,
  w,
  color,
  ink,
  outline,
}) => (
  <>
    <path d={poly(pts)} stroke={ink} strokeWidth={w + outline * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={poly(pts)} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const Hand: React.FC<{
  wrist: Vec2;
  angle: number;
  s: CharacterSpec;
  open: number;
  point: number;
  skin: string;
}> = ({ wrist, angle, s, open, point, skin }) => {
  const d = dir(angle);
  const c = add(wrist, scale(d, s.handR * 0.75));
  const ink = s.colors.ink;
  const o = s.outline * 0.8;
  const rot = deg(-angle);
  if (point > 0.5) {
    const tip = add(c, scale(d, s.handR * 1.9));
    return (
      <g>
        <path d={poly([c, tip])} stroke={ink} strokeWidth={s.handR * 0.62 + o * 2} strokeLinecap="round" />
        <path d={poly([c, tip])} stroke={skin} strokeWidth={s.handR * 0.62} strokeLinecap="round" />
        <circle cx={c.x} cy={c.y} r={s.handR * 0.95} fill={skin} stroke={ink} strokeWidth={o} />
      </g>
    );
  }
  const k = clamp(open, 0, 1);
  const rx = s.handR * lerp(0.95, 1.15, k);
  const ry = s.handR * lerp(0.95, 1.3, k);
  const thumb = add(c, rotate(v(s.handR * 0.9, -s.handR * 0.2), -angle));
  return (
    <g>
      {k > 0.35 && <circle cx={thumb.x} cy={thumb.y} r={s.handR * 0.45} fill={skin} stroke={ink} strokeWidth={o} />}
      <ellipse cx={c.x} cy={c.y} rx={rx} ry={ry} transform={`rotate(${rot} ${c.x} ${c.y})`} fill={skin} stroke={ink} strokeWidth={o} />
    </g>
  );
};

const Shoe: React.FC<{ ankle: Vec2; angle: number; s: CharacterSpec; shade: number }> = ({ ankle, angle, s, shade }) => {
  const fl = s.footLen;
  const h = s.ankleH;
  const d = [
    `M${-0.34 * fl} ${h + 3}`,
    `L${0.6 * fl} ${h + 3}`,
    `Q${0.8 * fl} ${h + 3} ${0.77 * fl} ${h - 7}`,
    `Q${0.72 * fl} ${-6} ${0.22 * fl} ${-7}`,
    `L${-0.22 * fl} ${-9}`,
    `Q${-0.38 * fl} ${-7} ${-0.36 * fl} ${h}`,
    "Z",
  ].join(" ");
  const shoe = mix(s.colors.shoe, s.colors.ink, shade);
  return (
    <g transform={`translate(${r2(ankle.x)} ${r2(ankle.y)}) rotate(${r2(deg(angle))})`}>
      <path d={d} fill={shoe} stroke={s.colors.ink} strokeWidth={s.outline} strokeLinejoin="round" />
      <path d={`M${-0.3 * fl} ${h + 1} L${0.62 * fl} ${h + 1}`} stroke={s.colors.shoeSole} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
};

/**
 * Smear frame for a fast arm: the swept area of the forearm over the last
 * ~1-1.5 frames, filled in the sleeve colour, plus tapered speed lines from
 * the hand. Drawn behind the arm, in the character's local space.
 */
const ArmSmear: React.FC<{ sm: LimbSmear; toLocal: (p: Vec2) => Vec2; color: string; skin: string; ink: string; w: number }> = ({
  sm,
  toLocal,
  color,
  skin,
  ink,
  w,
}) => {
  const W = sm.wrists.map(toLocal);
  const E = sm.elbows.map(toLocal);
  const n = W.length;
  const sweep = [...W, ...E.slice().reverse()];
  // tapered hand trail: wide at the hand, thin at the oldest sample
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = W[Math.max(0, i - 1)];
    const b = W[Math.min(n - 1, i + 1)];
    const nn = perp(norm(sub(b, a)));
    const hw = w * 0.75 * (1 - i / (n - 1)) + 1;
    left.push(add(W[i], scale(nn, hw)));
    right.push(sub(W[i], scale(nn, hw)));
  }
  const trail = [...left, ...right.reverse()];
  const lineOff = [-0.55, 0, 0.55];
  return (
    <g opacity={r2(sm.k)}>
      <path d={`${poly(sweep)} Z`} fill={color} opacity={0.55} />
      <path d={`${poly(trail)} Z`} fill={skin} opacity={0.7} />
      {lineOff.map((o, i) => {
        const nn = perp(norm(sub(W[0], W[n - 1])));
        const a = add(W[n - 1], scale(nn, o * w));
        const b = add(vlerp(W[n - 1], W[0], 0.7), scale(nn, o * w * 0.8));
        return <path key={i} d={poly([a, b])} stroke={ink} strokeWidth={3} strokeLinecap="round" opacity={0.45} />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------
const Eye: React.FC<{
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  pose: Pose;
  pupilDX: number;
  ink: string;
  skin: string;
}> = ({ id, cx, cy, rx, ry, pose, pupilDX, ink, skin }) => {
  const top = clamp(Math.max(pose.blink, pose.lidTop * 0.55), 0, 1);
  const bottom = clamp(pose.squint * 0.6, 0, 1);
  const yTop = cy - ry + 2 * ry * top;
  const yBot = cy + ry - 2 * ry * bottom;
  const visible = yBot - yTop;
  const lw = Math.max(3.5, rx * 0.28);
  if (visible < ry * 0.22) {
    // closed: happy arc when squinting, soft lid line when blinking
    const yy = (yTop + yBot) / 2;
    const bend = pose.squint > 0.5 && pose.blink < 0.5 ? -ry * 0.55 : ry * 0.35;
    return (
      <path
        d={`M${r2(cx - rx)} ${r2(yy)} Q${r2(cx)} ${r2(yy + bend)} ${r2(cx + rx)} ${r2(yy)}`}
        stroke={ink}
        strokeWidth={lw}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  const pr = rx * 0.55 * pose.pupil;
  const px = cx + clamp(pose.eyeX * rx * 0.48 + pupilDX, -rx + pr * 0.6, rx - pr * 0.6);
  const py = cy + clamp(pose.eyeY * ry * 0.45, -ry + pr * 0.6, ry - pr * 0.6);
  return (
    <g>
      <defs>
        <clipPath id={`${id}-c`}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
        <clipPath id={`${id}-v`}>
          <rect x={cx - rx - 8} y={yTop} width={rx * 2 + 16} height={Math.max(0, visible)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-v)`}>
        <g clipPath={`url(#${id}-c)`}>
          <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} fill="#ffffff" />
          <circle cx={px} cy={py} r={pr} fill={ink} />
          <circle cx={px + pr * 0.35} cy={py - pr * 0.4} r={pr * 0.32} fill="#ffffff" />
        </g>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={ink} strokeWidth={lw * 0.8} />
      </g>
      {top > 0.02 && (
        <path d={`M${r2(cx - rx - 2)} ${r2(yTop)} Q${r2(cx)} ${r2(yTop + 3)} ${r2(cx + rx + 2)} ${r2(yTop)}`} stroke={ink} strokeWidth={lw} fill={skin} strokeLinecap="round" />
      )}
      {bottom > 0.02 && (
        <path d={`M${r2(cx - rx)} ${r2(yBot)} Q${r2(cx)} ${r2(yBot - 4)} ${r2(cx + rx)} ${r2(yBot)}`} stroke={ink} strokeWidth={lw * 0.8} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};

const Mouth: React.FC<{ x: number; y: number; R: number; pose: Pose; ink: string }> = ({ x, y, R, pose, ink }) => {
  const round = clamp(pose.mouthRound, 0, 1);
  const w = R * 0.4 * pose.mouthW * lerp(1, 0.55, round);
  const o = R * 0.36 * clamp(pose.mouthOpen, 0, 1.2);
  const s = R * 0.13 * pose.smile * (1 - round * 0.8);
  const cy = y - s * 0.6;
  const L = v(x - w / 2, cy);
  const Rt = v(x + w / 2, cy);
  if (o < 2.5) {
    return (
      <path
        d={`M${P(L)} Q${r2(x)} ${r2(cy + s * 2.2 + o)} ${P(Rt)}`}
        stroke={ink}
        strokeWidth={Math.max(4, R * 0.075)}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  const topY = cy - o * (0.15 + 0.55 * round) + s * 0.4;
  const botY = cy + o * (0.9 + 0.3 * round) + s * 1.6;
  const d = `M${P(L)} Q${r2(x)} ${r2(2 * topY - cy)} ${P(Rt)} Q${r2(x)} ${r2(2 * botY - cy)} ${P(L)} Z`;
  const id = `m${Math.round(x * 10)}${Math.round(y * 10)}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill="#5b1f33" />
      <g clipPath={`url(#${id})`}>
        <ellipse cx={x} cy={botY + o * 0.15} rx={w * 0.38} ry={o * 0.45} fill="#ff7a8a" />
        {pose.teeth > 0.05 && <rect x={x - w} y={topY - 4} width={w * 2} height={o * 0.42 * pose.teeth + 4} fill="#ffffff" />}
      </g>
      <path d={d} fill="none" stroke={ink} strokeWidth={Math.max(4, R * 0.07)} strokeLinejoin="round" />
    </g>
  );
};

const Face: React.FC<{ s: CharacterSpec; pose: Pose; id: string }> = ({ s, pose, id }) => {
  const R = s.headR;
  const ft = clamp(pose.faceTurn, -0.7, 1);
  const fx = R * 0.42 * ft;
  const sep = R * 0.6 * (1 - 0.42 * Math.abs(ft));
  const eyeY = -R * 0.06;
  const baseRx = R * 0.21 * pose.eyeScale;
  const baseRy = R * 0.275 * pose.eyeScale;
  const nearX = fx + sep / 2;
  const farX = fx - sep / 2;
  const farScale = 1 - 0.2 * Math.max(0, ft);
  const ink = s.colors.ink;
  const browY = eyeY - R * 0.36 - pose.browY * R * 0.12;
  const browL = R * 0.26;
  const brow = (x: number, side: 1 | -1, sc: number) => {
    // side: +1 near (toward facing), -1 far. Inner end is the one toward the face centre.
    const asym = pose.browAsym * R * 0.08 * side;
    const tiltInner = pose.browTilt * R * 0.09;
    const xi = x - (side * browL * sc) / 2;
    const xo = x + (side * browL * sc) / 2;
    const yi = browY - tiltInner - asym;
    const yo = browY + tiltInner * 0.3 - asym;
    return (
      <path
        key={side}
        d={`M${r2(xi)} ${r2(yi)} Q${r2(x)} ${r2((yi + yo) / 2 - R * 0.05)} ${r2(xo)} ${r2(yo)}`}
        stroke={ink}
        strokeWidth={R * 0.085}
        strokeLinecap="round"
        fill="none"
      />
    );
  };
  return (
    <g>
      {/* blush */}
      <ellipse cx={nearX + R * 0.12} cy={R * 0.24} rx={R * 0.16} ry={R * 0.09} fill={s.colors.cheek} opacity={clamp(pose.cheek, 0, 1) * 0.7} />
      {ft < 0.75 && (
        <ellipse cx={farX - R * 0.1} cy={R * 0.24} rx={R * 0.13 * farScale} ry={R * 0.08} fill={s.colors.cheek} opacity={clamp(pose.cheek, 0, 1) * 0.6} />
      )}
      <Eye id={`${id}-ef`} cx={farX} cy={eyeY} rx={baseRx * farScale} ry={baseRy * farScale} pose={pose} pupilDX={pose.crossEye * baseRx * 0.45} ink={ink} skin={s.colors.skin} />
      <Eye id={`${id}-en`} cx={nearX} cy={eyeY} rx={baseRx} ry={baseRy} pose={pose} pupilDX={-pose.crossEye * baseRx * 0.45} ink={ink} skin={s.colors.skin} />
      {brow(farX, -1, farScale)}
      {brow(nearX, 1, 1)}
      <Mouth x={fx * 1.12 + pose.mouthX * R * 0.25} y={R * 0.42} R={R} pose={pose} ink={ink} />
      {pose.sweat > 0.05 && (
        <path
          transform={`translate(${r2(-R * 0.62 - fx * 0.3)} ${r2(-R * 0.25 + (1 - pose.sweat) * -10)}) scale(${r2(pose.sweat)})`}
          d="M0 -18 Q9 -2 9 6 A9 9 0 0 1 -9 6 Q-9 -2 0 -18 Z"
          fill="#8fd3ff"
          stroke={ink}
          strokeWidth={3}
        />
      )}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Hair
// ---------------------------------------------------------------------------
const Hair: React.FC<{ s: CharacterSpec; pose: Pose; front: boolean }> = ({ s, pose, front }) => {
  const R = s.headR;
  const ink = s.colors.ink;
  if (s.hair === "tuft") {
    if (!front) return null;
    const L = 46 * pose.hairStretch;
    const a = deg(pose.hairSwing - 0.15);
    return (
      <g transform={`translate(${r2(R * 0.05)} ${r2(-R * 0.96)}) rotate(${r2(a)})`}>
        <path
          d={`M0 4 C 4 ${-L * 0.35} ${-10} ${-L * 0.6} ${-2} ${-L * 0.9} C ${6} ${-L * 1.15} ${20} ${-L * 0.95} ${13} ${-L * 0.72} C ${8} ${-L * 0.6} ${2} ${-L * 0.75} ${6} ${-L * 0.85}`}
          stroke={ink}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  // quiff: hair cap behind + a floppy swoop in front
  const hair = s.colors.hair;
  const ft = clamp(pose.faceTurn, -0.7, 1);
  if (!front) {
    return (
      <path
        d={`M${-R * 1.02} ${-R * 0.05} A${R * 1.02} ${R * 1.02} 0 0 1 ${R * 0.98} ${-R * 0.25} Q${R * 0.2} ${-R * 0.55} ${-R * 1.02} ${-R * 0.05} Z`}
        transform={`translate(${-ft * R * 0.12} 0)`}
        fill={hair}
        stroke={ink}
        strokeWidth={s.outline}
        strokeLinejoin="round"
      />
    );
  }
  const L = 40 * pose.hairStretch;
  const a = deg(pose.hairSwing * 0.8);
  return (
    <g transform={`translate(${r2(R * 0.25 + ft * R * 0.2)} ${r2(-R * 0.86)}) rotate(${r2(a)})`}>
      <path
        d={`M${-R * 0.55} 6 Q${-R * 0.2} ${-L * 0.9} ${R * 0.35} ${-L * 0.75} Q${R * 0.75} ${-L * 0.55} ${R * 0.62} ${L * 0.05} Q${R * 0.45} ${-L * 0.35} ${R * 0.1} ${-L * 0.25} Q${-R * 0.2} ${-L * 0.15} ${-R * 0.25} 12 Z`}
        fill={hair}
        stroke={ink}
        strokeWidth={s.outline}
        strokeLinejoin="round"
      />
    </g>
  );
};

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------
export interface CharacterViewProps {
  s: CharacterSpec;
  pose: Pose;
  joints: Joints;
  /** Light tint over the whole character (e.g. warm glow). 0..1 */
  glow?: number;
  glowColor?: string;
  /** Render the head hidden (e.g. covered by a box). */
  hideHead?: boolean;
  /** Motion smears for fast arms (world space, from limbSmears()). */
  smears?: Partial<Record<"F" | "B", LimbSmear>>;
}

export const CharacterView: React.FC<CharacterViewProps> = ({ s, pose, joints, glow = 0, glowColor = "#ffd27a", hideHead, smears }) => {
  const L = joints.local;
  const c = s.colors;
  const ink = c.ink;
  const o = s.outline;
  const sx = facingScale(pose.facing);
  const sq = pose.squash;
  const wsq = 1 / Math.sqrt(sq);

  // Arms are split into sleeve (shoulder->elbow->60% forearm) and bare wrist.
  const armParts = (sh: Vec2, el: Vec2, wr: Vec2) => {
    const cuff = vlerp(el, wr, 0.62);
    return { sleeve: [sh, el, cuff], wrist: [cuff, wr] };
  };
  const aF = armParts(L.shoulderF, L.elbowF, L.wristF);
  const aB = armParts(L.shoulderB, L.elbowB, L.wristB);

  // Hands near the face are drawn in front of the head; a far hand at the
  // back of the head (scratching, rubbing a bump) stays behind it.
  const headR = s.headR;
  const nearFace = (w: Vec2) => Math.hypot(w.x - L.headC.x, w.y - L.headC.y) < headR * 1.25 && w.x > L.headC.x - headR * 0.25;
  const farArmFront = nearFace(L.wristB);

  const farSkin = mix(c.skin, ink, 0.12);
  const farArm = (
    <g key="farArm">
      {smears?.B && <ArmSmear sm={smears.B} toLocal={joints.toLocal} color={c.shirtShade} skin={farSkin} ink={ink} w={s.limbW} />}
      <Limb pts={aB.sleeve} w={s.limbW} color={c.shirtShade} ink={ink} outline={o} />
      <Limb pts={aB.wrist} w={s.limbW * 0.72} color={farSkin} ink={ink} outline={o} />
      <Hand wrist={L.wristB} angle={L.handAngleB} s={s} open={pose.hBopen} point={pose.hBpoint} skin={farSkin} />
    </g>
  );
  const nearArm = (
    <g key="nearArm">
      {smears?.F && <ArmSmear sm={smears.F} toLocal={joints.toLocal} color={c.shirt} skin={c.skin} ink={ink} w={s.limbW} />}
      <Limb pts={aF.sleeve} w={s.limbW} color={c.shirt} ink={ink} outline={o} />
      <Limb pts={aF.wrist} w={s.limbW * 0.72} color={c.skin} ink={ink} outline={o} />
      <path d={poly([vlerp(L.elbowF, L.wristF, 0.56), vlerp(L.elbowF, L.wristF, 0.62)])} stroke={c.shirtShade} strokeWidth={s.limbW + 2} strokeLinecap="butt" />
      <Hand wrist={L.wristF} angle={L.handAngleF} s={s} open={pose.hFopen} point={pose.hFpoint} skin={c.skin} />
    </g>
  );

  // Torso
  const spine = [L.pelvis, L.spineMid, L.chest];
  const belly = s.torsoBotW > s.torsoTopW + 8 ? 1.1 : 1.04;
  const halfW = [s.torsoBotW * 0.5 * wsq, ((s.torsoBotW + s.torsoTopW) / 4) * belly * wsq, s.torsoTopW * 0.47 * wsq];
  const torsoD = capsulePath(spine, halfW);
  const torsoClip = `${s.id}-torso`;
  const backOff = (p: Vec2, w: number) => {
    const n = perp(norm(sub(L.chest, L.pelvis)));
    return sub(p, scale(n, w * 0.78));
  };

  // Head transform: local head frame rotated by head angle; squash as ellipse.
  // counter-scale keeps the head round while the body narrows during a turn
  const headT = `translate(${r2(L.headC.x)} ${r2(L.headC.y)}) scale(${r2(1 / Math.abs(sx))} 1) rotate(${r2(deg(L.headAngle))})`;
  const hry = headR * (1 + (sq - 1) * 0.6);
  const hrx = headR * (1 - (sq - 1) * 0.35);
  const ft = clamp(pose.faceTurn, -0.7, 1);
  const puff = clamp(pose.puff, 0, 1);
  const cheekC = v(headR * 0.42 * ft + headR * 0.42, headR * 0.3);
  const earC = v(-ft * headR * 0.42, headR * 0.06);

  const head = hideHead ? null : (
    <g key="head" transform={headT}>
      <Hair s={s} pose={pose} front={false} />
      {/* merged silhouette: strokes first, then fills */}
      <ellipse cx={0} cy={0} rx={hrx} ry={hry} fill="none" stroke={ink} strokeWidth={o * 2} />
      {puff > 0.05 && <circle cx={cheekC.x} cy={cheekC.y} r={headR * 0.3 * puff} fill="none" stroke={ink} strokeWidth={o * 2} />}
      <ellipse cx={0} cy={0} rx={hrx} ry={hry} fill={c.skin} />
      {puff > 0.05 && <circle cx={cheekC.x} cy={cheekC.y} r={headR * 0.3 * puff} fill={c.skin} />}
      {/* soft shading on the back of the head */}
      <path
        d={`M${r2(-hrx * 0.2)} ${r2(hry)} A${r2(hrx)} ${r2(hry)} 0 0 1 ${r2(-hrx * 0.62)} ${r2(-hry * 0.78)} A${r2(hrx * 1.1)} ${r2(hry * 1.1)} 0 0 0 ${r2(-hrx * 0.2)} ${r2(hry)} Z`}
        fill={ink}
        opacity={0.07}
        transform={`translate(${-ft * 4} 0)`}
      />
      {Math.abs(ft) > 0.2 && (
        <g>
          <ellipse cx={earC.x} cy={earC.y} rx={headR * 0.13} ry={headR * 0.17} fill={c.skin} stroke={ink} strokeWidth={o * 0.8} />
          <path d={`M${r2(earC.x - 2)} ${r2(earC.y - 6)} Q${r2(earC.x + 4)} ${r2(earC.y)} ${r2(earC.x - 2)} ${r2(earC.y + 6)}`} stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      )}
      <Face s={s} pose={pose} id={`${s.id}-face`} />
      <Hair s={s} pose={pose} front />
    </g>
  );

  const pocket = (() => {
    const a = vlerp(L.pelvis, L.spineMid, 0.25);
    const b = vlerp(L.pelvis, L.spineMid, 0.85);
    const n = perp(norm(sub(L.chest, L.pelvis)));
    const w = s.torsoBotW * 0.32;
    const p1 = add(a, scale(n, w * 1.25));
    const p2 = add(b, scale(n, w * 1.05));
    const p3 = add(b, scale(n, -w * 0.15));
    const p4 = add(a, scale(n, -w * 0.25));
    return `M${P(p1)} L${P(p2)} L${P(p3)} L${P(p4)} Z`;
  })();

  return (
    <g transform={`translate(${r2(pose.x)} ${r2(pose.y)}) scale(${r2(sx)} 1) rotate(${r2(deg(pose.bodyRot))})`}>
      {!farArmFront && farArm}
      {/* far leg */}
      <Limb pts={[L.hipB, L.kneeB, L.ankleB]} w={s.legW} color={c.pantsShade} ink={ink} outline={o} />
      <Shoe ankle={L.ankleB} angle={L.footAngleB} s={s} shade={0.12} />
      {/* near leg */}
      <Limb pts={[L.hipF, L.kneeF, L.ankleF]} w={s.legW} color={c.pants} ink={ink} outline={o} />
      <Shoe ankle={L.ankleF} angle={L.footAngleF} s={s} shade={0} />
      {/* neck */}
      <Limb pts={[L.chest, L.neckTop]} w={s.limbW * 0.9} color={c.skin} ink={ink} outline={o} />
      {/* torso */}
      <defs>
        <clipPath id={torsoClip}>
          <path d={torsoD} />
        </clipPath>
      </defs>
      <path d={torsoD} fill={c.shirt} stroke={ink} strokeWidth={o * 2} paintOrder="stroke" strokeLinejoin="round" />
      <g clipPath={`url(#${torsoClip})`}>
        <path
          d={poly([backOff(L.pelvis, halfW[0]), backOff(L.spineMid, halfW[1]), backOff(L.chest, halfW[2])])}
          stroke={c.shirtShade}
          strokeWidth={halfW[1] * 0.7}
          fill="none"
          strokeLinecap="round"
        />
        {s.hair === "tuft" ? (
          <>
            <path d={pocket} fill={c.shirtShade} stroke={ink} strokeWidth={3} opacity={0.9} />
            <path d={poly([add(L.chest, v(8, -2)), add(L.chest, v(12, 34))])} stroke={c.accent} strokeWidth={4} strokeLinecap="round" />
            <path d={poly([add(L.chest, v(20, -2)), add(L.chest, v(25, 30))])} stroke={c.accent} strokeWidth={4} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d={poly([vlerp(L.spineMid, L.chest, 0.15), vlerp(L.spineMid, L.chest, 0.15)].map((p, i) => add(p, v(i ? 80 : -80, 0))))} stroke={c.accent} strokeWidth={16} transform="" />
            <path d={poly([vlerp(L.pelvis, L.spineMid, 0.1), vlerp(L.pelvis, L.spineMid, 0.1)].map((p, i) => add(p, v(i ? 80 : -80, 0))))} stroke={c.shirtShade} strokeWidth={12} />
          </>
        )}
      </g>
      {/* glow tint (lit by the gift) */}
      {glow > 0.01 && <path d={torsoD} fill={glowColor} opacity={glow * 0.35} />}
      {head}
      {glow > 0.01 && !hideHead && (
        <ellipse cx={L.headC.x} cy={L.headC.y} rx={hrx} ry={hry} fill={glowColor} opacity={glow * 0.28} />
      )}
      {farArmFront && farArm}
      {nearArm}
    </g>
  );
};

/** Floor contact shadow (world space, drawn before characters). */
export const CharacterShadow: React.FC<{ pose: Pose; joints: Joints; floorY: number; s: CharacterSpec }> = ({ pose, joints, floorY, s }) => {
  const h = Math.max(0, floorY - Math.max(joints.ankleF.y, joints.ankleB.y) - s.ankleH);
  const k = clamp(1 - h / 260, 0.35, 1);
  const cx = (joints.ankleF.x + joints.ankleB.x) / 2;
  const w = (Math.abs(joints.ankleF.x - joints.ankleB.x) / 2 + s.torsoBotW * 0.8) * k;
  return <ellipse cx={cx} cy={floorY + 4} rx={w} ry={11 * k} fill="#2a2238" opacity={0.18 * k * (pose.bodyRot !== 0 ? 1 : 1)} />;
};

export { up };
