import { spawnSync } from "node:child_process";
import path from "node:path";
import { assertValidScene, validateScene } from "../src/engine/validateScene";
import { SCENE_CATALOG } from "../src/scenes";
import { resolveScene } from "./sceneCommands";
import { createSceneFile } from "./sceneTemplate";

const [command, selector, requestedOutput] = process.argv.slice(2);
const run = (cmd: string, args: string[]) => {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && cmd === "npx",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const outputFor = (entry: ReturnType<typeof resolveScene>, preview = false) =>
  requestedOutput ?? path.join("out", preview ? "qa" : "", `${entry.def.id}${preview ? "-low" : ""}.mp4`);

switch (command) {
  case "list":
    for (const entry of SCENE_CATALOG)
      console.log(`${entry.def.id.padEnd(18)} ${entry.compositionId.padEnd(18)} ${entry.def.width}x${entry.def.height} ${entry.def.fps}fps ${entry.def.durationInFrames}f`);
    break;
  case "validate": {
    const entries = selector ? [resolveScene(selector)] : SCENE_CATALOG;
    let failed = false;
    for (const entry of entries) {
      const result = validateScene(entry.def);
      if (result.ok) console.log(`VALID ${entry.def.id}`);
      else {
        failed = true;
        console.error(`INVALID ${entry.def.id}\n${result.errors.map((error) => `  - ${error}`).join("\n")}`);
      }
    }
    if (failed) process.exit(1);
    break;
  }
  case "new": {
    if (!selector) throw new Error("usage: npm run scene:new -- <kebab-case-id>");
    const file = createSceneFile(selector);
    console.log(`Created ${file}`);
    console.log("Register its import and one SCENE_CATALOG entry in src/scenes/index.ts, then run npm run scene:validate.");
    break;
  }
  case "preview": {
    const entry = resolveScene(selector ?? "");
    assertValidScene(entry.def);
    run("npx", ["remotion", "render", entry.compositionId, outputFor(entry, true), "--scale=0.25"]);
    break;
  }
  case "render": {
    const entry = resolveScene(selector ?? "");
    assertValidScene(entry.def);
    const args = ["scripts/render-final.mjs", entry.compositionId, outputFor(entry), "--fps", String(entry.def.fps)];
    if (!entry.def.audio) args.push("--no-audio");
    run(process.execPath, args);
    break;
  }
  case "verify": {
    const entry = resolveScene(selector ?? "");
    assertValidScene(entry.def);
    const input = requestedOutput ?? path.join("out", `${entry.def.id}.mp4`);
    const report = path.join("out", "qa", `render-report-${entry.def.id}.json`);
    const args = [
      "scripts/verify-render.mjs",
      input,
      "--width", String(entry.def.width),
      "--height", String(entry.def.height),
      "--fps", String(entry.def.fps),
      "--frames", String(entry.def.durationInFrames),
      "--report", report,
    ];
    if (entry.def.audio) args.push("--scene", entry.def.id);
    run(process.execPath, args);
    break;
  }
  case "qa-all":
    for (const entry of SCENE_CATALOG) run("npx", ["tsx", "scripts/qa-motion.ts", entry.def.id]);
    break;
  default:
    console.error("usage: tsx scripts/scene-cli.ts <list|validate|new|preview|render|verify|qa-all> [scene] [output]");
    process.exit(1);
}
