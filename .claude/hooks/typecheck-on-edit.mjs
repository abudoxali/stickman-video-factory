#!/usr/bin/env node
// PostToolUse hook: after an Edit/Write to a TypeScript file under src/,
// tests/ or scripts/, run the TypeScript typecheck (~5 s). Exit 2 feeds the
// errors back to Claude. Cross-platform (Node only — the previous bash
// version needed python3, which Windows machines usually lack, and silently
// did nothing there). Never installs packages, never renders, never writes.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let file = "";
try {
  file = JSON.parse(input)?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}
const norm = file.replace(/\\/g, "/");
if (!/\/(src|tests|scripts)\/.*\.tsx?$/.test(norm)) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!fs.existsSync(path.join(root, "node_modules"))) process.exit(0);
const r = spawnSync("npx", ["--no-install", "tsc", "--noEmit"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
if (r.status !== 0) {
  process.stderr.write(`TypeScript errors after editing ${file}:\n${(r.stdout + r.stderr).split("\n").slice(0, 30).join("\n")}\n`);
  process.exit(2);
}
process.exit(0);
