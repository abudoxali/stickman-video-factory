"""Export a Blender armature action as an engine "keyed clip" (JSON).

Samples the EVALUATED armature every frame (so Bezier F-curves, constraints
and drivers are baked exactly as Blender plays them) and converts it to the
TS engine's pose channels (src/engine/keyedClips.ts):

  arms   aFsh/aFel (".R" = near arm), aBsh/aBel (".L" = far arm): world
         upper-arm angle + relative elbow bend, engine convention
         (0 = down, + = forward along +X). Absolute, retarget-free: angles
         do not depend on limb lengths, so the clip fits any character.
  spine  lean/neck/head deltas from the first frame (additive).
  root   hipY as a fraction of the rig's hip height (additive), squash.
  hands  custom properties hFopen / hBopen on the armature object.

Usage (inside Blender): set CLIP_ACTION / CLIP_OUT in the driver namespace or
pass "-- --action warmUp --out src/clips/warmUp.json" on the command line.
"""
import json
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opt(k, d):
    return argv[argv.index("--" + k) + 1] if "--" + k in argv else d


ACTION = globals().get("CLIP_ACTION") or opt("action", "warmUp")
OUT = globals().get("CLIP_OUT") or opt("out", f"src/clips/{ACTION}.json")

rig = bpy.data.objects["Rig"]
pb = rig.pose.bones
scene = bpy.context.scene
action = bpy.data.actions[ACTION]
rig.animation_data.action = action
f0, f1 = (int(round(x)) for x in action.frame_range)
HIP_H = (rig.matrix_world @ rig.data.bones["thigh.R"].head_local).z  # rest pelvis height


def ang(name, upward=False):
    b = pb[name]
    h = rig.matrix_world @ b.head
    t = rig.matrix_world @ b.tail
    dx, dz = t.x - h.x, t.z - h.z
    return math.atan2(dx, dz) if upward else math.atan2(dx, -dz)


def unwrap(a, ref):
    while a - ref > math.pi:
        a -= 2 * math.pi
    while a - ref < -math.pi:
        a += 2 * math.pi
    return a


ch = {k: [] for k in ["aFsh", "aFel", "aBsh", "aBel", "lean", "neck", "head", "hipY", "squash", "hFopen", "hBopen"]}
prev = {}
base = None
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    bpy.context.view_layer.update()
    spine = ang("spine", True)
    neck = ang("neck", True)
    head = ang("head", True)
    if base is None:
        base = (spine, neck - spine, head - neck)
    vals = {
        # arm angles are kept continuous (windmills unwrap past 2*pi)
        "aFsh": ang("upperArm.R"),
        "aBsh": ang("upperArm.L"),
    }
    for k in ("aFsh", "aBsh"):
        vals[k] = unwrap(vals[k], prev.get(k, 0.0))
        prev[k] = vals[k]
    vals["aFel"] = unwrap(ang("foreArm.R") - ang("upperArm.R"), 0.0)
    vals["aBel"] = unwrap(ang("foreArm.L") - ang("upperArm.L"), 0.0)
    vals["lean"] = spine - base[0]
    vals["neck"] = (neck - spine) - base[1]
    vals["head"] = (head - neck) - base[2]
    pelvis = rig.matrix_world @ pb["thigh.R"].head
    vals["hipY"] = (pelvis.z - HIP_H) / HIP_H
    vals["squash"] = pb["root"].scale[1]
    vals["hFopen"] = float(rig.get("hFopen", 0.3))
    vals["hBopen"] = float(rig.get("hBopen", 0.3))
    for k, v in vals.items():
        ch[k].append(round(v, 5))

data = {
    "id": ACTION,
    "source": "blender",
    "authoredWith": f"Blender {bpy.app.version_string}",
    "file": os.path.basename(bpy.data.filepath) or "(unsaved)",
    "rig": "gp_rig_lab Rig (profile convention: +X forward, .R = near arm)",
    "fps": scene.render.fps,
    "frames": f1 - f0 + 1,
    "additive": ["lean", "neck", "head", "hipY"],
    "channels": ch,
}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(data, fh, separators=(",", ":"))
    fh.write("\n")
result = {"out": OUT, "frames": data["frames"], "channels": list(ch)}
print("CLIP_EXPORTED", json.dumps(result))
