// Start the official Blender Lab MCP bridge headless (localhost:9876) on a
// blend file, so the Blender MCP tools (get_objects_summary,
// execute_blender_code, ...) can read and edit it from Claude Code.
//
// One-time setup (done on the studio machine, see STATUS.md):
//   blender -b --online-mode -c extension repo-add blender_lab --url https://lab.blender.org/
//   blender -b --online-mode -c extension sync
//   blender -b --online-mode -c extension install blender_lab.mcp --enable
// The bridge binds localhost only; never expose the port.
//
// Usage: node scripts/blender-mcp.mjs [file.blend=out/blender/clip_lab.blend]
import { spawn } from "node:child_process";
import fs from "node:fs";

const file = process.argv[2] ?? "out/blender/clip_lab.blend";
const candidates = [
  process.env.BLENDER_BIN,
  process.env.BLENDER_PATH,
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].filter(Boolean);
const blender = candidates.find((c) => c === "blender" || fs.existsSync(c));
if (!fs.existsSync(file)) {
  console.error(`blend file not found: ${file} (run npm run blender:render or blender:clip:rebuild first)`);
  process.exit(1);
}
// --online-mode: the add-on refuses to open its socket while Blender is in offline mode.
const child = spawn(blender, ["-b", file, "--online-mode", "-c", "blender_mcp"], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
