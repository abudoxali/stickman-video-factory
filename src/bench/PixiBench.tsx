import { Application, Container, Graphics } from "pixi.js";
import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { evaluateCamera } from "../engine/camera";
import { add, scale, sub, v, type Vec2 } from "../engine/math";
import { evaluateScene } from "../engine/runtime";
import type { SceneDef } from "../engine/scene";
import { theSurprise } from "../scenes/theSurprise";

/**
 * Renderer benchmark: draws THE SURPRISE's characters through PixiJS v8
 * (WebGL) from exactly the same engine output the SVG renderer uses. Kept
 * deliberately simple (silhouette-level drawing) — it measures the renderer
 * path (init, per-frame redraw, determinism, AA quality), not art direction.
 */
const hex = (c: string) => parseInt(c.slice(1), 16);
const perp = (d: Vec2) => v(-d.y, d.x);
const norm = (d: Vec2) => {
  const l = Math.hypot(d.x, d.y) || 1;
  return v(d.x / l, d.y / l);
};

const drawScene = (g: Graphics, world: Container, def: SceneDef, frame: number) => {
  const cam = evaluateCamera(def, frame);
  world.position.set(def.width / 2, def.height / 2);
  world.scale.set(cam.zoom);
  world.rotation = cam.rot;
  world.pivot.set(cam.x, cam.y);
  g.clear();
  g.rect(-600, -400, 2400, 1880).fill(0xf7e6cc);
  g.rect(-600, 1474, 2400, 900).fill(0xc98b5a);
  g.moveTo(-600, 1474).lineTo(1800, 1474).stroke({ width: 4, color: 0x2a2238 });
  const sf = evaluateScene(def, frame);
  for (const tr of def.characters) {
    if (tr.hidden?.some(([a, b]) => frame >= a && frame < b)) continue;
    const { joints: j, spec: s } = sf.characters[tr.id];
    const ink = hex(s.colors.ink);
    const limb = (pts: Vec2[], w: number, color: number) => {
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ width: w + s.outline * 2, color: ink, cap: "round", join: "round" });
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ width: w, color, cap: "round", join: "round" });
    };
    limb([j.shoulderB, j.elbowB, j.wristB], s.limbW, hex(s.colors.shirtShade));
    limb([j.hipB, j.kneeB, j.ankleB], s.legW, hex(s.colors.pantsShade));
    limb([j.hipF, j.kneeF, j.ankleF], s.legW, hex(s.colors.pants));
    // torso quad from spine
    const n = perp(norm(sub(j.chest, j.pelvis)));
    const a = add(j.pelvis, scale(n, s.torsoBotW / 2));
    const b = add(j.chest, scale(n, s.torsoTopW / 2));
    const c = sub(j.chest, scale(n, s.torsoTopW / 2));
    const d = sub(j.pelvis, scale(n, s.torsoBotW / 2));
    g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill(hex(s.colors.shirt)).stroke({ width: s.outline, color: ink, join: "round" });
    g.circle(j.headC.x, j.headC.y, s.headR).fill(hex(s.colors.skin)).stroke({ width: s.outline, color: ink });
    const sgn = sf.characters[tr.id].pose.facing >= 0 ? 1 : -1;
    g.circle(j.headC.x + sgn * 10, j.headC.y - 4, 7).fill(ink);
    g.circle(j.headC.x + sgn * 34, j.headC.y - 4, 7).fill(ink);
    limb([j.shoulderF, j.elbowF, j.wristF], s.limbW, hex(s.colors.shirt));
    g.circle(j.wristF.x, j.wristF.y, s.handR).fill(hex(s.colors.skin)).stroke({ width: 4, color: ink });
  }
};

export const PixiBench: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<{ app: Application; g: Graphics; world: Container } | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    app
      .init({
        canvas: canvasRef.current!,
        width: theSurprise.width,
        height: theSurprise.height,
        antialias: true,
        autoStart: false, // Remotion drives frames; no ticker
        preference: "webgl",
        preserveDrawingBuffer: true, // canvas must still hold the frame at screenshot time
        background: 0x2a2238,
      })
      .then(() => {
        if (cancelled) return;
        app.ticker.stop();
        const world = new Container();
        const g = new Graphics();
        world.addChild(g);
        app.stage.addChild(world);
        appRef.current = { app, g, world };
        setReady(true);
        continueRender(initHandle);
      });
    return () => {
      cancelled = true;
    };
  }, [initHandle]);

  useEffect(() => {
    if (!ready || !appRef.current) return;
    const h = delayRender(`PixiJS frame ${frame}`);
    const { app, g, world } = appRef.current;
    drawScene(g, world, theSurprise, frame);
    app.render(); // synchronous draw for this exact frame
    continueRender(h);
  }, [frame, ready]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={theSurprise.width} height={theSurprise.height} />
    </AbsoluteFill>
  );
};
