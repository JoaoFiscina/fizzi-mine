import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CompiledModel, Voxel } from '../blueprint/compile';
import { toItem } from '../blueprint/materials';
import { lookFor } from './blocks';
import { geometryFor, partsFor } from './geometry';
import { resolveFaces, TextureLibrary, type Faces } from './textures';
import type { Kind } from './blocks';

/** Formas pequenas que ficam melhor com a cor (tocha, botão, lanterna…). */
const NO_TEXTURE = new Set<Kind>(['small', 'lantern', 'rod', 'chest', 'bed']);

export interface HoverInfo {
  voxel: Voxel;
  clientX: number;
  clientY: number;
}

/** Textura branca com borda escura: multiplicada pela cor, dá o visual de "bloco". */
function makeBlockTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(0,0,0,${(Math.random() * 0.09).toFixed(3)})`;
    g.fillRect(((Math.random() * 16) | 0) * 2, ((Math.random() * 16) | 0) * 2, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.38)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 30, 30);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeLabel(text: string, color = '#ffffff'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.renderOrder = 10;
  return s;
}

function wireBox(color: number, size = 1.04, onTop = true): THREE.LineSegments {
  const l = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    new THREE.LineBasicMaterial({ color, depthTest: !onTop, transparent: true }),
  );
  if (onTop) l.renderOrder = 20;
  l.visible = false;
  return l;
}

export class Viewer {
  onHover?: (h: HoverInfo | null) => void;
  /** Blocos selecionados com clique (até 2, para medir distância). */
  onSelect?: (sel: Voxel[]) => void;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
  private controls: OrbitControls;
  private blocks = new THREE.Group();
  private helpers = new THREE.Group();
  private layerOutline: THREE.LineSegments;
  private hoverBox = wireBox(0xffffff);
  private selBoxes = [wireBox(0x4ade80, 1.08), wireBox(0xf59e0b, 1.08)];
  private selLine: THREE.Line;
  private meshes: THREE.InstancedMesh[] = [];
  private materials = new Map<string, THREE.Material>();
  private texMaterials = new Map<string, THREE.Material>();
  private textures: TextureLibrary | null = null;
  private ghost = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false });
  private texture = makeBlockTexture();
  private model?: CompiledModel;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private lastPointer?: { x: number; y: number };
  private hoverDirty = false;
  private externalHighlight = false;
  private selection: Voxel[] = [];
  private focusItem: string | null = null;
  private visible: { maxY: number; only: boolean } = { maxY: 0, only: false };

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x87a9d6);
    this.scene.fog = new THREE.Fog(0x87a9d6, 300, 1200);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x50586a, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(sun);
    this.scene.add(this.blocks, this.helpers);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    this.layerOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85 }),
    );
    this.selLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.3, gapSize: 0.2, depthTest: false }),
    );
    this.selLine.renderOrder = 21;
    this.selLine.visible = false;
    this.scene.add(this.layerOutline, this.hoverBox, ...this.selBoxes, this.selLine);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();

    const canvas = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null));
    canvas.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.click(e.clientX, e.clientY);
      down = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.hoverDirty = true;
      this.externalHighlight = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.lastPointer = undefined;
      this.hoverBox.visible = false;
      this.onHover?.(null);
    });
    this.controls.addEventListener('change', () => (this.hoverDirty = true));

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.updateHover();
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** keepCamera: mantém a câmera onde está (ex.: ao esconder/mostrar uma etapa). */
  setModel(model: CompiledModel, keepCamera = false) {
    const sameSize = this.model && this.model.size.x === model.size.x && this.model.size.y === model.size.y && this.model.size.z === model.size.z;
    this.model = model;
    this.clearSelection();
    this.buildHelpers();
    if (!keepCamera || !sameSize) this.fitCamera();
  }

  /** Limpa a cena (projeto sem nenhuma etapa importada). */
  clear() {
    this.model = undefined;
    this.clearSelection();
    this.rebuild([]);
    this.helpers.clear();
    this.layerOutline.visible = false;
  }

  /** Mostra as camadas até maxY (ou só a camada maxY). */
  showLayers(maxY: number, onlyThis: boolean) {
    if (!this.model) return;
    this.visible = { maxY, only: onlyThis };
    this.layerOutline.visible = true;
    const filter = onlyThis ? (v: Voxel) => v.y === maxY : (v: Voxel) => v.y <= maxY;
    this.rebuild(this.model.voxels.filter(filter));
    const { size } = this.model;
    this.layerOutline.scale.set(size.x, 1, size.z);
    this.layerOutline.position.set(size.x / 2, maxY + 0.5, size.z / 2);
  }

  /** Destaca só os blocos de um item da lista de materiais (null = tudo normal). */
  setFocus(item: string | null) {
    this.focusItem = item;
    this.showLayers(this.visible.maxY, this.visible.only);
  }

  /** Destaque vindo de fora (ex.: mouse em cima da vista 2D). */
  highlight(pos: { x: number; y: number; z: number } | null) {
    this.externalHighlight = !!pos;
    if (!pos) {
      this.hoverBox.visible = false;
      return;
    }
    this.hoverBox.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    this.hoverBox.visible = true;
  }

  clearSelection() {
    this.selection = [];
    this.updateSelection();
  }

  /** PNG da vista atual. */
  screenshot(): string {
    this.hoverBox.visible = false;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private rebuild(voxels: Voxel[]) {
    for (const m of this.meshes) {
      this.blocks.remove(m);
      m.dispose();
    }
    this.meshes = [];
    const index = this.model?.index;

    type Group = { part: string; mat: THREE.Material | THREE.Material[]; list: Voxel[]; transparent: boolean };
    const groups = new Map<string, Group>();
    const lib = this.textures;
    for (const v of voxels) {
      const look = lookFor(v.id, v.props);
      const neighbor = (dx: number, dz: number) => index?.get(`${v.x + dx},${v.y},${v.z + dz}`);
      const dim = this.focusItem !== null && toItem(v)?.item !== this.focusItem;
      // modo "texturas do jogo": descobre a textura de cada face (se não achar, fica com a cor)
      const faces = !dim && lib && !NO_TEXTURE.has(look.kind) ? resolveFaces(v.id, v.props, lib.has) : undefined;
      for (const part of partsFor(v, look, neighbor)) {
        let key: string;
        let make: () => Group;
        if (dim) {
          key = `ghost|${part}`;
          make = () => ({ part, mat: this.ghost, list: [], transparent: true });
        } else if (faces && lib) {
          const t = this.texturedFaces(part, faces, v);
          key = `tex|${part}|${t.key}`;
          make = () => ({ part, mat: t.build(), list: [], transparent: t.translucent });
        } else {
          key = `${look.color}|${look.opacity}|${part}`;
          make = () => ({ part, mat: this.material(`${look.color}|${look.opacity}`, look.color, look.opacity), list: [], transparent: look.opacity < 1 });
        }
        let g = groups.get(key);
        if (!g) groups.set(key, (g = make()));
        g.list.push(v);
      }
    }

    const m4 = new THREE.Matrix4();
    for (const { part, mat, list, transparent } of groups.values()) {
      const mesh = new THREE.InstancedMesh(geometryFor(part), mat, list.length);
      list.forEach((v, i) => mesh.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.voxels = list;
      mesh.userData.ghost = mat === this.ghost;
      if (transparent) mesh.renderOrder = 1;
      this.meshes.push(mesh);
      this.blocks.add(mesh);
    }
    this.hoverDirty = true;
  }

  /** Liga/desliga as texturas do jogo (null = cores). */
  setTextures(lib: TextureLibrary | null) {
    this.textures = lib;
    for (const m of this.texMaterials.values()) m.dispose();
    this.texMaterials.clear();
    if (this.model) this.showLayers(this.visible.maxY, this.visible.only);
  }

  /**
   * Texturas por face. Ordem das faces do BoxGeometry: +x (leste), −x (oeste), +y (topo), −y (baixo), +z (sul), −z (norte).
   * Peças com formato composto (escada, cerca…) usam uma textura só (a lateral).
   */
  private texturedFaces(part: string, f: Faces, v: Voxel) {
    const six = geometryFor(part).groups.length === 6;
    let names: string[];
    if (six) {
      names = [f.side, f.side, f.top, f.bottom, f.side, f.side];
      const axis = v.props.axis;
      if (axis === 'x') names = [f.top, f.bottom, f.side, f.side, f.side, f.side];
      else if (axis === 'z') names = [f.side, f.side, f.side, f.side, f.top, f.bottom];
      if (f.front) {
        const idx = ({ east: 0, west: 1, south: 4, north: 5 } as Record<string, number>)[v.props.facing] ?? 4;
        names[idx] = f.front;
      }
    } else names = [f.side];
    const tints = names.map((_, i) => (f.tint === undefined ? undefined : f.tintTopOnly ? (six && i === 2 ? f.tint : undefined) : f.tint));
    const translucent = names.some((n) => TextureLibrary.isTranslucent(n));
    const key = names.map((n, i) => `${n}${tints[i] ? `#${tints[i]}` : ''}`).join(',');
    const build = () => {
      const mats = names.map((n, i) => this.texMaterial(n, tints[i], part === 'cross'));
      return mats.length === 1 ? mats[0] : mats;
    };
    return { key, translucent, build };
  }

  private texMaterial(name: string, tint: number | undefined, doubleSide: boolean): THREE.Material {
    const key = `${name}|${tint ?? ''}|${doubleSide}`;
    let mat = this.texMaterials.get(key);
    if (!mat) {
      const translucent = TextureLibrary.isTranslucent(name);
      mat = new THREE.MeshLambertMaterial({
        map: this.textures!.get(name),
        color: tint ?? 0xffffff,
        transparent: translucent,
        opacity: name.startsWith('water') ? 0.8 : 1,
        depthWrite: !translucent,
        alphaTest: translucent ? 0 : 0.5,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      this.texMaterials.set(key, mat);
    }
    return mat;
  }

  private material(key: string, color: number, opacity: number): THREE.Material {
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color, map: this.texture, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
      this.materials.set(key, mat);
    }
    return mat;
  }

  private buildHelpers() {
    this.helpers.clear();
    if (!this.model) return;
    const { size } = this.model;

    const n = Math.ceil((Math.max(size.x, size.z) + 16) / 2) * 2;
    const grid = new THREE.GridHelper(n, n, 0x3c4a5e, 0x5a6c84);
    // chão (y = 0 do projeto): fica acima do subsolo, se houver
    const groundY = this.model.offset[1];
    grid.position.set(Math.round(size.x / 2) + 0, groundY - 0.001, Math.round(size.z / 2));
    this.helpers.add(grid);

    const bounds = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    );
    bounds.position.set(size.x / 2, size.y / 2, size.z / 2);
    this.helpers.add(bounds);

    // Bússola: N = -z, S = +z, L = +x, O = -x. Tamanho proporcional à construção.
    const scale = Math.max(1, Math.min(4, Math.max(size.x, size.z) / 9));
    const pad = 1.5 + scale;
    const labels: [string, number, number, string][] = [
      ['N', size.x / 2, -pad, '#ff6b6b'],
      ['S', size.x / 2, size.z + pad, '#ffffff'],
      ['L', size.x + pad, size.z / 2, '#ffffff'],
      ['O', -pad, size.z / 2, '#ffffff'],
    ];
    for (const [t, x, z, c] of labels) {
      const s = makeLabel(t, c);
      s.scale.set(scale, scale, 1);
      s.position.set(x, groundY + scale / 2, z);
      this.helpers.add(s);
    }
  }

  fitCamera() {
    if (!this.model) return;
    const { size } = this.model;
    const center = new THREE.Vector3(size.x / 2, size.y / 3, size.z / 2);
    const r = Math.max(size.x, size.y, size.z, 4);
    this.controls.target.copy(center);
    this.camera.position.set(center.x + r * 1.1, center.y + r * 0.9, center.z + r * 1.4);
    this.camera.far = Math.max(4000, r * 20);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private pick(clientX: number, clientY: number): Voxel | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const solid = this.meshes.filter((m) => !m.userData.ghost);
    const hit = this.raycaster.intersectObjects(solid, false)[0];
    if (!hit || hit.instanceId === undefined) return undefined;
    return (hit.object.userData.voxels as Voxel[])[hit.instanceId];
  }

  private click(clientX: number, clientY: number) {
    const v = this.pick(clientX, clientY);
    if (!v) return; // clique no vazio não apaga a medição (Esc ou ✕ limpam)
    if (this.selection.length >= 2) this.selection = [];
    if (this.selection[0] && this.selection[0] === v) this.selection = [];
    else this.selection.push(v);
    this.updateSelection();
  }

  private updateSelection() {
    this.selBoxes.forEach((b, i) => {
      const v = this.selection[i];
      b.visible = !!v;
      if (v) b.position.set(v.x + 0.5, v.y + 0.5, v.z + 0.5);
    });
    const [a, b] = this.selection;
    this.selLine.visible = !!(a && b);
    if (a && b) {
      this.selLine.geometry.setFromPoints([new THREE.Vector3(a.x + 0.5, a.y + 0.5, a.z + 0.5), new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5)]);
      this.selLine.computeLineDistances();
    }
    this.onSelect?.([...this.selection]);
  }

  private updateHover() {
    if (this.externalHighlight || !this.hoverDirty || !this.lastPointer || !this.meshes.length) return;
    this.hoverDirty = false;
    const v = this.pick(this.lastPointer.x, this.lastPointer.y);
    if (v) {
      this.hoverBox.position.set(v.x + 0.5, v.y + 0.5, v.z + 0.5);
      this.hoverBox.visible = true;
      this.onHover?.({ voxel: v, clientX: this.lastPointer.x, clientY: this.lastPointer.y });
    } else {
      this.hoverBox.visible = false;
      this.onHover?.(null);
    }
  }
}
