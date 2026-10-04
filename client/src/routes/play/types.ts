import type { Identity } from 'spacetimedb';
import type { DbConnection } from '../../module_bindings';
import type { ControllerAudio } from './audio';

export interface PlayCtx {
  conn: DbConnection;
  identity: Identity;
  el: HTMLElement;
  roomCode: string;
  audio?: ControllerAudio;
}

/** Mounts into ctx.el, returns a cleanup function. */
export type View = (ctx: PlayCtx) => () => void;
