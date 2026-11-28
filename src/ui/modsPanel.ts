// Janela "🧩 Mods": cartões dos mods, opções de cada um e download (.mcpack ou .mcaddon com todos).

import { MODS } from '../mods/registry';
import { defaults, stamp, zipAddon, zipPack, type ModDef, type ModValues } from '../mods/packs';
import { addToLibrary, gameProjectFromText, loadLibrary, removeFromLibrary, toGameProject, type GameProject } from '../mods/holograma';
import type { CompiledModel } from '../blueprint/compile';

const KEY = 'fizzi-mine:mods';

function loadValues(): Record<string, ModValues> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveValues(v: Record<string, ModValues>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* sem armazenamento: as opções só valem nesta visita */
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface ModsContext {
  /** Projeto aberto no site (para "adicionar o projeto aberto"). */
  current: () => { name: string; model: CompiledModel } | null;
  toast: (msg: string) => void;
}

/** Lista de projetos que vão dentro do Holograma. */
function renderLibrary(el: HTMLElement, ctx: ModsContext) {
  const list = loadLibrary();
  const rows = list
    .map((p) => `<li><span><b>${esc(p.nome)}</b> <span class="muted">· ${p.tam.join('×')} · ${(p.b.length / 4).toLocaleString('pt-BR')} blocos</span></span><button type="button" class="btn small-btn" data-del="${esc(p.id)}" title="Tirar do pacote">✕</button></li>`)
    .join('');
  el.innerHTML = `<p class="small"><b>Projetos no holograma (${list.length})</b></p>
    ${list.length ? `<ul class="holo-list small">${rows}</ul>` : '<p class="muted small">Nenhum ainda. Adicione abaixo e depois baixe o pacote.</p>'}
    <div class="holo-add">
      <button type="button" class="btn small-btn" data-add="current">＋ Projeto aberto</button>
      <label class="btn small-btn">📂 Arquivo de um amigo<input type="file" accept=".json,.txt" multiple hidden data-add="file"></label>
      <button type="button" class="btn small-btn" data-add="link">🔗 Colar link</button>
    </div>
    <p class="muted small">Amigos mandam o arquivo do projeto (💾 Salvar → Projeto) ou o link (🔗). Depois de mudar a lista, baixe de novo e atualize no Realm.</p>`;

  const add = (p: GameProject | string) => {
    if (typeof p === 'string') return ctx.toast(p);
    addToLibrary(p);
    ctx.toast(`Adicionado ao holograma: ${p.nome}`);
    renderLibrary(el, ctx);
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-del],[data-add]');
    if (!b) return;
    if (b.dataset.del) {
      removeFromLibrary(b.dataset.del);
      renderLibrary(el, ctx);
    } else if (b.dataset.add === 'current') {
      const c = ctx.current();
      if (!c || !c.model.voxels.length) return ctx.toast('Abra um projeto no site primeiro.');
      add(toGameProject(c.model, c.name));
    } else if (b.dataset.add === 'link') {
      const text = prompt('Cole o link do projeto (FIZZI MINE → 💾 Salvar → 🔗 Link):');
      if (text) add(gameProjectFromText(text, 'Projeto'));
    }
  };
  el.querySelector<HTMLInputElement>('input[data-add=file]')!.onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    for (const f of input.files ?? []) add(gameProjectFromText(await f.text(), f.name.replace(/\.(projeto\.)?json$|\.txt$/i, '')));
    input.value = '';
  };
}

export function renderMods(root: HTMLElement, download: (name: string, data: Uint8Array) => void, ctx: ModsContext) {
  const stored = loadValues();
  const values = (m: ModDef): ModValues => ({ ...defaults(m), ...(stored[m.id] ?? {}) });

  root.innerHTML = MODS.map((m) => {
    const v = values(m);
    const opts = m.options
      .map((o) => {
        const input =
          o.type === 'boolean'
            ? `<input type="checkbox" data-mod="${m.id}" data-key="${o.key}" ${v[o.key] ? 'checked' : ''}>`
            : `<input type="number" data-mod="${m.id}" data-key="${o.key}" value="${v[o.key]}" min="${o.min ?? ''}" max="${o.max ?? ''}">`;
        return `<label class="mod-opt">${input}<span>${esc(o.label)}${o.help ? ` <span class="muted">· ${esc(o.help)}</span>` : ''}</span></label>`;
      })
      .join('');
    return `<article class="mod-card${m.ready ? '' : ' soon'}">
      <header><span class="mod-icon">${m.icon}</span><div><h3>${esc(m.name)}${m.ready ? '' : ' <span class="tag">em breve</span>'}</h3><p class="small">${esc(m.description)}</p></div></header>
      <ul class="small">${m.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${opts ? `<details class="mod-opts"><summary class="small">⚙ Opções</summary>${opts}<button type="button" class="btn small-btn" data-reset="${m.id}">Voltar ao padrão</button></details>` : ''}
      ${m.id === 'holograma' ? '<div class="holo-lib"></div>' : ''}
      ${m.ready ? `<div class="mod-actions"><button type="button" class="btn primary" data-dl="${m.id}">⇩ Baixar ${esc(m.name)} (${m.id === 'holograma' ? '.mcaddon' : '.mcpack'})</button></div>` : ''}
    </article>`;
  }).join('');

  const lib = root.querySelector<HTMLElement>('.holo-lib');
  if (lib) renderLibrary(lib, ctx);

  root.oninput = (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.dataset.mod || !el.dataset.key) return;
    const mod = MODS.find((m) => m.id === el.dataset.mod)!;
    const opt = mod.options.find((o) => o.key === el.dataset.key)!;
    let val: number | boolean = el.checked;
    if (opt.type === 'number') {
      val = Math.round(Number(el.value));
      if (!Number.isFinite(val)) return;
      if (opt.min !== undefined) val = Math.max(opt.min, val);
      if (opt.max !== undefined) val = Math.min(opt.max, val);
    }
    stored[mod.id] = { ...(stored[mod.id] ?? {}), [opt.key]: val };
    saveValues(stored);
  };

  root.onclick = async (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-dl],[data-reset]');
    if (!el) return;
    if (el.dataset.reset) {
      delete stored[el.dataset.reset];
      saveValues(stored);
      renderMods(root, download, ctx);
      return;
    }
    const mod = MODS.find((m) => m.id === el.dataset.dl)!;
    // mod com mais de uma parte (comportamento + recursos) vira um .mcaddon só: o navegador costuma
    // bloquear o segundo download seguido, e o .mcaddon instala tudo com dois cliques
    const btn = el as HTMLButtonElement;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = mod.id === 'holograma' ? '⏳ Baixando texturas e montando…' : '⏳ Montando…';
    try {
      const packs = await mod.build!(values(mod));
      if (packs.length === 1) download(packs[0].name, zipPack(packs[0]));
      else download(packs[0].name.replace(/\.mcpack$/, '.mcaddon'), zipAddon(packs));
    } catch (err) {
      ctx.toast(`Não consegui montar o pacote: ${(err as Error).message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  return {
    /** Todos os mods prontos num .mcaddon só. */
    async downloadAll() {
      try {
        ctx.toast('Montando os mods (baixando texturas)…');
        const packs = (await Promise.all(MODS.filter((m) => m.ready && m.build).map((m) => m.build!(values(m))))).flat();
        download(`FizziMine-mods_${stamp().file}.mcaddon`, zipAddon(packs));
      } catch (err) {
        ctx.toast(`Não consegui montar os mods: ${(err as Error).message}`);
      }
    },
  };
}
