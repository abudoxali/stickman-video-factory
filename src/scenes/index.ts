import type { SceneDef } from "../engine/scene";
import { bonk } from "./bonk";
import { motionLibrary } from "./motionLibrary";
import { theSurprise } from "./theSurprise";

/** Every production scene by id (used by QA, probe and benchmark scripts). */
export const SCENES: Record<string, SceneDef> = {
  [theSurprise.id]: theSurprise,
  [motionLibrary.id]: motionLibrary,
  [bonk.id]: bonk,
};
