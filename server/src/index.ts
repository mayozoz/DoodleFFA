// SpacetimeDB module entry. Every exported reducer/procedure is registered under its
// export name, converted to snake_case (joinRoom → join_room).
import spacetimedb from './schema';

export default spacetimedb;

export * from './reducers/admin';
export * from './reducers/lobby';
export * from './reducers/draw';
export * from './reducers/input';
export * from './reducers/tick';

export * from './procedures/gen_spec';
export * from './procedures/gen_sprite';
export * from './procedures/gen_sfx';
export * from './procedures/gen_commentary';
export * from './procedures/gen_announcement';

export * from './reducers/abilities';
