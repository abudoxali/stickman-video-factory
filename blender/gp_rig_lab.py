"""Grease Pencil + armature evaluation scene for Stickman Video Factory.

Builds (from nothing, reproducibly) a 2D ink stickman drawn with Grease
Pencil v3 strokes, deformed by an Armature (vertex groups weighted 1.0 per
bone -> real elbow/knee bends), animates it with pose keyframes (anticipation
crouch, jump, landing squash, wave with forearm overlap), and renders a
transparent PNG sequence with EEVEE. Also saves the editable .blend.

Run (Blender 5.x):
  blender -b --factory-startup --python blender/gp_rig_lab.py -- --out public/renders/blender-lab --frames 120
"""
import math
import os
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def opt(k, d):
    return argv[argv.index(k) + 1] if k in argv else d


OUT = os.path.abspath(opt("--out", "public/renders/blender-lab"))
FRAMES = int(opt("--frames", "120"))
BLEND = os.path.abspath(opt("--blend", "out/blender/gp_rig_lab.blend"))

# ---------------------------------------------------------------- scene setup
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = 540, 960
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, FRAMES
scene.render.film_transparent = True
scene.render.engine = "BLENDER_EEVEE"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = os.path.join(OUT, "frame")

cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 4.4
cam = bpy.data.objects.new("Cam", cam_data)
cam.location = (0.0, -10.0, 1.7)
cam.rotation_euler = (math.radians(90), 0.0, 0.0)
scene.collection.objects.link(cam)
scene.camera = cam

# ---------------------------------------------------------------- armature
# 2D rig in the XZ plane (camera looks along +Y). Joint positions in metres.
J = {
    "hip": (0.0, 0.95),
    "chest": (0.0, 1.65),
    "neck": (0.0, 1.78),
    "head": (0.0, 2.15),
    "shL": (-0.05, 1.6),
    "elL": (-0.32, 1.28),
    "wrL": (-0.42, 0.95),
    "shR": (0.05, 1.6),
    "elR": (0.32, 1.28),
    "wrR": (0.42, 0.95),
    "kneeL": (-0.16, 0.5),
    "ankL": (-0.2, 0.05),
    "kneeR": (0.16, 0.5),
    "ankR": (0.2, 0.05),
}
BONES = [
    # name, head joint, tail joint, parent
    ("root", (0.0, 0.0), (0.0, 0.3), None),
    ("spine", J["hip"], J["chest"], "root"),
    ("neck", J["chest"], J["neck"], "spine"),
    ("head", J["neck"], J["head"], "neck"),
    ("upperArm.L", J["shL"], J["elL"], "spine"),
    ("foreArm.L", J["elL"], J["wrL"], "upperArm.L"),
    ("upperArm.R", J["shR"], J["elR"], "spine"),
    ("foreArm.R", J["elR"], J["wrR"], "upperArm.R"),
    ("thigh.L", J["hip"], J["kneeL"], "root"),
    ("shin.L", J["kneeL"], J["ankL"], "thigh.L"),
    ("thigh.R", J["hip"], J["kneeR"], "root"),
    ("shin.R", J["kneeR"], J["ankR"], "thigh.R"),
]
arm_data = bpy.data.armatures.new("RigData")
rig = bpy.data.objects.new("Rig", arm_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, h, t, parent in BONES:
    b = arm_data.edit_bones.new(name)
    b.head = (h[0], 0.0, h[1])
    b.tail = (t[0], 0.0, t[1])
    if parent:
        b.parent = arm_data.edit_bones[parent]
        b.use_connect = False
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- grease pencil
gp = bpy.data.grease_pencils.new("StickmanInk")
obj = bpy.data.objects.new("Stickman", gp)
scene.collection.objects.link(obj)


def material(name, stroke, fill=None):
    m = bpy.data.materials.new(name)
    bpy.data.materials.create_gpencil_data(m)
    m.grease_pencil.color = stroke
    if fill:
        m.grease_pencil.show_fill = True
        m.grease_pencil.fill_color = fill
    gp.materials.append(m)
    return len(gp.materials) - 1


INK = material("Ink", (0.165, 0.133, 0.22, 1.0))
HEAD = material("Head", (0.165, 0.133, 0.22, 1.0), (1.0, 0.91, 0.83, 1.0))
SHIRT = material("Shirt", (0.165, 0.133, 0.22, 1.0), (1.0, 0.435, 0.35, 1.0))

layer = gp.layers.new("Lines")
drawing = layer.frames.new(1).drawing
strokes = []  # (points[(x,z)], radius, material, bone)


def seg(a, b, bone, n=6, r=0.035, mat=INK):
    pts = [(a[0] + (b[0] - a[0]) * i / (n - 1), a[1] + (b[1] - a[1]) * i / (n - 1)) for i in range(n)]
    strokes.append((pts, r, mat, bone))


seg(J["hip"], J["chest"], "spine", r=0.05)
seg(J["chest"], J["neck"], "neck", n=3, r=0.04)
for s in ("L", "R"):
    seg(J["sh" + s], J["el" + s], "upperArm." + s)
    seg(J["el" + s], J["wr" + s], "foreArm." + s)
    seg(J["hip"], J["knee" + s], "thigh." + s, r=0.04)
    seg(J["knee" + s], J["ank" + s], "shin." + s, r=0.04)
    foot = (J["ank" + s][0] + (0.16 if s == "R" else -0.16), J["ank" + s][1])
    seg(J["ank" + s], foot, "shin." + s, n=3, r=0.045)
# head: closed filled circle
hc, hr = J["head"], 0.3
strokes.append(([(hc[0] + hr * math.cos(a), hc[1] + hr * math.sin(a)) for a in [i * 2 * math.pi / 24 for i in range(24)]], 0.03, HEAD, "head"))
# eyes (filled dots) ride on the head bone
for ex in (-0.1, 0.1):
    strokes.append(([(hc[0] + ex + 0.025 * math.cos(a), hc[1] + 0.04 + 0.04 * math.sin(a)) for a in [i * 2 * math.pi / 8 for i in range(8)]], 0.02, INK, "head"))

drawing.add_strokes([len(s[0]) for s in strokes])
for g in {s[3] for s in strokes}:
    obj.vertex_groups.new(name=g)
offset = 0
for i, (pts, r, mat, bone) in enumerate(strokes):
    st = drawing.strokes[i]
    st.material_index = mat
    st.cyclic = mat in (HEAD,) or (r == 0.02)
    for k, (x, z) in enumerate(pts):
        p = st.points[k]
        p.position = (x, 0.0, z)
        p.radius = r
    drawing.set_vertex_weights(bone, list(range(offset, offset + len(pts))), [1.0] * len(pts))
    offset += len(pts)

mod = obj.modifiers.new("Rig", "GREASE_PENCIL_ARMATURE")
mod.object = rig
mod.use_vertex_groups = True

# ---------------------------------------------------------------- animation
pb = rig.pose.bones


def key(f, **rot):
    """rot: bone=angle in degrees in the drawing plane (bone-local Z: with roll 0
    a bone lying in the XZ plane has its local Z along the camera axis; local
    Y is the bone length axis, so rotating about Y would only twist it)."""
    scene.frame_set(f)
    for name, deg in rot.items():
        bone = pb[name.replace("_", ".")]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, math.radians(-deg))  # + = outward/up on the L side
        bone.keyframe_insert("rotation_euler", frame=f)


