import React from "react";
import { cameraTransform, evaluateCamera, parallaxTransform } from "../engine/camera";
import { evalParam, evaluateProp, evaluateScene, getRuntime, limbSmears, type SceneFrame } from "../engine/runtime";
import type { FxKey, PropLayer, PropTrack, SceneDef } from "../engine/scene";
import { CharacterShadow, CharacterView } from "./Character";
import { Fx } from "./Fx";
import { INK, PROP_RENDERERS, trailOpacity } from "./Props";
import { ParkBack, ParkFore } from "./Park";
import { Doorway, DoorPanel, ROOM, RoomBack, RoomFore } from "./Room";
import { anchorPoint } from "../engine/anchors";

const DEFAULT_ORDER = ["set:back", "set:doorway", "shadows", "char:*", "props:back", "props:front", "fx", "set:fore"];

const inRanges = (ranges: [number, number][] | undefined, f: number) => !!ranges?.some(([a, b]) => f >= a && f < b);

const propLayerAt = (p: PropTrack, f: number): PropLayer => {
  let layer = p.layer;
  for (const k of p.layerKeys ?? []) if (k.from <= f) layer = k.layer;
  return layer;
};

const PropView: React.FC<{ def: SceneDef; p: PropTrack; sf: SceneFrame; frame: number }> = ({ def, p, sf, frame }) => {
  if (inRanges(p.hidden, frame)) return null;
  const Comp = PROP_RENDERERS[p.kind];
  if (!Comp) return null;
  const pf = sf.props[p.id];
  const sc = p.scale ?? 1;
  const flip = pf.flip ?? 1;
  const body = (x: number, y: number, rot: number, key: string, opacity = 1) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${(rot * 180) / Math.PI}) scale(${sc * flip} ${sc})`} opacity={opacity}>
      <Comp frame={frame} params={pf.params} />
    </g>
  );
  // Onion-skin smear for fast motion (cartoon motion blur), from true past positions.
  const trails: React.ReactNode[] = [];
  const nSmear = p.smear ?? 3;
  const speed = Math.hypot(pf.vx, pf.vy);
  if (nSmear > 0 && speed > 9) {
    const rt = getRuntime(def);
    for (let i = nSmear; i >= 1; i--) {
      const past = evaluateProp(rt, p, frame - i * 0.5, (id) => sf.characters[id]);
      trails.push(body(past.x, past.y, past.rot, `t${i}`, trailOpacity(i - 1, nSmear)));
    }
  }
  return (
    <g>
      {trails}
      {body(pf.x, pf.y, pf.rot, "main")}
    </g>
  );
};

export const SceneView: React.FC<{ def: SceneDef; frame: number; debug?: boolean }> = ({ def, frame, debug }) => {
  const sf = evaluateScene(def, frame);
  const cam = evaluateCamera(def, frame);
  const rt = getRuntime(def);
  const order = def.drawOrder ?? DEFAULT_ORDER;
  const setP = (k: string, d = 0) => evalParam(def.set[k], frame, d);
  const door = setP("door");
  const stage = def.stage ?? "room";

  // Auto FX from locomotion events
  const autoFx: FxKey[] = [];
  if (def.autoDust) {
    for (const tr of def.characters) {
      for (const e of rt.bakes.get(tr.id)!.events) {
        if (e.kind === "land" || e.kind === "impact") autoFx.push({ at: e.frame, kind: "dust", x: e.x, y: def.floorY, dur: 16, scale: 1.1 });
      }
    }
  }
  const allFx = [...def.fx, ...autoFx];

  // FX that follow a character anchor or a prop (dizzy stars, trails ...)
  const fxOrigin = (fx: FxKey) => {
    const f = fx.follow;
    if (!f || frame < fx.at || frame > fx.at + (fx.dur ?? 18)) return undefined;
    if ("point" in f) return { x: f.point[0], y: f.point[1] };
    const off = f.offset ?? [0, 0];
    if ("prop" in f) {
      const p = sf.props[f.prop];
      return { x: p.x + off[0], y: p.y + off[1] };
    }
    const r = sf.characters[f.char];
    const a = anchorPoint(r.spec, r.pose, r.joints, f.part);
    return { x: a.x + off[0], y: a.y + off[1] };
  };

  const charIds = def.characters.map((c) => c.id);
  const drawn = new Set<string>();

  const renderChar = (id: string) => {
    const tr = def.characters.find((c) => c.id === id)!;
    const r = sf.characters[id];
    drawn.add(id);
    if (inRanges(tr.hidden, frame)) return null;
    const glow = evalParam(tr.renderParams?.glow, frame, 0);
    return (
      <g key={`c-${id}`}>
        {def.props
          .filter((p) => propLayerAt(p, frame) === `behind:${id}`)
          .map((p) => (
            <PropView key={p.id} def={def} p={p} sf={sf} frame={frame} />
          ))}
        <CharacterView s={r.spec} pose={r.pose} joints={r.joints} glow={glow} hideHead={inRanges(tr.hideHead, frame)} smears={def.limbSmears === false ? undefined : limbSmears(rt, id, frame, r.joints)} />
        {def.props
          .filter((p) => propLayerAt(p, frame) === `char:${id}`)
          .map((p) => (
            <PropView key={p.id} def={def} p={p} sf={sf} frame={frame} />
          ))}
        {debug && (
          <g>
            {Object.entries(r.joints)
              .filter(([, v]) => typeof v === "object" && v && "x" in v)
              .map(([k, v]) => (
                <circle key={k} cx={(v as { x: number }).x} cy={(v as { y: number }).y} r={4} fill="#00e0ff" />
              ))}
          </g>
        )}
      </g>
    );
  };

  const nodes: React.ReactNode[] = [];
  for (const tok of order) {
    if (tok === "set:back") {
      if (stage === "room") {
        nodes.push(
          <RoomBack key={tok} frame={frame} lamp={setP("lamp")} parallaxSky={{ dx: (cam.x - 540) * 0.35, dy: (cam.y - 960) * 0.35 }} />,
        );
      } else if (stage === "park") {
        nodes.push(
          <ParkBack key={tok} frame={frame} treeShake={setP("treeShake")} treeX={setP("treeX")} parallaxSky={{ dx: (cam.x - 540) * 0.45, dy: (cam.y - 960) * 0.45 }} />,
        );
      } else {
        nodes.push(
          <g key={tok}>
            <rect x={-2000} y={-2000} width={6000} height={6000} fill="#f4efe6" />
            <rect x={-2000} y={def.floorY} width={6000} height={2000} fill="#e8dccb" />
            <path d={`M-2000 ${def.floorY} L4000 ${def.floorY}`} stroke={INK} strokeWidth={4} />
          </g>,
        );
      }
    } else if (tok === "set:doorway" && stage === "room") {
      nodes.push(<Doorway key={tok} frame={frame} open={Math.min(1, door)} />);
    } else if (tok === "set:door" && stage === "room") {
      nodes.push(<DoorPanel key={tok} open={door} />);
    } else if (tok === "shadows") {
      nodes.push(
        <g key={tok}>
          {charIds.map((id) => {
            const r = sf.characters[id];
            if (inRanges(def.characters.find((c) => c.id === id)!.hidden, frame)) return null;
            return <CharacterShadow key={id} pose={r.pose} joints={r.joints} floorY={def.floorY} s={r.spec} />;
          })}
          {def.props
            .filter((p) => p.shadow && !inRanges(p.hidden, frame))
            .map((p) => {
              const pf = sf.props[p.id];
              const h = Math.max(0, def.floorY - pf.y);
              if (h > 900) return null;
              const k = Math.max(0.25, 1 - h / 700);
              return <ellipse key={p.id} cx={pf.x} cy={def.floorY + 4} rx={60 * k} ry={9 * k} fill={INK} opacity={0.16 * k} />;
            })}
        </g>,
      );
    } else if (tok.startsWith("char:")) {
      const id = tok.slice(5);
      if (id === "*") {
        for (const cid of charIds) {
          if (!drawn.has(cid)) nodes.push(renderChar(cid));
        }
      } else if (!drawn.has(id)) {
        nodes.push(renderChar(id));
      }
    } else if (tok === "props:back" || tok === "props:front") {
      const layer = tok.slice(6) as PropLayer;
      nodes.push(
        <g key={tok}>
          {def.props
            .filter((p) => propLayerAt(p, frame) === layer)
            .map((p) => (
              <PropView key={p.id} def={def} p={p} sf={sf} frame={frame} />
            ))}
        </g>,
      );
    } else if (tok === "fx") {
      nodes.push(
        <g key={tok}>
          {allFx.map((fx, i) => (
            <Fx key={i} fx={fx} frame={frame} origin={fxOrigin(fx)} />
          ))}
        </g>,
      );
    }
  }

  return (
    <svg width={def.width} height={def.height} viewBox={`0 0 ${def.width} ${def.height}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#2a2238" stopOpacity="0" />
          <stop offset="1" stopColor="#2a2238" stopOpacity="0.32" />
        </radialGradient>
      </defs>
      <g transform={cameraTransform(def, cam)}>{nodes}</g>
      {stage !== "plain" && order.includes("set:fore") && (
        <g transform={parallaxTransform(def, cam, 1.25)}>
          {stage === "park" ? <ParkFore frame={frame} /> : <RoomFore frame={frame} />}
        </g>
      )}
      <rect x={0} y={0} width={def.width} height={def.height} fill="url(#vignette)" />
    </svg>
  );
};

export { ROOM };
