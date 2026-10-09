// Render selected frames of a composition to PNG with a single bundle.
// Usage: node scripts/stills.mjs <compositionId> <outDir> <scale> <frame> [<frame>...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [id, outDir, scaleArg, ...frames] = process.argv.slice(2);
if (!id || !outDir || frames.length === 0) {
  console.error("usage: node scripts/stills.mjs <compositionId> <outDir> <scale> <frame>...");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `${id}-${String(f).padStart(4, "0")}.png`);
  await renderStill({ composition, serveUrl, frame: f, output, scale: Number(scaleArg) || 1 });
  console.log(output);
}
