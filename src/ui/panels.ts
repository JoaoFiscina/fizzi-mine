import type { Blueprint, Step } from '../blueprint/types';
import type { CompiledModel } from '../blueprint/compile';
import { formatStacks, shulkersNeeded, type MaterialLine } from '../blueprint/materials';
import { itemName } from '../blueprint/names';
import { cssColor } from '../render/blocks';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderInfo(el: HTMLElement, bp: Blueprint, model: CompiledModel) {
  const { meta } = bp;
  const { size } = model;
  const sources = (meta.sources ?? [])
    .map((s) => (/^https?:\/\//.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>` : esc(s)))
    .join('<br>');
  el.innerHTML = `
    <p class="info-name">${esc(meta.name)}</p>
    ${meta.description ? `<p class="muted small" style="margin:0">${esc(meta.description)}</p>` : ''}
    <dl class="info-grid">
      <dt>Base</dt><dd>${size.x} (L-O) × ${size.z} (N-S)</dd>
      <dt>Altura</dt><dd>${size.y} camadas</dd>
      <dt>Blocos</dt><dd>${model.voxels.length.toLocaleString('pt-BR')}</dd>
      ${meta.category ? `<dt>Tipo</dt><dd>${esc(meta.category)}</dd>` : ''}
      ${meta.minecraftVersion ? `<dt>Versão</dt><dd>${esc(meta.minecraftVersion)}</dd>` : ''}
      ${sources ? `<dt>Fontes</dt><dd class="sources">${sources}</dd>` : ''}
    </dl>`;
}

/** Caixa de erros/avisos com botão para copiar a mensagem de correção para a IA. */
export function renderIssues(
  el: HTMLElement,
  kind: 'error' | 'warn',
  title: string,
  items: string[],
  onCopyFix?: () => void,
) {
  el.innerHTML = '';
  if (!items.length) return;
  const box = document.createElement('div');
  box.className = `box ${kind}`;
  box.innerHTML = `<b>${esc(title)}</b><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  if (onCopyFix) {
    const btn = document.createElement('button');
    btn.className = 'btn small-btn';
    btn.textContent = '📋 Copiar pedido de correção para a IA';
    btn.title = 'Copia uma mensagem pronta. Cole na mesma conversa com a IA.';
    btn.addEventListener('click', onCopyFix);
    box.appendChild(btn);
  }
  el.appendChild(box);
}

export function renderFixes(el: HTMLElement, fixes: string[]) {
  el.innerHTML = fixes.length
    ? `<details class="box ok"><summary>✔ Corrigido automaticamente (${fixes.length})</summary><ul>${fixes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`
    : '';
}

export function renderNotes(el: HTMLElement, notes: string[]) {
  el.innerHTML = notes.length
    ? `<div class="box note"><b>Notas da IA</b><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`
    : '';
}

export function renderSteps(el: HTMLElement, steps: Step[], onSelect: (s: Step, li: HTMLElement) => void) {
  el.innerHTML = '';
  if (!steps.length) {
    el.innerHTML = '<li class="muted">O arquivo não tem passo a passo.</li>';
    return;
  }
  for (const s of steps) {
    const li = document.createElement('li');
    const range =
      s.yFrom !== undefined || s.yTo !== undefined
        ? `<span class="step-range">y ${s.yFrom ?? s.yTo}${s.yTo !== undefined && s.yTo !== s.yFrom ? `–${s.yTo}` : ''}</span>`
        : '';
    li.innerHTML = `<b>${esc(s.title)}</b>${range}${s.description ? `<div class="step-desc">${esc(s.description)}</div>` : ''}`;
    li.addEventListener('click', () => {
      el.querySelectorAll('li.active').forEach((n) => n.classList.remove('active'));
      li.classList.add('active');
      onSelect(s, li);
    });
    el.appendChild(li);
  }
}

function loadChecked(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveChecked(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* sem armazenamento: tudo bem, só não lembra */
  }
}

/** Quantidade que você já tem de cada item (campo "tenho"), por projeto. */
export function loadHave(name: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(`fizzi-mine:tenho:${name}`) ?? '{}');
  } catch {
    return {};
  }
}

function saveHave(name: string, have: Record<string, number>) {
  try {
    localStorage.setItem(`fizzi-mine:tenho:${name}`, JSON.stringify(have));
  } catch {
    /* sem armazenamento */
  }
}

/** Itens marcados como "já tenho tudo" (checkbox), por projeto. */
export function loadComplete(name: string): Set<string> {
  return loadChecked(`fizzi-mine:materiais:${name}`);
}

const HOW: Record<string, string> = { craft: 'bancada', smelt: 'fornalha', stonecutter: 'cortador', other: 'ferramenta' };

/** Tabela de itens brutos + passos de crafting. */
export function renderRaw(
  el: HTMLElement,
  totalEl: HTMLElement,
  r: { raw: Map<string, number>; steps: { item: string; how: string; times: number; produced: number; needed: number; in: Record<string, number>; note?: string }[]; smelts: number; fuelCoal: number },
  missingOnly: boolean,
) {
  const items = [...r.raw.entries()].sort((a, b) => b[1] - a[1]);
  const total = items.reduce((a, [, n]) => a + n, 0);
  totalEl.textContent = total ? `${total.toLocaleString('pt-BR')} itens brutos${missingOnly ? ' (só o que falta)' : ''}` : '';
  if (!items.length) {
    el.innerHTML = '<p class="muted small">Nada para coletar neste filtro. ✓</p>';
    return;
  }
  const rows = items
    .map(([item, n]) => `
      <tr>
        <td><span class="swatch" style="background:${cssColor(item)}"></span>${esc(itemName(item))}<div class="mat-id">${esc(item)}</div></td>
        <td class="num"><b>${n}</b></td>
        <td class="num muted">${n >= 64 ? `${Math.floor(n / 64)}×64${n % 64 ? ` + ${n % 64}` : ''}` : n}</td>
      </tr>`)
    .join('');
  const steps = r.steps
    .map((s) => {
      const ins = Object.entries(s.in).map(([k, v]) => `${v} ${itemName(k).toLowerCase()}`).join(' + ');
      const extra = s.produced > s.needed ? ` <span class="muted">(sobra ${s.produced - s.needed})</span>` : '';
      return `<li><span class="how">${HOW[s.how] ?? s.how}</span>${s.times}× → <b>${s.produced} ${esc(itemName(s.item).toLowerCase())}</b>${extra}<div class="muted">usa ${esc(ins)}${s.note ? ` · ${esc(s.note)}` : ''}</div></li>`;
    })
    .join('');
  el.innerHTML = `
    <table class="materials">${rows}</table>
    ${r.smelts ? `<div class="raw-fuel">🔥 Fornalha: ${r.smelts} itens para queimar → <b>${r.fuelCoal} carvão</b> (ou ${Math.ceil(r.smelts / 1.5)} tábuas)</div>` : ''}
    ${steps ? `<details class="raw-steps"><summary>Como fazer: ${r.steps.length} passo(s) de crafting/fornalha</summary><ol>${steps}</ol></details>` : ''}`;
}

export interface MaterialsOptions {
  name: string;
  focused: string | null;
  onFocus: (item: string | null) => void;
}

export function renderMaterials(el: HTMLElement, totalEl: HTMLElement, lines: MaterialLine[], opts: MaterialsOptions) {
  const key = `fizzi-mine:materiais:${opts.name}`;
  const checked = loadChecked(key);
  const have = loadHave(opts.name);
  const total = lines.reduce((a, l) => a + l.count, 0);
  totalEl.textContent = total ? `${total.toLocaleString('pt-BR')} itens · ~${shulkersNeeded(lines)} shulker(s)` : '';

  if (!lines.length) {
    el.innerHTML = '<p class="muted small">Nenhum bloco neste filtro.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'materials';
  for (const l of lines) {
    const tr = document.createElement('tr');
    tr.classList.toggle('done', checked.has(l.item));
    tr.classList.toggle('focused', opts.focused === l.item);
    tr.innerHTML = `
      <td><input type="checkbox" ${checked.has(l.item) ? 'checked' : ''} title="Já tenho / já peguei"></td>
      <td class="mat-name" title="Clique para destacar no 3D">
        <span class="swatch" style="background:${cssColor(l.item)}"></span>${esc(itemName(l.item))}
        <div class="mat-id">${esc(l.item)}</div>
      </td>
      <td class="num"><b>${l.count}</b></td>
      <td class="num muted">${formatStacks(l)}</td>
      <td class="num"><input class="have" type="number" min="0" max="${l.count}" value="${have[l.item] ?? ''}" placeholder="0" title="Quantos você já tem"></td>`;
    const haveInput = tr.querySelector<HTMLInputElement>('input.have')!;
    haveInput.addEventListener('change', () => {
      const n = Math.max(0, Math.floor(Number(haveInput.value) || 0));
      if (n) have[l.item] = n;
      else delete have[l.item];
      saveHave(opts.name, have);
    });
    tr.querySelector('input')!.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      if (on) checked.add(l.item);
      else checked.delete(l.item);
      tr.classList.toggle('done', on);
      saveChecked(key, checked);
    });
    tr.querySelector('.mat-name')!.addEventListener('click', () => opts.onFocus(opts.focused === l.item ? null : l.item));
    table.appendChild(tr);
  }
  el.innerHTML = '';
  el.appendChild(table);
}
