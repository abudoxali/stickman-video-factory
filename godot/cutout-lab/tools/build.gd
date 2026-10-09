## Generates the cutout-rig character scenes and the lab scene from the
## Kenney Modular Characters parts (CC0). Re-run after changing outfits/rig:
##   godot --headless --path godot/cutout-lab --import
##   godot --headless --path godot/cutout-lab --script res://tools/build.gd
##
## Rig: Skeleton2D > Bone2D hierarchy (Hip > Legs/Feet, Torso > Arms/Hands,
## Neck > Head) with Sprite2D parts parented to bones (rigid cutout). Draw
## order follows the tree (legs, pants, arms, shirt, neck, head, face, hair).
## Animation: AnimationPlayer clips (idle, walk, wave, cheer, surprised; face
## parts swap textures for expressions) + AnimationTree
## (Blend2 idle/walk -> OneShot action <- Transition wave/cheer/surprised).
extends SceneTree

const A := "res://assets/kenney-modular-characters/"
const HIP_Y := -205.0

const OUTFITS := {
	"kid_red": {
		"skin": "Skin/Tint 1/tint1", "shirt": "Shirts/Red/redShirt1.png", "sleeve": "Shirts/Red/redArm_long.png",
		"pants_top": "Pants/Blue 1/pantsBlue11.png", "pants_leg": "Pants/Blue 1/pantsBlue1_long.png",
		"shoe": "Shoes/Brown 1/brownShoe1.png", "hair": "Hair/Brown 2/brown2Man5.png",
		"nose": "Face/Nose/Tint 1/tint1Nose1.png", "brow": "Face/Eyebrows/brown2Brow1.png", "eye": "Face/Eyes/eyeBrown_large.png",
	},
	"kid_blue": {
		"skin": "Skin/Tint 3/tint3", "shirt": "Shirts/Blue/blueShirt1.png", "sleeve": "Shirts/Blue/blueArm_long.png",
		"pants_top": "Pants/Brown/pantsBrown1.png", "pants_leg": "Pants/Brown/pantsBrown_long.png",
		"shoe": "Shoes/Black/blackShoe1.png", "hair": "Hair/Black/blackMan1.png",
		"nose": "Face/Nose/Tint 3/tint3Nose2.png", "brow": "Face/Eyebrows/blackBrow1.png", "eye": "Face/Eyes/eyeBlack_large.png",
	},
}

func _init() -> void:
	for id in OUTFITS:
		_save(_build_kid(id, OUTFITS[id]), "res://scenes/%s.tscn" % id)
	_save(_build_main(), "res://scenes/main.tscn")
	print("built: ", OUTFITS.keys(), " + main")
	quit()

# ------------------------------------------------------------------ helpers
func _tex(p: String) -> Texture2D:
	var t: Texture2D = load(A + p)
	assert(t != null, "missing texture " + p)
	return t

func _spr(parent: Node, n: String, p: String, pos := Vector2.ZERO, centered := true, offset := Vector2.ZERO, flip := false) -> Sprite2D:
	var s := Sprite2D.new()
	s.name = n
	s.texture = _tex(p)
	s.position = pos
	s.centered = centered
	s.offset = offset
	s.flip_h = flip
	parent.add_child(s)
	return s

func _bone(parent: Node, n: String, pos: Vector2, length := 60.0, angle := 0.0) -> Bone2D:
	var b := Bone2D.new()
	b.name = n
	b.position = pos
	b.rest = Transform2D(0.0, pos)
	b.set_autocalculate_length_and_angle(false)
	b.set_length(length)
	b.set_bone_angle(angle)
	parent.add_child(b)
	return b

func _own(n: Node, owner: Node) -> void:
	for c in n.get_children():
		c.owner = owner
		if c.scene_file_path == "":
			_own(c, owner)

func _save(root: Node, path: String) -> void:
	_own(root, root)
	var ps := PackedScene.new()
	var err := ps.pack(root)
	assert(err == OK)
	err = ResourceSaver.save(ps, path)
	assert(err == OK, "save failed " + path)
	root.free()

# value track helper: tracks = [[path, [[t, v], ...]], ...]
func _anim(length: float, loop: bool, tracks: Array) -> Animation:
	var a := Animation.new()
	a.length = length
	a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	for tr in tracks:
		var i := a.add_track(Animation.TYPE_VALUE)
		a.track_set_path(i, NodePath(tr[0]))
		var discrete: bool = tr[1][0][1] is Texture2D
		a.value_track_set_update_mode(i, Animation.UPDATE_DISCRETE if discrete else Animation.UPDATE_CONTINUOUS)
		a.track_set_interpolation_type(i, Animation.INTERPOLATION_NEAREST if discrete else Animation.INTERPOLATION_CUBIC)
		for k in tr[1]:
			a.track_insert_key(i, k[0], k[1])
	return a

