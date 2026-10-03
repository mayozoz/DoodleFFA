"""Build client/public/models/character/character.glb from the Mixamo sources.

    pnpm character:build          # runs this inside headless Blender

Sources (assets-src/character/):
    <name>.fbx           the rigged character (With Skin). Its clip containing "idle" becomes `Idle`.
    <name>_<clip>.fbx    one animation each (Without Skin), e.g. stickman_run.fbx -> `Run`.

What it does:
    - keeps one armature + the mesh, drops every other imported armature
    - names each clip, strips forward root motion (keeps the bob), so clips play in place
    - replaces materials with one plain white material (the game tints it per player)
    - exports a single GLB with one animation per clip
"""

import re
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src" / "character"
OUT = ROOT / "client" / "public" / "models" / "character" / "character.glb"
HIPS = "mixamorig:Hips"
# Horizontal drift above this (in the hips' local units) counts as root motion and is removed.
ROOT_MOTION_THRESHOLD = 5.0


def fail(msg: str):
    print(f"ERROR: {msg}")
    sys.exit(1)


def import_fbx(path: Path):
    before_objs, before_actions = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=str(path))
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    new_actions = [a for a in bpy.data.actions if a not in before_actions]
    return new_objs, new_actions


def moving_channels(action) -> int:
    n = 0
    for fc in action.fcurves:
        vals = [k.co[1] for k in fc.keyframe_points]
        if vals and max(vals) - min(vals) > 1e-3:
            n += 1
    return n


def pick_idle(actions):
    """The base FBX's clip named *idle* if it actually moves, else its most animated clip.
    (Mixamo re-exports can leave a static clip with the idle's name.)"""
    named = [a for a in actions if "idle" in a.name.lower() and moving_channels(a) > 0]
    moving = sorted((a for a in actions if moving_channels(a) > 0), key=moving_channels, reverse=True)
    pick = (named or moving or [None])[0]
    for a in actions:
        print(f"  base clip {a.name[-24:]!r}: {moving_channels(a)} moving channels{'  <- Idle' if a is pick else ''}")
    return pick


def strip_root_motion(action, name: str):
    """Flatten the linear drift of the hips' horizontal location; keep the per-step bounce."""
    curves = [fc for fc in action.fcurves if fc.data_path == f'pose.bones["{HIPS}"].location']
    for fc in curves:
        pts = fc.keyframe_points
        if len(pts) < 2:
            continue
        (f0, v0), (f1, v1) = pts[0].co, pts[-1].co
        drift = v1 - v0
        if abs(drift) < ROOT_MOTION_THRESHOLD or f1 == f0:
            continue
        for kp in pts:
            k = (kp.co[0] - f0) / (f1 - f0)
            delta = drift * k
            kp.co[1] -= delta
            kp.handle_left[1] -= delta
            kp.handle_right[1] -= delta
        fc.update()
        print(f"  {name}: removed root motion on hips axis {fc.array_index} ({drift:.1f} units)")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbxs = sorted(SRC.glob("*.fbx"))
    bases = [p for p in fbxs if "_" not in p.stem]
    if len(bases) != 1:
        fail(f"expected exactly one base FBX without '_' in {SRC}, found {[p.name for p in bases]}")
    base = bases[0]

    objs, actions = import_fbx(base)
    arm = next((o for o in objs if o.type == "ARMATURE"), None)
    mesh = next((o for o in objs if o.type == "MESH"), None)
    if not arm or not mesh:
        fail(f"{base.name} needs an armature and a mesh (download it 'With Skin')")
    if HIPS not in arm.data.bones:
        fail(f"{base.name} has no {HIPS} bone; is it a Mixamo rig?")
    arm.name = "Character"

    clips = {}
    idle = pick_idle(actions)
    if idle:
        clips["Idle"] = idle
    for a in actions:
        if a is not idle:
            bpy.data.actions.remove(a)

    for path in fbxs:
        if path == base:
            continue
        clip = path.stem.split("_", 1)[1]
        clip = re.sub(r"[^A-Za-z0-9]+", " ", clip).title().replace(" ", "")
        new_objs, new_actions = import_fbx(path)
        if not new_actions:
            fail(f"{path.name} has no animation")
        clips[clip] = new_actions[0]
        for extra in new_actions[1:]:
            bpy.data.actions.remove(extra)
        for o in new_objs:  # drop the clip's own armature/mesh; the action stays
            bpy.data.objects.remove(o, do_unlink=True)

    if not clips:
        fail("no clips found")

    # Name clips, strip root motion, and lay each on its own NLA track (exported one per track).
    arm.animation_data_create()
    arm.animation_data.action = None
    for name, action in clips.items():
        action.name = name
        action.use_fake_user = True
        strip_root_motion(action, name)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, int(action.frame_range[0]), action)
        strip.name = name

    # One plain white material; the game sets its color per player.
    mat = bpy.data.materials.new("Body")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    mesh.data.materials.clear()
    mesh.data.materials.append(mat)

    for o in list(bpy.data.objects):
        if o not in (arm, mesh):
            bpy.data.objects.remove(o, do_unlink=True)

    mesh.data.calc_loop_triangles()
    print(f"  mesh: {len(mesh.data.loop_triangles)} tris, height {mesh.dimensions.z:.2f}")
    print(f"  clips: {', '.join(f'{n} ({int(a.frame_range[1] - a.frame_range[0])}f)' for n, a in clips.items())}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_materials="EXPORT",
    )
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


main()
