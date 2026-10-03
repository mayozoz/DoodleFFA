# Base character (3D)

`character.glb` is **generated**. Don't edit it or drop files here by hand.

    assets-src/character/stickman.fbx        rigged character (Mixamo, With Skin)
    assets-src/character/stickman_<clip>.fbx  one animation each (Without Skin) → clip "<Clip>"
                     │
                     ▼   pnpm character:build   (headless Blender: scripts/build_character.py)
    client/public/models/character/character.glb

To add a clip: download it from Mixamo (FBX Binary, Without Skin, 30 fps), save it as
`assets-src/character/stickman_<name>.fbx` (e.g. `stickman_victory.fbx` → `Victory`), and rebuild.
The build strips forward root motion, so "In Place" is optional.

The game currently uses `Idle` and `Run`. Attacks are procedural and need no clips.
They're tuned in `packages/engine/src/three/poses.ts`.
