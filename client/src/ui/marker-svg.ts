import type { Marker } from '@doodle/spec';

/** Inline SVG of a player's marker shape (for HTML UI; the arena draws them with Pixi). */
export function drawMarkerSvg(marker: string, color: string, size = 18): string {
  const shapes: Record<Marker, string> = {
    circle: '<circle cx="12" cy="12" r="9"/>',
    triangle: '<polygon points="12,3 21,20 3,20"/>',
    square: '<rect x="4" y="4" width="16" height="16"/>',
    diamond: '<polygon points="12,2 22,12 12,22 2,12"/>',
    star: '<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/>',
    hexagon: '<polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7"/>',
    pentagon: '<polygon points="12,2 21.5,9 17.9,20.1 6.1,20.1 2.5,9"/>',
    cross: '<polygon points="9,2 15,2 15,9 22,9 22,15 15,15 15,22 9,22 9,15 2,15 2,9 9,9"/>',
    heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    moon: '<path d="M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z"/>',
    bolt: '<polygon points="14,2 5,14 11,14 9,22 19,9 13,9"/>',
    ring: '<circle cx="12" cy="12" r="8" fill="none" stroke-width="4"/>',
  };
  const body = shapes[marker as Marker] ?? shapes.circle;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${color}" aria-hidden="true">${body}</svg>`;
}
