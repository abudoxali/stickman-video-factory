import type { Clip } from "./clips";
import { clamp, lerp, wrapAngle } from "./math";
import { standHipHeight } from "./rig";
import type { PartialPose } from "./types";

/**
 * Keyed clips: motion authored in an external DCC (Blender, see
 * blender/clips/*.py) and baked per frame to JSON by blender/clips/export_clip.py.
 *
 * The data is rig-agnostic: arms are world bone angles + relative elbow bends
 * (engine convention 0 = down, + = forward), the spine/root are deltas, so the
 * same file plays on any CharacterSpec (Pip, Bo, ...) without retouching.
 * Wrapped as a normal override Clip it layers, blends (hand-space arm blends,
 * envelopes) and mixes with locomotion exactly like hand-written clips.
 */
export interface KeyedClipData {
  id: string;
  source: string;
  authoredWith?: string;
  fps: number;
  frames: number;
  /** Channels added to the current pose instead of replacing it. */
  additive: string[];
  channels: Record<string, number[]>;
}

const ARM_SWAP: Record<string, string> = {
  aFsh: "aBsh",
  aFel: "aBel",
  aBsh: "aFsh",
  aBel: "aFel",
  hFopen: "hBopen",
  hBopen: "hFopen",
};

const sample = (arr: number[], x: number) => {
  const n = arr.length;
  const i = clamp(Math.floor(x), 0, n - 1);
  const u = clamp(x - i, 0, 1);
  return lerp(arr[i], arr[Math.min(i + 1, n - 1)], u);
};

/** Fractional source frame for clip time `t` (scene frames at 30 fps). */
export const keyedTime = (d: KeyedClipData, t: number, dur: number, params: Record<string, unknown>) => {
  if (params.fit) return (clamp(t / Math.max(1, dur), 0, 1)) * (d.frames - 1);
  const x = t * Number(params.speed ?? 1) * (d.fps / 30);
  return params.loop && d.frames > 1 ? x % (d.frames - 1) : Math.min(x, Math.max(0, d.frames - 1));
};

export const keyedClip = (d: KeyedClipData): Clip => ({
  kind: "override",
  description: `Keyed clip "${d.id}" (${d.frames} f, authored in ${d.authoredWith ?? d.source}). params: speed (rate), fit (stretch to the action length), loop, mirror (swap near/far arm), amount (0..1 scales body deltas).`,
  fn: (c) => {
    const x = keyedTime(d, c.t, c.dur, c.params);
    const mirror = !!c.params.mirror;
    const amount = Number(c.params.amount ?? 1);
    const out: PartialPose = { armGrav: 1 };
    const o = out as Record<string, number>;
    for (const [ch, arr] of Object.entries(d.channels)) {
      const val = sample(arr, x);
      const key = mirror ? (ARM_SWAP[ch] ?? ch) : ch;
      if (!d.additive.includes(ch)) {
        if (ch === "squash") o.squash = c.pose.squash * (1 + (val - 1) * amount);
        else if (key === "aFsh" || key === "aBsh") {
          // Multi-turn windmills are stored unwrapped; FK is 2*pi periodic, so
          // express the angle within half a turn of the underlying pose: blends
          // in/out then take the short way instead of rewinding whole circles.
          const base = (c.pose as unknown as Record<string, number>)[key];
          o[key] = base + wrapAngle(val - base);
        } else o[key] = val;
        continue;
      }
      const d0 = val * amount;
      if (ch === "lean") {
        // the Blender rig has one spine bone: split it over our two spine joints
        o.lean = c.pose.lean + 0.65 * d0;
        o.chest = c.pose.chest + 0.35 * d0;
      } else if (ch === "hipY") o.hipY = c.pose.hipY + d0 * standHipHeight(c.spec);
      else o[ch] = (c.pose as unknown as Record<string, number>)[ch] + d0;
    }
    return out;
  },
});
