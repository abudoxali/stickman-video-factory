import manifest from "../assets/manifest.json";
import { clamp, hash } from "./math";
import { getRuntime } from "./runtime";
import type { SceneDef } from "./scene";

// ---------------------------------------------------------------------------
// Scene sound: authored cues + automatic sounds derived from engine events
// (foot contacts, jump landings, falls). Resolution is a pure function of the
// SceneDef, so Studio preview, the final render and tests all agree, and
// footsteps stay in sync when a walk is re-timed.
// ---------------------------------------------------------------------------

export type SfxId = keyof typeof manifest.sfx;

export interface SfxCue {
  at: number;
  /** "<packAlias>/<group>", e.g. "impact/impactPunch_heavy" (see src/assets/manifest.json). */
  sfx: string;
  volume?: number;
  /** Playback rate (pitch); 1 = original. */
  rate?: number;
  /** Variant index within the group; default picks deterministically from the frame. */
  variant?: number;
  /** Free-form label for QA reports ("bonk", "catch" ...). */
  label?: string;
}

export interface SceneAudioDef {
  cues: SfxCue[];
  /** Auto footsteps from locomotion foot-contact events. */
  footsteps?: { sfx: string; volume?: number; chars?: string[] };
  /** Auto thud on jump landings and fall impacts. */
  landings?: { sfx: string; volume?: number };
}

export interface ResolvedSfx {
  at: number;
  file: string;
  volume: number;
  rate: number;
  source: "cue" | "footstep" | "landing";
  label: string;
}

const SFX = manifest.sfx as Record<string, string[]>;

export const sfxFiles = (id: string): string[] => {
  const files = SFX[id];
  if (!files || files.length === 0) throw new Error(`Unknown sound "${id}" (not in src/assets/manifest.json)`);
  return files;
};

const pick = (id: string, at: number, variant?: number) => {
  const files = sfxFiles(id);
  const i = variant ?? Math.floor(hash(at * 7.31 + id.length) * files.length);
  return files[((i % files.length) + files.length) % files.length];
};

const inRanges = (r: [number, number][] | undefined, f: number) => !!r?.some(([a, b]) => f >= a && f < b);

export const resolveSceneAudio = (def: SceneDef): ResolvedSfx[] => {
  const a = def.audio;
  if (!a) return [];
  const out: ResolvedSfx[] = a.cues.map((c) => ({
    at: c.at,
    file: pick(c.sfx, c.at, c.variant),
    volume: c.volume ?? 1,
    rate: c.rate ?? 1,
    source: "cue" as const,
    label: c.label ?? c.sfx,
  }));
  const rt = getRuntime(def);
  for (const tr of def.characters) {
    const bake = rt.bakes.get(tr.id)!;
    for (const e of bake.events) {
      if (e.frame < 0 || e.frame >= def.durationInFrames || inRanges(tr.hidden, e.frame)) continue;
      const lf = bake.frames[e.frame];
      if (e.kind === "contact" && a.footsteps && (!a.footsteps.chars || a.footsteps.chars.includes(tr.id))) {
        // tiptoe is near-silent, runs are heavier; tiny per-step variation
        const v = (a.footsteps.volume ?? 0.35) * (1 - 0.75 * lf.sneak) * (1 + 0.35 * lf.run) * (0.85 + 0.3 * hash(e.frame + tr.spec.seed));
        out.push({
          at: e.frame,
          file: pick(a.footsteps.sfx, e.frame + tr.spec.seed),
          volume: clamp(v, 0, 1),
          rate: 1,
          source: "footstep",
          label: `${tr.id} step`,
        });
      } else if ((e.kind === "land" || e.kind === "impact") && a.landings) {
        out.push({
          at: e.frame,
          file: pick(a.landings.sfx, e.frame),
          volume: a.landings.volume ?? 0.8,
          rate: 1,
          source: "landing",
          label: `${tr.id} ${e.kind}`,
        });
      }
    }
  }
  return out.sort((x, y) => x.at - y.at || x.file.localeCompare(y.file));
};
