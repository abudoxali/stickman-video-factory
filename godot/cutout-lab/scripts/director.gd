## Shot timeline for the lab scene, driven by frame count so Movie Maker
## renders (fixed fps) are deterministic. 4 s @ 30 fps.
## User arg `--transparent` (after `--`) hides the set and renders the
## characters on a transparent background for compositing in Remotion.
extends Node2D

@onready var a: Node2D = $KidRed
@onready var b: Node2D = $KidBlue
var frame := 0

func _ready() -> void:
	a.facing = 1
	b.facing = -1
	if "--transparent" in OS.get_cmdline_user_args():
		for n in ["Hills", "Lawn", "Path"]:
			get_node(n).visible = false
		get_viewport().transparent_bg = true

func _process(_dt: float) -> void:
	# B walks in (eased), stops; A waves; B is surprised; both cheer.
	var t := clampf(frame / 48.0, 0.0, 1.0)
	var e := t * t * (3.0 - 2.0 * t)
	b.position.x = lerpf(640.0, 410.0, e)
	b.set_walk(1.0 if frame < 44 else maxf(0.0, 1.0 - (frame - 44) / 6.0))
	if frame == 30: a.act(&"wave")
	if frame == 58: b.act(&"surprised")
	if frame == 84: a.act(&"cheer")
	if frame == 88: b.act(&"cheer")
	frame += 1
