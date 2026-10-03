import type { Archetype } from '@doodle/spec';

// Procedural attack poses, layered on top of whatever the mixer is playing (Idle/Run), so a
// character can run and attack at once. Rotations are in the *character's* space, not each
// bone's local axes, so they read the same on any Mixamo rig:
//   x = character's left (pitch: + tips forward/down), y = up (yaw: + turns to its left),
//   z = forward (roll: + leans to its right).
// Each archetype has a wind-up pose and a strike pose; the timeline is
//   rest → windUp → strike → rest   using the weapon's MotionFeel durations.
// Tune these in /dev/weapons (?pose=<archetype>&t=<0..3> freezes the timeline).

export type RigBone = 'spine' | 'arm' | 'forearm';
export type Axis = 'x' | 'y' | 'z';
export type Pose = Partial<Record<RigBone, Partial<Record<Axis, number>>>>;

export interface AttackPose {
  windUp: Pose;
  strike: Pose;
}

export const ATTACK_POSES: Record<Archetype, AttackPose> = {
  // big horizontal sweep from the right side across the body
  swing: {
    windUp: { spine: { y: -0.5 }, arm: { z: -1.3, y: -0.8 }, forearm: { y: -0.4 } },
    strike: { spine: { y: 0.6 }, arm: { z: -1.3, y: 1.1 }, forearm: { y: 0.2 } },
  },
  // pull back, then punch straight forward
  thrust: {
    windUp: { spine: { y: -0.4 }, arm: { x: 0.4, y: -0.6 }, forearm: { y: -1.2 } },
    strike: { spine: { y: 0.3 }, arm: { x: -1.4 }, forearm: { y: 0 } },
  },
  // raise overhead, chop down in front
  slam: {
    windUp: { spine: { x: -0.25 }, arm: { x: -2.6 }, forearm: { x: -0.3 } },
    strike: { spine: { x: 0.45 }, arm: { x: -0.9 }, forearm: { x: 0 } },
  },
  // aim forward, small recoil
  shoot: {
    windUp: { arm: { x: -1.5 }, forearm: { y: 0 } },
    strike: { spine: { x: -0.1 }, arm: { x: -1.75 }, forearm: { x: -0.2 } },
  },
  // cock back over the shoulder, release forward
  throw: {
    windUp: { spine: { y: -0.6, x: -0.15 }, arm: { x: -2.3, y: -0.5 }, forearm: { x: -0.8 } },
    strike: { spine: { y: 0.4, x: 0.25 }, arm: { x: -0.8, y: 0.3 }, forearm: { x: 0 } },
  },
  // flick from the wrist: small arm, big forearm snap
  whip: {
    windUp: { arm: { x: -1.8, y: -0.4 }, forearm: { x: -1.0 } },
    strike: { spine: { x: 0.15 }, arm: { x: -1.0, y: 0.3 }, forearm: { x: 0.4 } },
  },
  // arm out to the side, whole torso twists
  spin: {
    windUp: { spine: { y: -0.8 }, arm: { z: -1.4 } },
    strike: { spine: { y: 1.2 }, arm: { z: -1.4 } },
  },
  // brace and point
  beam: {
    windUp: { spine: { x: -0.1 }, arm: { x: -1.2 } },
    strike: { spine: { x: 0.05 }, arm: { x: -1.6 }, forearm: { x: -0.1 } },
  },
};

const BONES: RigBone[] = ['spine', 'arm', 'forearm'];
const AXES: Axis[] = ['x', 'y', 'z'];

/** Blend two poses: a·(1−t) + b·t, per bone/axis. Missing entries count as 0 (rest). */
export function blendPose(a: Pose, b: Pose, t: number, out: Pose = {}): Pose {
  for (const bone of BONES) {
    const ab = a[bone], bb = b[bone];
    if (!ab && !bb) { delete out[bone]; continue; }
    const o = (out[bone] ??= {});
    for (const ax of AXES) o[ax] = (ab?.[ax] ?? 0) * (1 - t) + (bb?.[ax] ?? 0) * t;
  }
  return out;
}