# ------------------------------------------------------------------ character
func _build_kid(id: String, o: Dictionary) -> Node2D:
	var root := Node2D.new()
	root.name = id.to_pascal_case()
	root.set_script(load("res://scripts/kid.gd"))
	var sk := Skeleton2D.new()
	sk.name = "Skeleton"
	root.add_child(sk)

	var hip := _bone(sk, "Hip", Vector2(0, HIP_Y), 40, -PI / 2)
	# legs (single rigid pieces, swing at the hip) + shoes
	for side in [-1, 1]:
		var n := "L" if side < 0 else "R"
		var leg := _bone(hip, "Leg" + n, Vector2(36 * side, 0), 150, PI / 2)
		_spr(leg, "Pants", o.pants_leg, Vector2.ZERO, false, Vector2(-56 if side > 0 else -55, -12), side > 0)
		var foot := _bone(leg, "Foot" + n, Vector2(-4 * side, 150), 40, 0.0)
		_spr(foot, "Shoe", o.shoe, Vector2(14 * side, 14), true, Vector2.ZERO, side < 0)
	_spr(hip, "PantsTop", o.pants_top, Vector2(0, -6))

	var torso := _bone(hip, "Torso", Vector2(0, -10), 160, -PI / 2)
	for side in [-1, 1]:
		var n := "L" if side < 0 else "R"
		var arm := _bone(torso, "Arm" + n, Vector2(58 * side, -150), 150, 0.65 if side > 0 else PI - 0.65)
		_spr(arm, "Sleeve", o.sleeve, Vector2.ZERO, false, Vector2(-22, -22) if side > 0 else Vector2(-171 + 22, -22), side < 0)
		var hand := _bone(arm, "Hand" + n, Vector2(140 * side, 106), 30, 0.65 if side > 0 else PI - 0.65)
		_spr(hand, "Hand", o.skin + "_hand.png", Vector2(6 * side, 8))
	_spr(torso, "Shirt", o.shirt, Vector2(0, -84))

	var neck := _bone(torso, "Neck", Vector2(0, -168), 20, -PI / 2)
	_spr(neck, "NeckSkin", o.skin + "_neck.png", Vector2(0, -4))
	var head := _bone(neck, "Head", Vector2(0, -12), 150, -PI / 2)
	_spr(head, "Head", o.skin + "_head.png", Vector2(0, -78))
	_spr(head, "EyeL", o.eye, Vector2(-24, -84))
	_spr(head, "EyeR", o.eye, Vector2(24, -84))
	_spr(head, "BrowL", o.brow, Vector2(-26, -110), true, Vector2.ZERO, true)
	_spr(head, "BrowR", o.brow, Vector2(26, -110))
	_spr(head, "Nose", o.nose, Vector2(0, -64))
	_spr(head, "Mouth", "Face/Mouth/mouth_glad.png", Vector2(0, -40))
	_spr(head, "Hair", o.hair, Vector2(0, -126))

	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"
	root.add_child(player)
	var lib := AnimationLibrary.new()
	for k in _clips():
		lib.add_animation(k, _clips()[k])
	player.add_animation_library("", lib)

	var tree := AnimationTree.new()
	tree.name = "AnimationTree"
	root.add_child(tree)
	tree.anim_player = NodePath("../AnimationPlayer")
	tree.tree_root = _blend_tree()
	tree.active = true
	return root

