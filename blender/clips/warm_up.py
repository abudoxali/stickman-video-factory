"""Author the "warmUp" clip on the Grease Pencil lab armature (Blender 5.x).

Run inside Blender with the lab file open (via the Blender MCP bridge, or
headless: see scripts/blender-clips.mjs). Creates/replaces the action
"warmUp" on the "Rig" armature: a show-off arm windmill (two accelerating
circles of the near arm, far hand on the hip, body bobbing against the swing)
followed by an interlaced-fingers arm stretch with a "crack" accent.

Convention for clips that are exported to the TS engine (export_clip.py):
the armature is read as a PROFILE rig in the XZ plane, +X = the direction the
character faces. Bones ".R" = near arm (F), ".L" = far arm (B). Keys are
given as WORLD bone angles in the engine's convention (radians, 0 = pointing
down, + = swinging forward/up), and converted to local bone rotations here,
so an animator can read the numbers against the engine and refine the curves
in Blender's Graph Editor afterwards (F-curves keep Bezier interpolation).
"""
import math

import bpy
from mathutils import Vector

ACTION = "warmUp"
rig = bpy.data.objects["Rig"]
pb = rig.pose.bones
scene = bpy.context.scene

# ---------------------------------------------------------------- keys
# frame: {bone: world angle}. spine/neck/head angles are measured from
# vertical-up (+ = lean forward); arm bones from vertical-down (+ = forward).
REST = {
    "spine": 0.0, "neck": 0.0, "head": 0.0,
    "upperArm.R": 0.1, "foreArm.R": 0.38,
    "upperArm.L": -0.08, "foreArm.L": 0.24,
}
HIP = {"upperArm.L": -0.55, "foreArm.L": 1.45}  # far hand on the hip
TAU = 2 * math.pi


def windmill(sh, spine, head):
    return {**HIP, "upperArm.R": sh, "foreArm.R": sh + 0.14, "spine": spine, "neck": spine * 0.4, "head": spine * 0.4 + head}


KEYS = {
    0: dict(REST),
    6: {**HIP, "upperArm.R": -0.45, "foreArm.R": -0.25, "spine": -0.05, "neck": -0.03, "head": -0.06},
    # first circle (4 frames per quarter) ... second circle (3 frames per quarter)
    10: windmill(1.25, 0.02, 0.0),
    14: windmill(2.65, -0.04, -0.04),
    18: windmill(3.95, -0.07, -0.06),
    22: windmill(5.2, -0.01, 0.0),
    25: windmill(0.1 + TAU, 0.05, 0.04),
    28: windmill(1.45 + TAU, 0.02, 0.0),
    31: windmill(2.95 + TAU, -0.06, -0.06),
    34: windmill(4.3 + TAU, -0.02, 0.0),
    37: windmill(5.55 + TAU, 0.05, 0.04),
    40: windmill(0.75 + 2 * TAU, 0.03, 0.02),
    # settle out of the windmill into the stretch
    45: {"upperArm.R": 0.55 + 2 * TAU, "foreArm.R": 1.5 + 2 * TAU, "upperArm.L": 0.3, "foreArm.L": 1.3, "spine": 0.0, "neck": 0.0, "head": -0.04},
    50: {"upperArm.R": 1.42 + 2 * TAU, "foreArm.R": 1.5 + 2 * TAU, "upperArm.L": 1.32, "foreArm.L": 1.42, "spine": 0.07, "neck": 0.03, "head": 0.04},
    # "crack!" accent: arms snap a little further, chest pops
    53: {"upperArm.R": 1.56 + 2 * TAU, "foreArm.R": 1.58 + 2 * TAU, "upperArm.L": 1.46, "foreArm.L": 1.5, "spine": 0.1, "neck": 0.04, "head": 0.08},
    58: {"upperArm.R": 1.48 + 2 * TAU, "foreArm.R": 1.52 + 2 * TAU, "upperArm.L": 1.38, "foreArm.L": 1.44, "spine": 0.06, "neck": 0.02, "head": 0.02},
    66: {**{k: v for k, v in REST.items()}, "upperArm.R": 0.1 + 2 * TAU, "foreArm.R": 0.38 + 2 * TAU},
}
# root (pelvis) height in metres (+ = up) and vertical scale (squash/stretch)
ROOT = {0: (0.0, 1.0), 6: (-0.035, 0.98), 18: (0.012, 1.01), 25: (-0.02, 0.99), 31: (0.012, 1.01), 37: (-0.02, 0.99), 45: (0.0, 1.0), 53: (0.01, 1.025), 58: (0.0, 1.0), 66: (0.0, 1.0)}
# hand open 0..1 (custom properties on the armature object, exported as hFopen/hBopen)
HANDS = {0: (0.3, 0.3), 6: (0.0, 0.1), 40: (0.0, 0.1), 46: (0.6, 0.6), 50: (0.0, 0.0), 58: (0.0, 0.0), 66: (0.3, 0.3)}

