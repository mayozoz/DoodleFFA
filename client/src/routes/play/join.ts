import type { PlayCtx } from './types';

/** Room code (prefilled from ?room= via the QR) + name. */
export function joinView(ctx: PlayCtx, onJoined: (code: string) => void): () => void {
  const params = new URLSearchParams(location.search);
  ctx.el.innerHTML = `
    <form class="center" id="join">
      <h1>Doodle Arena</h1>
      <input id="code" placeholder="ROOM" maxlength="4" autocapitalize="characters" value="${params.get('room') ?? ''}" />
      <input id="name" placeholder="Your name" maxlength="16" />
      <button type="submit">Join</button>
      <p id="err" style="color:#ff6b6b"></p>
    </form>`;
  const form = ctx.el.querySelector<HTMLFormElement>('#join')!;
  const onSubmit = async (e: Event) => {
    e.preventDefault();
    const code = (form.querySelector<HTMLInputElement>('#code')!.value || '').toUpperCase();
    const name = form.querySelector<HTMLInputElement>('#name')!.value;
    try {
      await ctx.conn.reducers.joinRoom({ code, name });
      onJoined(code);
    } catch (err) {
      form.querySelector('#err')!.textContent = err instanceof Error ? err.message : 'Could not join';
    }
  };
  form.addEventListener('submit', onSubmit);
  return () => form.removeEventListener('submit', onSubmit);
}
