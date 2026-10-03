import * as THREE from 'three';
import { CAMERA_ELEVATION_DEG } from '@doodle/spec';
import { STAGE } from '../stage';

// Three.js layer under the Pixi canvas: floor grid + 3D characters.
//
// Coordinates: game (x, y) on the ground, h = height  →  three (x, h, y).
// The camera is orthographic and tilted, so game → screen is *linear*:
//   screenX = x · unit
//   screenY = (y · sin(el) − h · cos(el)) · unit          (relative to the view center)
// `toScreen()` is that formula; Pixi uses it to place weapons, tags and fx exactly over the 3D.

export const CAMERA_ELEVATION = (CAMERA_ELEVATION_DEG * Math.PI) / 180;

export class Stage3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera();
  readonly canvas: HTMLCanvasElement;
  private grid: THREE.Group | null = null;
  private gridKey = '';
  private width = 1;
  private height = 1;
  private unit = 40;

  /** ground foreshortening (screen px per world unit along y, ÷ unit) */
  static readonly groundScaleY = Math.sin(CAMERA_ELEVATION);
  static readonly heightScale = Math.cos(CAMERA_ELEVATION);

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    this.renderer.setClearColor(STAGE.background, 1);
    this.canvas = this.renderer.domElement;
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-4, 10, 6);
    this.scene.add(sun);

    const d = 50;
    this.camera.position.set(0, Math.sin(CAMERA_ELEVATION) * d, Math.cos(CAMERA_ELEVATION) * d);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.near = 0.1;
    this.camera.far = 200;
  }

  /** Match the Pixi view: same size, same px-per-unit, same center offset (e.g. playground pan). */
  setView(width: number, height: number, unitPx: number, centerOffsetPx = { x: 0, y: 0 }) {
    this.width = width;
    this.height = height;
    this.unit = unitPx;
    this.renderer.setSize(width, height, false);
    const hw = width / 2 / unitPx, hh = height / 2 / unitPx;
    const ox = -centerOffsetPx.x / unitPx, oy = centerOffsetPx.y / unitPx;
    this.camera.left = -hw + ox;
    this.camera.right = hw + ox;
    this.camera.top = hh + oy;
    this.camera.bottom = -hh + oy;
    this.camera.updateProjectionMatrix();
    this.ensureGrid(hw + Math.abs(ox), hh + Math.abs(oy));
  }

  /** Apply the Pixi screen-shake offset (px) so 3D and 2D shake together. */
  setShake(px: number, py: number) {
    this.camera.position.x = px / this.unit;
    this.camera.position.y = Math.sin(CAMERA_ELEVATION) * 50 - (py / this.unit) * Stage3D.heightScale;
    this.camera.position.z = Math.cos(CAMERA_ELEVATION) * 50 + (py / this.unit) * Stage3D.groundScaleY;
  }

  /** game (x, y, h) → pixels relative to the view center (add the Pixi world origin). */
  static toScreen(x: number, y: number, h: number, unitPx: number) {
    return { x: x * unitPx, y: (y * Stage3D.groundScaleY - h * Stage3D.heightScale) * unitPx };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.canvas.remove();
  }

  /** Same look as the 2D StageGrid: 1 cell per unit, brighter line every 5. */
  private ensureGrid(halfW: number, halfH: number) {
    // vertical extent on the ground is larger because of foreshortening
    const rx = Math.ceil(halfW) + 2;
    const rz = Math.ceil(halfH / Stage3D.groundScaleY) + 2;
    const key = `${rx}x${rz}`;
    if (key === this.gridKey) return;
    this.gridKey = key;
    if (this.grid) this.scene.remove(this.grid);
    const minor: number[] = [], major: number[] = [];
    for (let i = -rx; i <= rx; i++) (i % STAGE.majorEvery ? minor : major).push(i, 0, -rz, i, 0, rz);
    for (let j = -rz; j <= rz; j++) (j % STAGE.majorEvery ? minor : major).push(-rx, 0, j, rx, 0, j);
    const lines = (pts: number[], color: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color }));
    };
    this.grid = new THREE.Group();
    this.grid.add(lines(minor, STAGE.minorLine), lines(major, STAGE.majorLine));
    this.scene.add(this.grid);
  }
}
