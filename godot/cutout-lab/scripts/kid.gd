## Runtime controller for a generated cutout character (tools/build.gd).
## Drives the AnimationTree: idle<->walk blend, one-shot actions, facing.
extends Node2D

@export var facing := 1:
	set(v):
		facing = v
		scale.x = abs(scale.x) * (1 if v >= 0 else -1)

@onready var tree: AnimationTree = $AnimationTree

func set_walk(amount: float) -> void:
	tree.set("parameters/walk_blend/blend_amount", clampf(amount, 0.0, 1.0))

func act(action: StringName) -> void:
	tree.set("parameters/act/transition_request", String(action))
	tree.set("parameters/action/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
