import type { PlayCtx } from './types';

/** Room code (prefilled from ?room= via the QR) + name. */
export function joinView(ctx: PlayCtx, onJoined: (code: string) => void | Promise<void>): () => void {
  const params = new URLSearchParams(location.search);
  ctx.el.innerHTML = `
    <form class="center" id="join">
      <h1>Doodle FFA</h1>
      <input id="code" name="room" placeholder="ROOM" maxlength="4" autocapitalize="characters" autocomplete="off" required />
      <input id="name" name="name" placeholder="Your name" maxlength="16" autocomplete="nickname" required />
      <button type="submit">Join</button>
      <p id="err" style="color:#ff6b6b"></p>
    </form>`;
  const form = ctx.el.querySelector<HTMLFormElement>('#join')!;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  let busy = false;
  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    const code = (form.querySelector<HTMLInputElement>('#code')!.value || '').trim().toUpperCase();
    const name = form.querySelector<HTMLInputElement>('#name')!.value;
    if (!/^[A-Z]{4}$/.test(code)) {
      form.querySelector('#err')!.textContent = 'Enter the four-letter room code on the big screen.';
      return;
    }
    busy = true; button.disabled = true; button.textContent = 'Joining…';
    form.querySelector('#err')!.textContent = '';
    // Keep the QR's room code through a reload or a browser's native form fallback.
    const url = new URL(location.href); url.searchParams.set('room', code);
    history.replaceState(null, '', url);
    try {
      await ctx.conn.reducers.joinRoom({ code, name });
      button.textContent = 'Opening room…';
      await onJoined(code);
    } catch (err) {
      form.querySelector('#err')!.textContent = err instanceof Error ? err.message : 'Could not join';
      busy = false; button.disabled = false; button.textContent = 'Join';
    }
  };
  form.querySelector<HTMLInputElement>('#code')!.value = params.get('room') ?? '';
  form.querySelector<HTMLInputElement>('#name')!.value = params.get('name') ?? '';
  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