func _clips() -> Dictionary:
	var S := "Skeleton/Hip"
	var T := S + "/Torso"
	var H := T + "/Neck/Head"
	var glad := _tex("Face/Mouth/mouth_glad.png")
	var happy := _tex("Face/Mouth/mouth_happy.png")
	var oh := _tex("Face/Mouth/mouth_oh.png")
	var hip0 := Vector2(0, HIP_Y)
	var c := {}
	# RESET = rest pose for every animated property. The AnimationTree blends
	# tracks a clip does not key toward these values (not toward zero).
	var b0 := Vector2(-26, -110)
	var b1 := Vector2(26, -110)
	c["RESET"] = _anim(0.1, false, [
		[S + ":position", [[0.0, hip0]]],
		[T + ":rotation", [[0.0, 0.0]]],
		[H + ":rotation", [[0.0, 0.0]]],
		[T + "/ArmL:rotation", [[0.0, 0.0]]],
		[T + "/ArmR:rotation", [[0.0, 0.0]]],
		[T + "/ArmR/HandR:rotation", [[0.0, 0.0]]],
		[S + "/LegL:rotation", [[0.0, 0.0]]],
		[S + "/LegR:rotation", [[0.0, 0.0]]],
		[S + "/LegL/FootL:rotation", [[0.0, 0.0]]],
		[S + "/LegR/FootR:rotation", [[0.0, 0.0]]],
		[H + "/BrowL:position", [[0.0, b0]]],
		[H + "/BrowR:position", [[0.0, b1]]],
		[H + "/Mouth:texture", [[0.0, glad]]],
	])
	c["idle"] = _anim(2.0, true, [
		[S + ":position", [[0.0, hip0], [1.0, hip0 + Vector2(0, 4)], [2.0, hip0]]],
		[T + ":rotation", [[0.0, 0.0], [1.0, 0.025], [2.0, 0.0]]],
		[H + ":rotation", [[0.0, 0.0], [1.0, -0.04], [2.0, 0.0]]],
		[T + "/ArmL:rotation", [[0.0, 0.0], [1.0, 0.05], [2.0, 0.0]]],
		[T + "/ArmR:rotation", [[0.0, 0.0], [1.0, -0.05], [2.0, 0.0]]],
		[S + "/LegL:rotation", [[0.0, 0.0], [2.0, 0.0]]],
		[S + "/LegR:rotation", [[0.0, 0.0], [2.0, 0.0]]],
		[H + "/Mouth:texture", [[0.0, glad]]],
	])
	# two steps per cycle; arms counter-swing; body bobs on the passing poses
	c["walk"] = _anim(0.8, true, [
		[S + ":position", [[0.0, hip0], [0.2, hip0 + Vector2(0, -9)], [0.4, hip0], [0.6, hip0 + Vector2(0, -9)], [0.8, hip0]]],
		[S + "/LegL:rotation", [[0.0, 0.32], [0.4, -0.32], [0.8, 0.32]]],
		[S + "/LegR:rotation", [[0.0, -0.32], [0.4, 0.32], [0.8, -0.32]]],
		[S + "/LegL/FootL:rotation", [[0.0, -0.25], [0.4, 0.2], [0.8, -0.25]]],
		[S + "/LegR/FootR:rotation", [[0.0, 0.2], [0.4, -0.25], [0.8, 0.2]]],
		[T + "/ArmL:rotation", [[0.0, -0.28], [0.4, 0.28], [0.8, -0.28]]],
		[T + "/ArmR:rotation", [[0.0, -0.28], [0.4, 0.28], [0.8, -0.28]]],
		[T + ":rotation", [[0.0, 0.04], [0.4, -0.04], [0.8, 0.04]]],
		[H + ":rotation", [[0.0, -0.03], [0.4, 0.03], [0.8, -0.03]]],
	])
	# anticipation dip, raise, three waves of the forearm (hand bone), settle
	c["wave"] = _anim(1.6, false, [
		[T + "/ArmR:rotation", [[0.0, 0.0], [0.12, 0.18], [0.32, -1.65], [1.3, -1.55], [1.6, 0.0]]],
		[T + "/ArmR/HandR:rotation", [[0.3, 0.0], [0.45, -0.5], [0.65, 0.4], [0.85, -0.5], [1.05, 0.4], [1.25, 0.0]]],
		[H + ":rotation", [[0.0, 0.0], [0.35, 0.1], [1.3, 0.1], [1.6, 0.0]]],
		[T + ":rotation", [[0.0, 0.0], [0.35, -0.05], [1.3, -0.05], [1.6, 0.0]]],
		[H + "/Mouth:texture", [[0.0, glad], [0.15, happy], [1.45, glad]]],
		[H + "/BrowL:position", [[0.0, Vector2(-26, -110)], [0.3, Vector2(-26, -118)], [1.3, Vector2(-26, -118)], [1.6, Vector2(-26, -110)]]],
		[H + "/BrowR:position", [[0.0, Vector2(26, -110)], [0.3, Vector2(26, -118)], [1.3, Vector2(26, -118)], [1.6, Vector2(26, -110)]]],
	])
	# crouch (anticipation) -> jump with arms up -> land squash -> settle
	c["cheer"] = _anim(1.2, false, [
		[S + ":position", [[0.0, hip0], [0.16, hip0 + Vector2(0, 22)], [0.38, hip0 + Vector2(0, -70)], [0.58, hip0], [0.68, hip0 + Vector2(0, 12)], [0.85, hip0]]],
		[T + "/ArmL:rotation", [[0.0, 0.0], [0.16, -0.3], [0.38, 1.75], [0.7, 1.55], [0.9, 1.75], [1.2, 0.0]]],
		[T + "/ArmR:rotation", [[0.0, 0.0], [0.16, 0.3], [0.38, -1.75], [0.7, -1.55], [0.9, -1.75], [1.2, 0.0]]],
		[S + "/LegL:rotation", [[0.0, 0.0], [0.38, 0.22], [0.58, 0.0]]],
		[S + "/LegR:rotation", [[0.0, 0.0], [0.38, -0.22], [0.58, 0.0]]],
		[H + ":rotation", [[0.0, 0.0], [0.38, -0.12], [0.9, -0.08], [1.2, 0.0]]],
		[H + "/Mouth:texture", [[0.0, glad], [0.1, happy], [1.1, glad]]],
	])
	# startle: snap back, hands up, mouth "oh", brows up, slow recover
	c["surprised"] = _anim(1.0, false, [
		[S + ":position", [[0.0, hip0], [0.08, hip0 + Vector2(0, 10)], [0.6, hip0 + Vector2(0, 6)], [1.0, hip0]]],
		[T + ":rotation", [[0.0, 0.0], [0.08, 0.12], [0.7, 0.08], [1.0, 0.0]]],
		[H + ":rotation", [[0.0, 0.0], [0.08, 0.18], [0.7, 0.12], [1.0, 0.0]]],
		[T + "/ArmL:rotation", [[0.0, 0.0], [0.08, 1.1], [0.7, 0.9], [1.0, 0.0]]],
		[T + "/ArmR:rotation", [[0.0, 0.0], [0.08, -1.1], [0.7, -0.9], [1.0, 0.0]]],
		[H + "/Mouth:texture", [[0.0, oh], [0.9, glad]]],
		[H + "/BrowL:position", [[0.0, Vector2(-26, -110)], [0.06, Vector2(-26, -124)], [0.8, Vector2(-26, -120)], [1.0, Vector2(-26, -110)]]],
		[H + "/BrowR:position", [[0.0, Vector2(26, -110)], [0.06, Vector2(26, -124)], [0.8, Vector2(26, -120)], [1.0, Vector2(26, -110)]]],
	])
	return c

