// Prints key world positions of a scene at given frames (authoring aid).
// Usage: npx tsx scripts/probe.ts <frame> [<frame> ...]
import { anchorPoint } from "../src/engine/anchors";
import { evaluateScene, getRuntime } from "../src/engine/runtime";
import { SCENES } from "../src/scenes";

const def = SCENES[process.env.SCENE ?? "the-surprise"];
if (!def) throw new Error(`unknown SCENE ${process.env.SCENE}; one of ${Object.keys(SCENES).join(", ")}`);
const rt = getRuntime(def);
for (const tr of def.characters) for (const w of rt.bakes.get(tr.id)!.warnings) console.log("WARN", w);
const f2 = (p: { x: number; y: number }) => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`;
for (const arg of process.argv.slice(2)) {
  const f = Number(arg);
  const sf = evaluateScene(def, f);
  const parts = [`#${f}`];
  for (const [id, r] of Object.entries(sf.characters)) {
    const a = (k: Parameters<typeof anchorPoint>[3]) => f2(anchorPoint(r.spec, r.pose, r.joints, k));
    parts.push(`${id}: x=${r.pose.x.toFixed(0)} face=${r.pose.facing.toFixed(2)} head=${a("head")} top=${a("headTop")} mouth=${a("mouth")} handF=${a("handF")} hands=${a("hands")}`);
  }
  for (const [id, p] of Object.entries(sf.props)) parts.push(`${id}=${f2(p)} r=${p.rot.toFixed(2)}`);
  console.log(parts.join("\n  "));
}
