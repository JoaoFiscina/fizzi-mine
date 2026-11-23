import type { Floor } from '../blueprint/types';
import { lastLivre, nextSlot, slotsOf, type Project, type Slot } from '../project/project';
import { esc } from './panels';

export interface ProjectPanelHandlers {
  copyPrompt: (s: Slot) => void;
  paste: (s: Slot) => void;
  toggle: (s: Slot) => void;
  remove: (s: Slot) => void;
  convert: () => void;
  floorsChanged: (floors: Floor[]) => void;
  copyFix: (s: Slot) => void;
  /** Modo automático */
  copyContinue: () => void;
  addExtra: () => void;
}

/** Quantos avisos/erros cada etapa tem (pela chave). */
export type SlotStatus = Map<string, { warnings: number; error: boolean }>;

export function renderProjectPanel(el: HTMLElement, p: Project | null, status: SlotStatus, h: ProjectPanelHandlers) {
  el.innerHTML = '';
  if (!p) return;
  if (p.mode === 'livre') return renderAuto(el, p, status, h);
  const slots = slotsOf(p);
  const next = nextSlot(p);

  const head = document.createElement('div');
  head.className = 'proj-head';
  head.innerHTML = `
    <h2>Projeto</h2>
    <div class="proj-name">${esc(p.name)}</div>
    <div class="muted small">${p.mode === 'etapas' ? 'Em etapas: estrutura → detalhes por andar → mobília' : 'Modo rápido (1 resposta)'}</div>`;
  el.appendChild(head);

  if (p.mode === 'etapas' && !p.parts.length) {
    const tip = document.createElement('div');
    tip.className = 'box note small';
    tip.innerHTML = 'Comece pela <b>etapa 1</b>: copie o prompt, cole na IA e depois cole a resposta aqui.';
    el.appendChild(tip);
  }

  const list = document.createElement('div');
  list.className = 'slots';
  let lastGroup = '';
  for (const s of slots) {
    const group = s.num[0];
    if (group !== lastGroup && p.mode === 'etapas') {
      const g = document.createElement('div');
      g.className = 'slot-group';
      g.textContent =
        group === '1' ? 'Etapa 1 · Estrutura' : group === '2' ? 'Etapa 2 · Detalhes por andar' : group === '3' ? 'Etapa 3 · Mobília e decoração' : 'Extra (opcional)';
      list.appendChild(g);
      lastGroup = group;
    }
    const st = status.get(s.key);
    const row = document.createElement('div');
    row.className = 'slot';
    if (s.part) row.classList.add('done');
    if (next?.key === s.key) row.classList.add('next');
    if (!s.ready) row.classList.add('locked');
    if (s.part && !s.part.visible) row.classList.add('hidden-part');

    const badge = !s.part
      ? '<span class="badge">—</span>'
      : st?.error
        ? '<span class="badge err" title="Não abriu">✕</span>'
        : st?.warnings
          ? `<span class="badge warn" title="Avisos">⚠ ${st.warnings}</span>`
          : '<span class="badge ok" title="Importado">✓</span>';

    row.innerHTML = `
      <div class="slot-title"><span class="num">${s.num}</span><span class="t">${esc(s.title)}</span>${badge}</div>
      <div class="slot-actions"></div>`;
    const actions = row.querySelector('.slot-actions')!;
    const btn = (label: string, title: string, fn: () => void, opts: { primary?: boolean; disabled?: boolean } = {}) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn tiny${opts.primary ? ' primary' : ''}`;
      b.textContent = label;
      b.title = title;
      b.disabled = !!opts.disabled;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    };
    const isNext = next?.key === s.key;
    btn('📋 Prompt', s.ready ? 'Copiar o prompt desta etapa para colar na IA' : 'Importe a etapa 1 primeiro', () => h.copyPrompt(s), {
      primary: isNext,
      disabled: !s.ready,
    });
    btn(s.part ? '📥 Trocar' : '📥 Colar', 'Colar a resposta da IA para esta etapa', () => h.paste(s), { primary: isNext, disabled: !s.ready });
    if (s.part) {
      btn(s.part.visible ? '👁' : '🚫', s.part.visible ? 'Esconder esta etapa no 3D' : 'Mostrar esta etapa no 3D', () => h.toggle(s));
      if (st?.warnings || st?.error) btn('🛠', 'Copiar pedido de correção desta etapa para a IA', () => h.copyFix(s));
      btn('✕', 'Remover esta etapa', () => h.remove(s));
    }
    list.appendChild(row);
  }
  el.appendChild(list);

  if (p.mode === 'rapido' && p.parts.length) {
    const b = document.createElement('button');
    b.className = 'btn small-btn';
    b.textContent = '➕ Detalhar em etapas (andares e mobília)';
    b.title = 'Usa esta construção como estrutura e libera as etapas de detalhe e mobília';
    b.addEventListener('click', h.convert);
    el.appendChild(b);
  }

  if (p.mode === 'etapas' && p.floors.length) el.appendChild(floorsEditor(p.floors, h.floorsChanged));
}

function makeBtn(label: string, title: string, fn: () => void, cls = 'btn tiny'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.title = title;
  b.addEventListener('click', fn);
  return b;
}

/** Modo automático: a IA divide; aqui só a lista de partes + "continuar" + "parte extra". */
function renderAuto(el: HTMLElement, p: Project, status: SlotStatus, h: ProjectPanelHandlers) {
  const slots = slotsOf(p);
  const last = lastLivre(p);
  const head = document.createElement('div');
  head.className = 'proj-head';
  head.innerHTML = `
    <h2>Projeto</h2>
    <div class="proj-name">${esc(p.name)}</div>
    <div class="muted small">Automático: a IA divide o trabalho em partes</div>`;
  el.appendChild(head);

  // caixa "o que fazer agora"
  const now = document.createElement('div');
  now.className = 'box note small next-box';
  const lastSt = last.slot ? status.get(last.slot.key) : undefined;
  if (!slots.length) {
    now.innerHTML = 'Cole o prompt inicial na IA e depois cole a resposta (parte 1) aqui.';
    now.appendChild(makeBtn('📋 Copiar prompt inicial', 'Copiar o prompt inicial de novo', () => h.copyPrompt({ key: 'livre:1', stage: 'livre', floor: 1, num: '1', title: '', ready: true }), 'btn small-btn primary'));
  } else if (lastSt?.error || lastSt?.warnings) {
    now.innerHTML = `A parte ${esc(last.slot!.num)} veio com ${lastSt.error ? 'erro' : `${lastSt.warnings} aviso(s)`}. Mande a correção para a IA:`;
    now.appendChild(makeBtn('🛠 Copiar correção', 'Copiar o pedido de correção desta parte', () => h.copyFix(last.slot!), 'btn small-btn primary'));
  } else if (last.done || !last.next) {
    now.innerHTML = last.done
      ? '<b>✓ A IA disse que terminou.</b> Quer mudar, trocar ou ampliar alguma coisa?'
      : 'Quer mudar, trocar, apagar ou ampliar alguma coisa (até um subsolo)?';
    now.appendChild(makeBtn('✏️ Alterar com IA', 'Pedir uma alteração ou ampliação', h.addExtra, 'btn small-btn primary'));
  } else {
    const n = (last.slot?.floor ?? 0) + 1;
    now.innerHTML = `Próxima: <b>parte ${n}${last.of ? ` de ${last.of}` : ''}</b>${last.next ? ` · ${esc(last.next)}` : ''}`;
    now.appendChild(makeBtn('📋 Copiar "continuar"', 'Copiar a mensagem para pedir a próxima parte', h.copyContinue, 'btn small-btn primary'));
  }
  el.appendChild(now);

  const list = document.createElement('div');
  list.className = 'slots';
  for (const s of slots) {
    const st = status.get(s.key);
    const row = document.createElement('div');
    row.className = 'slot done';
    if (s.part && !s.part.visible) row.classList.add('hidden-part');
    const badge = st?.error ? '<span class="badge err">✕</span>' : st?.warnings ? `<span class="badge warn">⚠ ${st.warnings}</span>` : '<span class="badge ok">✓</span>';
    row.innerHTML = `<div class="slot-title"><span class="num">${esc(s.num)}</span><span class="t">${esc(s.title)}</span>${badge}</div><div class="slot-actions"></div>`;
    const a = row.querySelector('.slot-actions')!;
    a.appendChild(makeBtn(s.part!.visible ? '👁' : '🚫', 'Mostrar/esconder no 3D', () => h.toggle(s)));
    a.appendChild(makeBtn('📥 Trocar', 'Colar uma nova versão desta parte', () => h.paste(s)));
    if (st?.warnings || st?.error) a.appendChild(makeBtn('🛠', 'Copiar pedido de correção desta parte', () => h.copyFix(s)));
    a.appendChild(makeBtn('✕', 'Remover esta parte', () => h.remove(s)));
    list.appendChild(row);
  }
  el.appendChild(list);
  if (slots.length && last.next && !last.done)
    el.appendChild(makeBtn('✏️ Alterar com IA', 'Pedir uma alteração ou ampliação a qualquer momento', h.addExtra, 'btn small-btn'));
}

function floorsEditor(floors: Floor[], onChange: (f: Floor[]) => void): HTMLElement {
  const d = document.createElement('details');
  d.className = 'floors-edit';
  d.innerHTML = `<summary>✎ Andares (${floors.length})</summary>
    <p class="muted small">Vieram da planta da etapa 1. Ajuste se a faixa de y estiver errada.</p>`;
  const table = document.createElement('div');
  const draw = () => {
    table.innerHTML = '';
    floors.forEach((f, i) => {
      const r = document.createElement('div');
      r.className = 'floor-row';
      r.innerHTML = `
        <input class="f-name" value="${esc(f.name)}" title="Nome">
        <input class="f-y" type="number" value="${f.yFrom}" title="y inicial">
        <span>–</span>
        <input class="f-y" type="number" value="${f.yTo}" title="y final">
        <button class="btn tiny" title="Remover andar">✕</button>`;
      const [name, y0, y1] = [...r.querySelectorAll('input')] as HTMLInputElement[];
      const commit = () => {
        f.name = name.value || f.name;
        f.yFrom = Number(y0.value);
        f.yTo = Number(y1.value);
        if (f.yFrom > f.yTo) [f.yFrom, f.yTo] = [f.yTo, f.yFrom];
        onChange(floors);
      };
      name.addEventListener('change', commit);
      y0.addEventListener('change', commit);
      y1.addEventListener('change', commit);
      r.querySelector('button')!.addEventListener('click', () => {
        floors.splice(i, 1);
        onChange(floors);
      });
      table.appendChild(r);
    });
    const add = document.createElement('button');
    add.className = 'btn tiny';
    add.textContent = '+ andar';
    add.addEventListener('click', () => {
      const last = floors[floors.length - 1];
      const y = last ? last.yTo + 1 : 0;
      floors.push({ name: `Andar ${floors.length + 1}`, yFrom: y, yTo: y + 3 });
      onChange(floors);
    });
    table.appendChild(add);
  };
  draw();
  d.appendChild(table);
  return d;
}