func _blend_tree() -> AnimationNodeBlendTree:
	var bt := AnimationNodeBlendTree.new()
	for n in ["idle", "walk", "wave", "cheer", "surprised"]:
		var a := AnimationNodeAnimation.new()
		a.animation = StringName(n)
		bt.add_node(StringName("clip_" + n), a)
	var b2 := AnimationNodeBlend2.new()
	bt.add_node(&"walk_blend", b2)
	bt.connect_node(&"walk_blend", 0, &"clip_idle")
	bt.connect_node(&"walk_blend", 1, &"clip_walk")
	var tr := AnimationNodeTransition.new()
	tr.input_count = 3
	tr.set_input_name(0, "wave")
	tr.set_input_name(1, "cheer")
	tr.set_input_name(2, "surprised")
	bt.add_node(&"act", tr)
	bt.connect_node(&"act", 0, &"clip_wave")
	bt.connect_node(&"act", 1, &"clip_cheer")
	bt.connect_node(&"act", 2, &"clip_surprised")
	var os := AnimationNodeOneShot.new()
	os.fadein_time = 0.12
	os.fadeout_time = 0.25
	bt.add_node(&"action", os)
	bt.connect_node(&"action", 0, &"walk_blend")
	bt.connect_node(&"action", 1, &"act")
	bt.connect_node(&"output", 0, &"action")
	return bt

# ------------------------------------------------------------------ lab scene
func _build_main() -> Node2D:
	var root := Node2D.new()
	root.name = "Main"
	root.set_script(load("res://scripts/director.gd"))
	var hills := Polygon2D.new()
	hills.name = "Hills"
	hills.color = Color("93d283")
	hills.polygon = PackedVector2Array([Vector2(-200, 640), Vector2(120, 560), Vector2(330, 610), Vector2(560, 540), Vector2(800, 620), Vector2(800, 1200), Vector2(-200, 1200)])
	root.add_child(hills)
	var lawn := Polygon2D.new()
	lawn.name = "Lawn"
	lawn.color = Color("86cf6e")
	lawn.polygon = PackedVector2Array([Vector2(-200, 690), Vector2(800, 690), Vector2(800, 1200), Vector2(-200, 1200)])
	root.add_child(lawn)
	var path := Polygon2D.new()
	path.name = "Path"
	path.color = Color("ecd3a2")
	path.polygon = PackedVector2Array([Vector2(-200, 740), Vector2(800, 740), Vector2(800, 800), Vector2(-200, 800)])
	root.add_child(path)
	var red: Node2D = load("res://scenes/kid_red.tscn").instantiate()
	red.name = "KidRed"
	red.position = Vector2(170, 770)
	red.scale = Vector2(0.62, 0.62)
	root.add_child(red)
	var blue: Node2D = load("res://scenes/kid_blue.tscn").instantiate()
	blue.name = "KidBlue"
	blue.position = Vector2(620, 770)
	blue.scale = Vector2(0.62, 0.62)
	root.add_child(blue)
	return root
