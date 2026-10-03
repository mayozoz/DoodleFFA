// The SpacetimeDB module runtime installs a global `console` that writes to `spacetime logs`.
// Declared here so we don't pull in DOM or Node typings.
declare const console: {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  debug(...data: unknown[]): void;
};
