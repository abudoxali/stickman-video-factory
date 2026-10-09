import type { SceneDef } from "../engine/scene";
import { bonk } from "./bonk";
import { factoryExample } from "./factoryExample";
import { motionLibrary } from "./motionLibrary";
import { showOff } from "./showOff";
import { theSurprise } from "./theSurprise";

export interface SceneCatalogEntry {
  compositionId: string;
  def: SceneDef;
  /** MotionLibrary adds human-readable QA labels over the ordinary SceneDef renderer. */
  presentation?: "motion-library";
}

/** Single source of truth for production scene ids, Remotion registrations and CLI tools. */
export const SCENE_CATALOG: SceneCatalogEntry[] = [
  { compositionId: "TheSurprise", def: theSurprise },
  { compositionId: "MotionLibrary", def: motionLibrary, presentation: "motion-library" },
  { compositionId: "Bonk", def: bonk },
  { compositionId: "ShowOff", def: showOff },
  { compositionId: "FactoryExample", def: factoryExample },
];

/** Every production scene by id (used by QA, probe and benchmark scripts). */
export const SCENES: Record<string, SceneDef> = Object.fromEntries(SCENE_CATALOG.map((entry) => [entry.def.id, entry.def]));

export const sceneEntry = (idOrComposition: string) =>
  SCENE_CATALOG.find((entry) => entry.def.id === idOrComposition || entry.compositionId === idOrComposition);
