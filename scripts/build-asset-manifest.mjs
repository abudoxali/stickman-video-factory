// Scans public/assets/<pack>/asset.json (+ files) and writes the asset
// manifest the engine and tests use: src/assets/manifest.json.
// Sound files named <group>_<NNN>.ogg become one variant group, addressed in
// scenes as "<alias>/<group>" (e.g. "impact/impactPunch_heavy").
// Usage: node scripts/build-asset-manifest.mjs   (run after adding a pack)
import fs from "node:fs";
import path from "node:path";

const ROOT = "public/assets";
const REQUIRED = ["id", "alias", "kind", "author", "source", "license", "licenseUrl", "licenseFile", "retrieved"];
const packs = {};
const sfx = {};
for (const dir of fs.readdirSync(ROOT).sort()) {
  const metaPath = path.join(ROOT, dir, "asset.json");
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  for (const k of REQUIRED) if (!meta[k]) throw new Error(`${metaPath}: missing "${k}"`);
  if (!fs.existsSync(path.join(ROOT, dir, meta.licenseFile))) throw new Error(`${dir}: license file missing`);
  const files = fs.readdirSync(path.join(ROOT, dir)).sort();
  packs[meta.alias] = { ...meta, dir: `assets/${dir}`, fileCount: files.length };
  if (meta.kind === "sfx") {
    for (const f of files) {
      const m = /^(.*)_(\d+)\.(ogg|wav|mp3)$/.exec(f);
      if (!m) continue;
      const key = `${meta.alias}/${m[1]}`;
      (sfx[key] ??= []).push(`assets/${dir}/${f}`);
    }
  }
}
const out = { generatedBy: "scripts/build-asset-manifest.mjs", packs, sfx };
fs.mkdirSync("src/assets", { recursive: true });
fs.writeFileSync("src/assets/manifest.json", JSON.stringify(out, null, 2) + "\n");
console.log(`packs: ${Object.keys(packs).join(", ")}; sfx groups: ${Object.keys(sfx).length}`);
