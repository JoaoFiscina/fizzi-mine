import type { CompiledModel, Voxel } from '../blueprint/compile';
import { computeMaterials } from '../blueprint/materials';
import { itemName } from '../blueprint/names';
import { lookFor } from '../render/blocks';
import { showTooltip, tooltipHtml } from './tooltip';

const PAD = 20; // espaço para os números das coordenadas

/** Vista de cima da camada atual: o "mapa" para construir no jogo. */
export class LayerView {
  /** Mouse em cima de uma célula (para destacar no 3D). */
  onHoverCell?: (pos: { x: number; y: number; z: number } | null) => void;

  private model?: CompiledModel;
  private y = 0;
  private cell = 12;
  private current = new Map<string, Voxel>();
  private hoverCell: { x: number; z: number } | null = null;
  private tapTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private summary: HTMLElement,
    private tooltip: HTMLElement,
  ) {
    canvas.addEventListener('mousemove', (e) => this.hover(e));
    // toque: mostra a legenda da célula tocada por alguns segundos
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.hover(e);
      clearTimeout(this.tapTimer);
      this.tapTimer = window.setTimeout(() => (this.tooltip.hidden = true), 2500);
    });
    canvas.addEventListener('mouseleave', () => {
      this.tooltip.hidden = true;
      this.hoverCell = null;
      this.draw();
      this.onHoverCell?.(null);
    });
    new ResizeObserver(() => this.draw()).observe(canvas.parentElement!);
  }

  setModel(model: CompiledModel) {
    this.model = model;
  }

  setLayer(y: number) {
    this.y = y;
    this.current.clear();
    for (const v of this.model?.byLayer.get(y) ?? []) this.current.set(`${v.x},${v.z}`, v);
    this.draw();
    this.renderSummary();
  }

  private draw() {
    const m = this.model;
    if (!m) return;
    const { size } = m;
    const avail = (this.canvas.parentElement?.clientWidth ?? 280) - 2;
    this.cell = Math.max(3, Math.min(28, Math.floor((avail - PAD) / size.x)));
    const c = this.cell;
    const w = PAD + c * size.x;
    const h = PAD + c * size.z;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const g = this.canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    g.fillStyle = '#181b21';
    g.fillRect(PAD, PAD, c * size.x, c * size.z);

    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

    // camada de baixo, apagadinha (referência)
    g.globalAlpha = 0.22;
    for (const v of m.byLayer.get(this.y - 1) ?? []) {
      g.fillStyle = hex(lookFor(v.id, v.props).color);
      g.fillRect(PAD + v.x * c, PAD + v.z * c, c, c);
    }
    g.globalAlpha = 1;

    // camada atual
    for (const v of this.current.values()) {
      const look = lookFor(v.id, v.props);
      g.fillStyle = hex(look.color);
      const x = PAD + v.x * c;
      const z = PAD + v.z * c;
      switch (look.kind) {
        case 'small':
        case 'cross':
        case 'rod':
        case 'lantern':
        case 'fence':
        case 'pane':
        case 'wall': {
          const s = c * (look.kind === 'wall' ? 0.6 : 0.45);
          g.fillRect(x + (c - s) / 2, z + (c - s) / 2, s, s);
          break;
        }
        default:
          g.globalAlpha = look.opacity < 1 ? 0.7 : 1;
          g.fillRect(x, z, c, c);
          g.globalAlpha = 1;
          if (look.kind === 'slab' || look.kind === 'carpet' || look.kind === 'stairs' || look.kind === 'trapdoor') {
            // meia-célula escura indica bloco "baixo" / lado baixo da escada
            g.fillStyle = 'rgba(0,0,0,0.35)';
            const f = v.props.facing;
            if (look.kind === 'stairs' && f) {
              // o lado escuro é o lado baixo (oposto ao facing)
              if (f === 'north') g.fillRect(x, z + c / 2, c, c / 2);
              else if (f === 'south') g.fillRect(x, z, c, c / 2);
              else if (f === 'east') g.fillRect(x, z, c / 2, c);
              else g.fillRect(x + c / 2, z, c / 2, c);
            } else g.fillRect(x, z + c / 2, c, c / 2);
          }
      }
    }

    // grade
    if (c >= 5) {
      g.lineWidth = 1;
      for (let i = 0; i <= size.x; i++) {
        g.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.moveTo(PAD + i * c + 0.5, PAD);
        g.lineTo(PAD + i * c + 0.5, h);
        g.stroke();
      }
      for (let j = 0; j <= size.z; j++) {
        g.strokeStyle = j % 5 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.moveTo(PAD, PAD + j * c + 0.5);
        g.lineTo(w, PAD + j * c + 0.5);
        g.stroke();
      }
    }

    // célula sob o mouse
    if (this.hoverCell) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.strokeRect(PAD + this.hoverCell.x * c + 1, PAD + this.hoverCell.z * c + 1, c - 2, c - 2);
    }

    // números das coordenadas (x em cima, z na esquerda)
    g.fillStyle = '#9097a8';
    g.font = '10px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // números nas coordenadas do projeto (podem ser negativos depois de ampliar)
    const every = c >= 16 ? 1 : c >= 8 ? 5 : 10;
    const [ox, , oz] = m.offset;
    for (let i = 0; i < size.x; i++) if ((i - ox) % every === 0) g.fillText(String(i - ox), PAD + i * c + c / 2, PAD / 2);
    for (let j = 0; j < size.z; j++) if ((j - oz) % every === 0) g.fillText(String(j - oz), PAD / 2, PAD + j * c + c / 2);
    g.fillStyle = '#ff6b6b';
    g.font = 'bold 10px system-ui, sans-serif';
    g.fillText('N↑', PAD / 2, PAD / 2);
  }

  private renderSummary() {
    const list = [...this.current.values()];
    if (!list.length) {
      this.summary.textContent = 'Camada vazia.';
      return;
    }
    const top = computeMaterials(list)
      .slice(0, 5)
      .map((l) => `${l.count} ${itemName(l.item).toLowerCase()}`)
      .join(' · ');
    this.summary.textContent = `${list.length} blocos nesta camada: ${top}`;
  }

  private hover(e: MouseEvent) {
    const m = this.model;
    if (!m) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - PAD) / this.cell);
    const z = Math.floor((e.clientY - rect.top - PAD) / this.cell);
    if (x < 0 || z < 0 || x >= m.size.x || z >= m.size.z) {
      this.tooltip.hidden = true;
      if (this.hoverCell) {
        this.hoverCell = null;
        this.draw();
        this.onHoverCell?.(null);
      }
      return;
    }
    if (this.hoverCell?.x !== x || this.hoverCell?.z !== z) {
      this.hoverCell = { x, z };
      this.draw();
      this.onHoverCell?.({ x, y: this.y, z });
    }
    const [ox, oy, oz] = m.offset;
    showTooltip(this.tooltip, tooltipHtml(this.current.get(`${x},${z}`), { x: x - ox, y: this.y - oy, z: z - oz }), e.clientX, e.clientY);
  }
}
