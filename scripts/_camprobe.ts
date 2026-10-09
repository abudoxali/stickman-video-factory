import { evaluateFraming } from "../src/engine/camera";
import { characterBox, toScreen } from "../src/engine/framing";
import { evaluateScene } from "../src/engine/runtime";
import { SCENES } from "../src/scenes";
const def = SCENES[process.argv[2]];
for (const f of process.argv.slice(3).map(Number)) {
  const c = evaluateFraming(def, f);
  const sf = evaluateScene(def, f);
  const parts = [`${f} cam(${c.x.toFixed(0)},${c.y.toFixed(0)} z${c.zoom.toFixed(2)})`];
  for (const id of Object.keys(sf.characters)) {
    const h = toScreen(def, c, characterBox(sf.characters[id], "head"));
    const b = toScreen(def, c, characterBox(sf.characters[id]));
    parts.push(`${id} head x${h.x0.toFixed(0)}..${h.x1.toFixed(0)} y${h.y0.toFixed(0)}..${h.y1.toFixed(0)} body x${b.x0.toFixed(0)}..${b.x1.toFixed(0)}`);
  }
  console.log(parts.join(" | "));
}
