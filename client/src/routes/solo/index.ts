import { mount as mountScreen } from '../screen';

/** Solo is a shared-screen room with bots; the human joins from their phone. */
export function mount(el: HTMLElement) { return mountScreen(el, true); }
