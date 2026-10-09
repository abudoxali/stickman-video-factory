import { SCENE_CATALOG, type SceneCatalogEntry } from "../src/scenes";

export const resolveScene = (idOrComposition: string): SceneCatalogEntry => {
  const entry = SCENE_CATALOG.find((item) => item.def.id === idOrComposition || item.compositionId === idOrComposition);
  if (!entry) throw new Error(`Unknown scene "${idOrComposition}". Run npm run scene:list.`);
  return entry;
};
