/** Resolve the current LAN address at request time when the host opened localhost. */
export async function roomJoinUrl(code: string): Promise<string> {
  let origin = import.meta.env.DEV ? location.origin : (import.meta.env.VITE_PUBLIC_URL?.trim() || location.origin);
  if (import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    const response = await fetch('/__doodle/config');
    if (!response.ok) throw new Error('Could not find the phone join address. Reload this screen.');
    const config = await response.json() as { publicOrigin: string };
    origin = config.publicOrigin;
  }
  const url = new URL('/play', origin);
  url.searchParams.set('room', code);
  return url.toString();
}
