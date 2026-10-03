import type { MotionSpec } from '@doodle/spec';
import { ease, type Ease } from './tween';

/** Turns the 0–1 motion knobs into concrete animation parameters. Single tuning spot for "feel". */
export interface MotionFeel {
  windUp: number;       // s
  strike: number;       // s
  recover: number;      // s
  hitPauseMs: number;
  shake: number;        // px
  squash: number;       // 0–0.4 scale delta
  strikeEase: Ease;
  recoverEase: Ease;
  idleJiggle: number;   // radians
}

export function motionFeel(m: MotionSpec): MotionFeel {
  return {
    windUp: 0.06 + m.weight * 0.2,
    strike: 0.08 + m.weight * 0.08,
    recover: 0.12 + (1 - m.elasticity) * 0.1,
    hitPauseMs: 30 + m.weight * 40,
    shake: 2 + m.weight * 10,
    squash: m.elasticity * 0.35,
    strikeEase: ease.inQuad,
    recoverEase: ease.spring(m.elasticity),
    idleJiggle: m.wobble * 0.15,
  };
}
