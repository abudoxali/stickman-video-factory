// Cross-platform launcher for the godot-mcp server (stdio), used by .mcp.json.
// Native Windows cannot spawn `npx` directly as an MCP command, Linux/macOS
// can; this wrapper works everywhere. Version pinned for reproducibility.
// The server only talks to a Godot editor on 127.0.0.1:6550 (add-on in
// godot/cutout-lab/addons/godot_mcp); without an open editor its tools report
// "Not connected" (e.g. in cloud sessions).
import { spawn } from "node:child_process";

const child = spawn("npx", ["-y", "@satelliteoflove/godot-mcp@4.1.11"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