CHAIN = ["spine", "neck", "head", "upperArm.R", "foreArm.R", "upperArm.L", "foreArm.L"]
UPWARD = {"spine", "neck", "head"}


def world_angle(name):
    """Engine-convention world angle of a pose bone in the XZ plane."""
    b = pb[name]
    h = rig.matrix_world @ b.head
    t = rig.matrix_world @ b.tail
    dx, dz = t.x - h.x, t.z - h.z
    return math.atan2(dx, dz) if name in UPWARD else math.atan2(dx, -dz)


def unwrap(a, ref):
    while a - ref > math.pi:
        a -= TAU
    while a - ref < -math.pi:
        a += TAU
    return a


def plane_axis(name):
    """World Y (the drawing-plane normal) in the bone's rest space. Rotating about
    it keeps the bone in the XZ plane; the bones' own local Z is tilted out of
    the plane, so Euler-Z keys would swing limbs towards/away from the camera."""
    m = (rig.matrix_world.to_3x3() @ rig.data.bones[name].matrix_local.to_3x3()).inverted()
    return (m @ Vector((0.0, 1.0, 0.0))).normalized()


def set_angle(name, target, prev_local):
    """Axis-angle rotation that gives the bone `target` world angle (sign found numerically)."""
    b = pb[name]
    ax = plane_axis(name)
    b.rotation_mode = "AXIS_ANGLE"
    b.rotation_axis_angle = (0.0, ax.x, ax.y, ax.z)
    bpy.context.view_layer.update()
    a0 = world_angle(name)
    b.rotation_axis_angle = (0.1, ax.x, ax.y, ax.z)
    bpy.context.view_layer.update()
    sign = 1.0 if unwrap(world_angle(name) - a0, 0.0) > 0 else -1.0
    local = sign * (target - a0)
    # keep F-curves continuous (multi-turn windmills stay monotonic)
    if prev_local is not None:
        local = unwrap(local, prev_local)
    b.rotation_axis_angle = (local, ax.x, ax.y, ax.z)
    bpy.context.view_layer.update()
    return local


# fresh action
old = bpy.data.actions.get(ACTION)
if old:
    bpy.data.actions.remove(old)
rig.animation_data_create()
action = bpy.data.actions.new(ACTION)
rig.animation_data.action = action
for name in pb.keys():
    pb[name].rotation_mode = "XYZ"
    pb[name].rotation_euler = (0.0, 0.0, 0.0)
    pb[name].location = (0.0, 0.0, 0.0)
    pb[name].scale = (1.0, 1.0, 1.0)
rig["hFopen"] = 0.3
rig["hBopen"] = 0.3

prev = {n: None for n in CHAIN}
for f in sorted(KEYS):
    scene.frame_set(f)
    pose = {**REST, **KEYS[f]}
    for name in CHAIN:  # parents first
        prev[name] = set_angle(name, pose[name], prev[name])
        pb[name].keyframe_insert("rotation_axis_angle", frame=f)
for f, (z, sz) in ROOT.items():
    pb["root"].location = (0.0, z, 0.0)  # bone-local Y = world up for the root bone
    pb["root"].scale = (1.0 / math.sqrt(sz), sz, 1.0)
    pb["root"].keyframe_insert("location", index=1, frame=f)
    pb["root"].keyframe_insert("scale", frame=f)
for f, (hf, hb) in HANDS.items():
    rig["hFopen"] = hf
    rig["hBopen"] = hb
    rig.keyframe_insert('["hFopen"]', frame=f)
    rig.keyframe_insert('["hBopen"]', frame=f)

scene.frame_start = 0
scene.frame_end = max(KEYS)
action["engine_clip"] = ACTION
result = {"action": ACTION, "keys": sorted(KEYS), "frames": [0, max(KEYS)]}
print("WARMUP_AUTHORED", result)
