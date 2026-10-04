/** Keep the drawing's layout: grip/tip coordinates are shared with its gameplay spec. */
export const SPRITE_PROMPT = `Turn this player's weapon doodle into a finished 2D game weapon sprite.
Use the drawing as the design reference: preserve its distinctive silhouette, colors,
orientation, proportions, and exact placement on the square canvas. Keep the handle,
grip, and tip in the same positions. Fill the shapes with vibrant colors, crisp dark
outlines, and simple cel shading, like a playful illustrated arena game inventory item.
Render only this single weapon, with no character, hand, text, labels, frame, scenery,
drop shadow, or extra objects. Use a completely solid pure white (#FFFFFF) background
so the game can remove it. Keep all weapon details darker than white, including highlights.
Do not crop, recenter, rotate, or add perspective. Return one square image.`;
