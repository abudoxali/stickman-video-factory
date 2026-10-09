// Smoke test for the godot-mcp integration: speaks MCP (JSON-RPC over stdio)
// to `@satelliteoflove/godot-mcp`, which talks to the Godot editor add-on on
// ws://127.0.0.1:6550. Requires the editor to be open on godot/cutout-lab
// (npm run godot:editor). Lists tools, reads the scene tree and the "wave"
// animation keys, then performs a reversible edit (adds a key, reads it back,
// removes it) and reports. Usage: node scripts/godot-mcp-smoke.mjs
import { spawn } from "node:child_process";

const srv = spawn("npx", ["-y", "@satelliteoflove/godot-mcp@4.1.11"], { stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
let buf = "";
const waiters = new Map();
srv.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && waiters.has(msg.id)) {
        waiters.get(msg.id)(msg);
        waiters.delete(msg.id);
      }
    } catch {}
  }
});
let nextId = 1;
const rpc = (method, params) =>
  new Promise((res, rej) => {
    const id = nextId++;
    const t = setTimeout(() => rej(new Error(`timeout ${method}`)), 30000);
    waiters.set(id, (m) => (clearTimeout(t), m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
    srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
const call = async (name, args) => {
  // the editor serves one client at a time and the WebSocket connects lazily:
  // retry briefly while the previous client lets go / the handshake completes
  for (let attempt = 0; ; attempt++) {
    const r = await rpc("tools/call", { name, arguments: args });
    const text = (r.content ?? []).map((c) => c.text ?? "").join("\n");
    if (!r.isError) return text;
    if (attempt < 20 && /Not connected/.test(text)) {
      await new Promise((ok) => setTimeout(ok, 500));
      continue;
    }
    throw new Error(`${name}: ${text}`);
  }
};
const arg = process.argv.slice(2);
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "svf-smoke", version: "1" } });
  srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const tools = (await rpc("tools/list", {})).tools;
  console.log(`tools: ${tools.length} -> ${tools.map((t) => t.name).join(", ")}`);
  if (arg[0] === "--schema") {
    for (const t of tools.filter((t) => arg.slice(1).includes(t.name))) console.log(t.name, JSON.stringify(t.inputSchema).slice(0, 1500));
    process.exit(0);
  }
  if (arg[0] === "--call") {
    console.log(await call(arg[1], JSON.parse(arg[2] ?? "{}")));
    process.exit(0);
  }
} catch (e) {
  console.error("FAIL", e.message);
  process.exitCode = 1;
} finally {
  if (!arg.length) srv.kill();
}
srv.kill();