def root(f, z=0.0, sx=1.0, sz=1.0):
    pb["root"].location = (0.0, z, 0.0)  # bone-local Y = world up for the root bone
    pb["root"].scale = (sx, sz, 1.0)
    pb["root"].keyframe_insert("location", frame=f)
    pb["root"].keyframe_insert("scale", frame=f)


rest = dict(spine=0, neck=0, head=0, upperArm_L=0, foreArm_L=0, upperArm_R=0, foreArm_R=0, thigh_L=0, shin_L=0, thigh_R=0, shin_R=0)
key(1, **rest)
root(1)
# anticipation crouch: knees bend, arms swing back
key(14, **{**rest, "thigh_L": -35, "shin_L": 60, "thigh_R": 35, "shin_R": -60, "upperArm_L": -40, "upperArm_R": 40, "spine": 8})
root(14, z=-0.22, sx=1.05, sz=0.95)
# take-off / apex: legs extend, arms up (overlap: forearms trail)
key(24, **{**rest, "upperArm_L": 120, "foreArm_L": 20, "upperArm_R": -120, "foreArm_R": -20, "head": -8})
root(24, z=0.55, sx=0.96, sz=1.06)
key(30, **{**rest, "upperArm_L": 130, "foreArm_L": -10, "upperArm_R": -130, "foreArm_R": 10, "thigh_L": 15, "shin_L": -20, "thigh_R": -15, "shin_R": 20})
root(30, z=0.6)
# landing squash
key(38, **{**rest, "thigh_L": -40, "shin_L": 70, "thigh_R": 40, "shin_R": -70, "upperArm_L": 60, "upperArm_R": -60, "spine": 10})
root(38, z=-0.26, sx=1.08, sz=0.92)
key(48, **rest)
root(48)
# wave: raise the right arm, forearm swings with lag (overlap)
key(58, **{**rest, "upperArm_R": 90, "foreArm_R": 30, "head": 6})
for i, f in enumerate(range(64, 100, 6)):
    key(f, **{**rest, "upperArm_R": 90 + (4 if i % 2 else -4), "foreArm_R": 50 if i % 2 else -10, "head": 6})
key(106, **{**rest, "upperArm_R": 40})
key(FRAMES, **rest)
root(FRAMES)

os.makedirs(os.path.dirname(BLEND), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)

# ---------------------------------------------------------------- render
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
bpy.ops.render.render(animation=True)
dt = time.time() - t0
print(f"BLENDER_LAB rendered {FRAMES} frames in {dt:.1f}s ({dt / FRAMES * 1000:.0f} ms/frame) -> {OUT}; blend: {BLEND}")
