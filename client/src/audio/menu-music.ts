const TRACK = '/music/doodle-ffa-menu.mp3';
const PREFERENCE = 'doodle.menu-music';

/** User gestures unlock audio. The saved preference survives reloads; playback never autostarts. */
export function mountMenuMusic(button: HTMLButtonElement) {
  let enabled = true;
  try { enabled = localStorage.getItem(PREFERENCE) !== 'off'; } catch { /* private browsing */ }
  const audio = new Audio(TRACK);
  audio.loop = true;
  audio.volume = .26;
  audio.preload = 'none';
  let active = true, resumeWhenVisible = false;
  const update = () => {
    const playing = !audio.paused && !audio.error;
    button.setAttribute('aria-pressed', String(playing));
    button.innerHTML = `<span class="music-bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Music ${playing ? 'on' : 'off'}</span>`;
    button.title = playing ? 'Mute menu music' : 'Play menu music';
  };
  const play = () => {
    if (!enabled || !active) return;
    void audio.play().then(() => { if (!active || !enabled || document.hidden) audio.pause(); update(); }).catch(() => {
      if (active) { update(); button.title = 'Tap to retry menu music'; }
    });
  };
  const toggle = () => {
    enabled = audio.paused;
    try { localStorage.setItem(PREFERENCE, enabled ? 'on' : 'off'); } catch { /* private browsing */ }
    if (enabled) play(); else audio.pause();
    update();
  };
  const visibility = () => {
    if (document.hidden) { resumeWhenVisible = !audio.paused; audio.pause(); }
    else if (resumeWhenVisible) { resumeWhenVisible = false; play(); }
  };
  button.addEventListener('click', toggle);
  audio.addEventListener('play', update);
  audio.addEventListener('pause', update);
  document.addEventListener('visibilitychange', visibility);
  update();
  return {
    start: play,
    destroy() {
      active = false; audio.pause(); audio.removeAttribute('src'); audio.load();
      button.removeEventListener('click', toggle);
      document.removeEventListener('visibilitychange', visibility);
      audio.removeEventListener('play', update); audio.removeEventListener('pause', update);
    },
  };
}
