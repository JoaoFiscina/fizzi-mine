import type { Voxel } from '../blueprint/compile';
import { blockName, describeProps } from '../blueprint/names';
import { cssColor } from '../render/blocks';
import { esc } from './panels';

/** Legenda do bloco: nome em português, ID do jogo, estados e coordenadas. */
export function tooltipHtml(v: Voxel | undefined, pos: { x: number; y: number; z: number }): string {
  const coords = `<div class="tt-coords">x ${pos.x} · y ${pos.y} · z ${pos.z}</div>`;
  if (!v) return `<div class="tt-name muted">Vazio (ar)</div>${coords}`;
  const props = describeProps(v.props);
  return `
    <div class="tt-name"><span class="swatch" style="background:${cssColor(v.id)}"></span>${esc(blockName(v.id))}</div>
    <div class="tt-id">${esc(v.id)}</div>
    ${props.length ? `<div class="tt-props">${esc(props.join(' · '))}</div>` : ''}
    ${coords}`;
}

export function showTooltip(el: HTMLElement, html: string, clientX: number, clientY: number) {
  el.innerHTML = html;
  el.hidden = false;
  const pad = 14;
  const r = el.getBoundingClientRect();
  let left = clientX + pad;
  let top = clientY + pad;
  if (left + r.width > window.innerWidth - 4) left = clientX - r.width - pad;
  if (top + r.height > window.innerHeight - 4) top = clientY - r.height - pad;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, top)}px`;
}
