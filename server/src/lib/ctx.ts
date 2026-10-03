import type { Infer, InferSchema, ReducerCtx } from 'spacetimedb/server';
import type spacetimedb from '../schema';
import type { fighter, player, room, weapon } from '../schema';

export type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
export type RoomRow = Infer<typeof room.rowType>;
export type PlayerRow = Infer<typeof player.rowType>;
export type FighterRow = Infer<typeof fighter.rowType>;
export type WeaponRow = Infer<typeof weapon.rowType>;
