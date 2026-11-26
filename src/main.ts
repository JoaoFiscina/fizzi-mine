import './style.css';
import { parseBlueprint, type ParseResult } from './blueprint/parse';
import type { CompiledModel, Voxel } from './blueprint/compile';
import { computeMaterials, type MaterialLine } from './blueprint/materials';
import { blockName, itemName } from './blueprint/names';
import { flattenToBlueprint, regionTextSize, regionToPromptText } from './blueprint/serialize';
import type { Blueprint, Step } from './blueprint/types';
import { Viewer } from './render/viewer';
import { encodeProject, projectFromHash, shareUrl } from './project/share';
import { buildDatapack } from './project/datapack';
import { forgetPack, loadSavedPack, readPack, savePack, TextureLibrary } from './render/textures';
import { LayerView } from './ui/layerView';
import { esc, loadComplete, loadHave, renderFixes, renderRaw, renderInfo, renderIssues, renderMaterials, renderNotes, renderSteps } from './ui/panels';
import { buildExportItems, materialsJson, materialsText } from './blueprint/materialsExport';
import { dominantWood, rawMaterials } from './blueprint/recipes';
import { renderProjectPanel, type SlotStatus } from './ui/projectPanel';
import { showTooltip, tooltipHtml } from './ui/tooltip';
import { buildAutoPrompt, buildStagePrompt, continueMessage, editMessage, projectSummary, loadDraft, saveDraft, type PromptRequest } from './prompt/builder';
import { correctionMessage } from './prompt/correction';
import {
  buildModel, convertToAuto, convertToStages, emptyProject, exportProject, importProject, lastLivre, loadProject, nextPartNumber, nextSlot,
  refreshFloors, removePart, saveProject, setPart, slotKey, slotsOf, type Built, type Project, type Slot,
} from './project/project';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const tooltip = $('tooltip');
const slider = $<HTMLInputElement>('layer-slider');
const onlyLayer = $<HTMLInputElement>('only-layer');
const layerLabel = $('layer-label');
const matScope = $<HTMLSelectElement>('mat-scope');
const measureEl = $('measure');
const focusBar = $('focus-bar');
const exampleSelect = $<HTMLSelectElement>('example-select');

const viewer = new Viewer($('viewport'));
const layerView = new LayerView($<HTMLCanvasElement>('layer-canvas'), $('layer-summary'), tooltip);
const INFO_HTML = $('info').innerHTML;

let project: Project | null = null;
let built: Built | null = null;
let model: CompiledModel | null = null;
let allMaterials: MaterialLine[] = [];
let focusItem: string | null = null;

// ---------- Utilidades ----------

function toast(msg: string, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout((toast as any).timer);
  (toast as any).timer = setTimeout(() => (t.hidden = true), ms);
}

/** Copia para a área de transferência. Se o navegador bloquear, abre uma janela com o texto selecionado. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const dlg = $<HTMLDialogElement>('copy-dialog');
    const ta = $<HTMLTextAreaElement>('copy-text');
    ta.value = text;
    if (!dlg.open) dlg.showModal();
    ta.focus();
    ta.select();
    return false;
  }
}

function download(filename: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

const downloadText = (filename: string, text: string) =>
  download(filename, URL.createObjectURL(new Blob([text], { type: 'application/json' })));

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blueprint';

const slotLabel = (s: Slot) => `${s.num} · ${s.title}`;

function persist() {
  if (project) saveProject(project);
}

/** Pergunta antes de jogar fora um projeto do usuário. */
function confirmReplace(): boolean {
  if (!project || !project.parts.length || project.fromExample) return true;
  return confirm(`Isso substitui o projeto atual ("${project.name}").\nSe quiser guardar, cancele e clique em 💾 Salvar projeto antes.\n\nContinuar?`);
}

// ---------- Montar e desenhar ----------

function statusMap(): SlotStatus {
  const st: SlotStatus = new Map();
  if (!built) return st;
  for (const [key, r] of built.results) {
    const pw = model?.partWarnings.get(key) ?? [];
    st.set(key, { warnings: r.warnings.length + pw.length, error: !r.ok });
  }
  return st;
}

function rebuild(opts: { keepCamera?: boolean } = {}) {
  built = project ? buildModel(project) : null;
  model = built?.model ?? null;

  renderProjectPanel($('project'), project, statusMap(), panelHandlers);
  renderAllIssues();

  const hasParts = !!project?.parts.length;
  $<HTMLButtonElement>('save-btn').disabled = !hasParts;
  $<HTMLButtonElement>('export-btn').disabled = !model;
  $<HTMLButtonElement>('shot-btn').disabled = !model;
  $<HTMLButtonElement>('edit-btn').disabled = !model;
  $<HTMLButtonElement>('mat-export-btn').disabled = !model;
  $<HTMLButtonElement>('share-btn').disabled = !project?.parts.length;
  $<HTMLButtonElement>('datapack-btn').disabled = !model;
  $('empty-state').hidden = !!model || !project;

  if (!model || !project || !built) {
    viewer.clear();
    $('info').innerHTML = project ? '' : INFO_HTML;
    $('steps').innerHTML = '<li class="muted">—</li>';
    $('notes').innerHTML = '';
    $('materials').innerHTML = '<p class="muted">—</p>';
    $('materials-total').textContent = '';
    layerLabel.textContent = '—';
    return;
  }

  // informações: meta da estrutura (ou da construção completa), com o nome do projeto
  const main = built.blueprints.get('estrutura') ?? built.blueprints.get('completo') ?? [...built.blueprints.values()][0];
  renderInfo($('info'), { ...main, meta: { ...main.meta, name: project.name } }, model);

  const dy = model.offset[1];
  const steps: Step[] = [];
  const notes: string[] = [];
  const multi = project.mode !== 'rapido';
  for (const s of slotsOf(project)) {
    const bp = built.blueprints.get(s.key);
    if (!bp || !s.part?.visible) continue;
    for (const st of bp.steps ?? []) steps.push({ ...st, title: multi ? `[${s.num}] ${st.title}` : st.title });
    for (const n of bp.notes ?? []) notes.push(multi ? `[${s.num}] ${n}` : n);
  }
  renderSteps($('steps'), steps, (s) => {
    onlyLayer.checked = false;
    setLayer((s.yTo ?? s.yFrom ?? topLayer() - dy) + dy);
  });
  renderNotes($('notes'), notes);

  allMaterials = computeMaterials(model.voxels);
  if (focusItem && !allMaterials.some((l) => l.item === focusItem)) focusItem = null;
  updateFocusBar();

  const prevLayer = currentLayer();
  viewer.setModel(model, opts.keepCamera);
  viewer.setFocus(focusItem);
  layerView.setModel(model);
  slider.min = '0';
  slider.max = String(topLayer());
  setLayer(opts.keepCamera && prevLayer <= topLayer() ? prevLayer : topLayer());
}

/** Avisos agrupados por etapa, cada grupo com seu botão de correção. */
function renderAllIssues() {
  const errors = $('errors');
  const warnings = $('warnings');
  const fixes = $('fixes');
  errors.innerHTML = warnings.innerHTML = fixes.innerHTML = '';
  if (!project || !built) return;
  const allFixes: string[] = [];
  for (const s of slotsOf(project)) {
    const r = built.results.get(s.key);
    if (!r) continue;
    const prefix = project.mode !== 'rapido' ? `${s.num} · ` : '';
    allFixes.push(...r.fixes.map((f) => prefix + f));
    const box = document.createElement('div');
    box.className = 'issue-group';
    if (!r.ok) {
      renderIssues(box, 'error', `${prefix}${s.title}: não abriu`, r.errors, () => copyFix(s));
      errors.appendChild(box);
      continue;
    }
    const list = [...r.warnings, ...(model?.partWarnings.get(s.key) ?? [])];
    if (!list.length) continue;
    renderIssues(box, 'warn', `${prefix}${project.mode !== 'rapido' ? s.title : 'Avisos'} (${list.length})`, list, () => copyFix(s));
    warnings.appendChild(box);
  }
  if (model?.warnings.length) {
    const box = document.createElement('div');
    box.className = 'issue-group';
    renderIssues(box, 'warn', 'Projeto', model.warnings);
    warnings.appendChild(box);
  }
  renderFixes(fixes, allFixes);
}

function topLayer(): number {
  return model ? model.size.y - 1 : 0;
}

function currentLayer(): number {
  return Number(slider.value);
}

function setLayer(y: number) {
  if (!model) return;
  y = Math.max(0, Math.min(topLayer(), y));
  slider.value = String(y);
  const floor = project?.floors.find((f) => y - model!.offset[1] >= f.yFrom && y - model!.offset[1] <= f.yTo);
  layerLabel.textContent = `y = ${y - model.offset[1]}${floor && project?.mode !== 'rapido' ? ` · ${floor.name}` : ''}`;
  viewer.showLayers(y, onlyLayer.checked);
  layerView.setLayer(y);
  renderMaterialList();
}

// ---------- Correções e prompts por etapa ----------

async function copyFix(s: Slot) {
  const r = built?.results.get(s.key);
  if (!r) return;
  const msg = correctionMessage({
    errors: r.errors,
    warnings: [...r.warnings, ...(model?.partWarnings.get(s.key) ?? [])],
    truncated: r.truncated,
    stage: s.stage,
    stageLabel: project?.mode === 'etapas' ? `etapa ${slotLabel(s)}` : undefined,
  });
  if (await copyText(msg)) toast('Pedido de correção copiado! Cole na mesma conversa com a IA e depois cole a nova resposta nesta etapa.', 5000);
}

async function copyStagePrompt(s: Slot) {
  if (!project) return;
  const before = buildModel(project, { upTo: s.key, onlyVisible: false });
  const structure = built?.blueprints.get('estrutura') ?? built?.blueprints.get('completo');
  const text = buildStagePrompt(project, s, { model: before.model, style: structure?.plan?.style, exteriorIdea: structure?.plan?.exterior });
  if (!(await copyText(text))) return;
  const big = text.length > 60000 ? ' É um prompt grande: se a IA reclamar, divida o andar em dois (✎ Andares).' : '';
  toast(`Prompt da etapa ${s.num} copiado (${(text.length / 1000).toFixed(1)} mil caracteres). Cole na IA e depois clique em 📥 Colar.${big}`, 6000);
}

// ---------- Receber resposta da IA ----------

function showParseError(res: ParseResult, s?: Slot) {
  const box = $('errors');
  box.innerHTML = '';
  renderIssues(box, 'error', `Não deu para abrir${s ? ` (${slotLabel(s)})` : ''}`, res.errors, async () => {
    const msg = correctionMessage({ errors: res.errors, warnings: res.warnings, truncated: res.truncated, stage: s?.stage });
    if (await copyText(msg)) toast('Pedido de correção copiado! Cole na mesma conversa com a IA.', 4500);
  });
  toast('Não deu para abrir. Veja o motivo no painel da esquerda.');
}

/** target = chave da etapa ou "novo". */
function receive(text: string, target: string): boolean {
  const proj = importProject(text);
  if (proj) {
    if (!confirmReplace()) return false;
    project = proj;
    persist();
    rebuild();
    toast(`Projeto "${proj.name}" aberto.`);
    return true;
  }

  const res = parseBlueprint(text);
  let slot = project && target !== 'novo' && target !== 'auto' ? slotsOf(project).find((s) => s.key === target) : undefined;
  if (project && !project.parts.length && res.ok && res.blueprint?.part) slot = undefined;
  if (!res.ok || !res.blueprint) {
    showParseError(res, slot ?? (project?.mode === 'livre' ? { key: 'livre', stage: 'livre', num: '?', title: 'parte', ready: true } : undefined));
    return false;
  }

  // resposta no formato automático ("part") num projeto ainda vazio: passa para o modo automático
  if (project && !project.parts.length && res.blueprint.part && project.mode !== 'livre') {
    project.mode = 'livre';
    target = 'auto';
  }

  if (project && project.mode === 'livre' && (target === 'auto' || slot)) {
    // modo automático: a resposta diz o número da parte
    const n = slot?.floor ?? res.blueprint.part?.number ?? nextPartNumber(project);
    setPart(project, 'livre', n, text);
    if (!project.floors.length || n === slotsOf(project)[0]?.floor) refreshFloors(project);
  } else if (!slot) {
    if (!confirmReplace()) return false;
    const info = res.blueprint.part;
    const hasPlan = !!res.blueprint.plan;
    const mode = info ? 'livre' : hasPlan ? 'etapas' : 'rapido';
    project = emptyProject(res.blueprint.meta.name, mode);
    setPart(project, mode === 'livre' ? 'livre' : hasPlan ? 'estrutura' : 'completo', mode === 'livre' ? (info?.number ?? 1) : undefined, text);
    refreshFloors(project);
  } else {
    setPart(project!, slot.stage, slot.floor, text);
    if (slot.stage === 'estrutura' || slot.stage === 'completo') refreshFloors(project!);
  }
  exampleSelect.value = '';
  persist();
  rebuild({ keepCamera: !!slot });

  const key =
    project!.mode === 'livre'
      ? slotKey('livre', slot?.floor ?? res.blueprint.part?.number ?? lastLivre(project!).slot?.floor)
      : slot?.key ?? (project!.mode === 'etapas' ? 'estrutura' : 'completo');
  const st = statusMap().get(key);
  const next = nextSlot(project!);
  const warnTxt = st?.warnings ? ` com ${st.warnings} aviso(s)` : ' sem erros ✔';
  let nextTxt = project!.mode === 'etapas' && next ? ` Próximo: ${slotLabel(next)} → 📋 Prompt.` : '';
  if (project!.mode === 'livre') {
    const l = lastLivre(project!);
    nextTxt = st?.warnings ? ' Use 🛠 para mandar a correção.' : l.done ? ' A IA disse que terminou ✓' : ' Clique em 📋 Copiar "continuar" para a próxima parte.';
  }
  toast(`Importado${warnTxt}.${nextTxt}`, 5000);
  return true;
}

// ---------- Diálogo de colar ----------

const pasteDialog = $<HTMLDialogElement>('paste-dialog');
const pasteText = $<HTMLTextAreaElement>('paste-text');
const pasteTarget = $<HTMLSelectElement>('paste-target');

function openPaste(text = '', targetKey?: string) {
  pasteTarget.innerHTML = '';
  if (project && project.mode === 'livre') {
    pasteTarget.add(new Option('Parte nova (usa o número que vier na resposta)', 'auto'));
    for (const s of slotsOf(project)) pasteTarget.add(new Option(`Substituir parte ${s.num} · ${s.title}`, s.key));
  } else if (project && project.parts.length && !project.fromExample) {
    for (const s of slotsOf(project)) {
      if (!s.ready) continue;
      pasteTarget.add(new Option(`${slotLabel(s)}${s.part ? ' (substituir)' : ''}`, s.key));
    }
  } else if (project && !project.parts.length) {
    for (const s of slotsOf(project).filter((x) => x.ready)) pasteTarget.add(new Option(slotLabel(s), s.key));
  }
  pasteTarget.add(new Option('Novo projeto (substitui o atual)', 'novo'));
  pasteTarget.value =
    targetKey ?? (project?.mode === 'livre' ? 'auto' : project && !project.fromExample ? nextSlot(project)?.key : undefined) ?? 'novo';
  if (!pasteTarget.value) pasteTarget.value = 'novo';
  pasteText.value = text;
  pasteDialog.showModal();
  if (!text) pasteText.focus();
}

$('paste-btn').addEventListener('click', () => openPaste());
$('paste-load').addEventListener('click', (e) => {
  e.preventDefault();
  const text = pasteText.value;
  const target = pasteTarget.value;
  pasteDialog.close();
  if (text.trim()) receive(text, target);
});

// Ctrl+V direto na página abre o diálogo já preenchido
window.addEventListener('paste', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, dialog')) return;
  const text = e.clipboardData?.getData('text') ?? '';
  if (text.includes('{')) {
    e.preventDefault();
    openPaste(text);
  }
});

async function openFileText(text: string) {
  if (importProject(text)) receive(text, 'novo');
  else openPaste(text);
}

$<HTMLInputElement>('file-input').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) openFileText(await file.text());
  input.value = '';
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('dragging');
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  const text = file ? await file.text() : e.dataTransfer?.getData('text');
  if (text) openFileText(text);
});

// ---------- Painel do projeto ----------

const panelHandlers = {
  copyPrompt: (s: Slot) => copyStagePrompt(s),
  paste: (s: Slot) => openPaste('', s.key),
  copyFix: (s: Slot) => copyFix(s),
  toggle: (s: Slot) => {
    if (!s.part) return;
    s.part.visible = !s.part.visible;
    persist();
    rebuild({ keepCamera: true });
  },
  remove: (s: Slot) => {
    if (!project || !confirm(`Remover a etapa "${slotLabel(s)}"? (Dá para colar de novo depois.)`)) return;
    removePart(project, s.key);
    persist();
    rebuild({ keepCamera: true });
  },
  convert: () => {
    if (!project) return;
    convertToStages(project);
    persist();
    rebuild({ keepCamera: true });
    toast(`Agora em etapas: ${project.floors.length} andar(es). Copie o prompt da etapa 2a para detalhar.`, 5000);
  },
  copyContinue: async () => {
    if (!project) return;
    const l = lastLivre(project);
    const msg = continueMessage((l.slot?.floor ?? 0) + 1, l.next, model?.size);
    if (await copyText(msg)) toast('Mensagem copiada! Cole na MESMA conversa com a IA e depois cole a resposta aqui (② Colar).', 5000);
  },
  /** Abre a janela "Alterar com IA" (serve para alterar, apagar, ampliar ou acrescentar). */
  addExtra: () => $('edit-btn').click(),
  floorsChanged: (floors: Project['floors']) => {
    if (!project) return;
    project.floors = floors;
    persist();
    rebuild({ keepCamera: true });
  },
};

// ---------- Materiais ----------

/** Linhas de material do filtro atual (tudo / até esta camada / só esta camada). */
function currentMaterialLines(): MaterialLine[] {
  if (!model) return [];
  const y = currentLayer();
  if (matScope.value === 'upto') return computeMaterials(model.voxels.filter((v) => v.y <= y));
  if (matScope.value === 'layer') return computeMaterials(model.byLayer.get(y) ?? []);
  return allMaterials;
}

let rawMode = false;

/** Itens brutos do filtro atual (descontando o que você já tem). */
function computeRaw() {
  const lines = currentMaterialLines();
  const name = project?.name ?? '';
  const have = loadHave(name);
  const complete = loadComplete(name);
  const needs = new Map<string, number>();
  let missingOnly = false;
  for (const l of lines) {
    const h = complete.has(l.item) ? l.count : Math.min(l.count, Math.max(0, have[l.item] ?? 0));
    if (h > 0) missingOnly = true;
    if (l.count - h > 0) needs.set(l.item, l.count - h);
  }
  const res = rawMaterials(needs, { stonecutter: $<HTMLInputElement>('raw-stonecutter').checked, stickWood: dominantWood(lines.map((l) => l.item)) });
  return { res, missingOnly };
}

function renderMaterialList() {
  if (!model || !project) return;
  $('materials').hidden = rawMode;
  $('raw-materials').hidden = !rawMode;
  if (rawMode) {
    const { res, missingOnly } = computeRaw();
    renderRaw($('raw-materials'), $('materials-total'), res, missingOnly);
    return;
  }
  renderMaterials($('materials'), $('materials-total'), currentMaterialLines(), { name: project.name, focused: focusItem, onFocus: setFocus });
}

function setRawMode(on: boolean) {
  rawMode = on;
  $('mat-tab-blocks').classList.toggle('active', !on);
  $('mat-tab-raw').classList.toggle('active', on);
  ($('mat-tab-raw').parentElement!.querySelector('.raw-opt') as HTMLElement).hidden = !on;
  renderMaterialList();
}
$('mat-tab-blocks').addEventListener('click', () => setRawMode(false));
$('mat-tab-raw').addEventListener('click', () => setRawMode(true));
$('raw-stonecutter').addEventListener('change', renderMaterialList);

// ---------- Exportar lista de materiais ----------

function materialsExport() {
  if (!model || !project || !built) return null;
  const main = built.blueprints.get('estrutura') ?? built.blueprints.get('completo') ?? [...built.blueprints.values()][0];
  const y = currentLayer() - model.offset[1];
  const scope = matScope.value === 'upto' ? `construção até a camada y=${y}` : matScope.value === 'layer' ? `só a camada y=${y}` : 'construção inteira (partes visíveis)';
  const info = {
    name: project.name,
    description: main?.meta.description,
    minecraftVersion: main?.meta.minecraftVersion,
    dimensions: `${model.size.x}×${model.size.y}×${model.size.z}`,
    totalBlocks: model.voxels.length,
    scope,
  };
  const items = buildExportItems(currentMaterialLines(), { have: loadHave(project.name), complete: loadComplete(project.name) });
  const raw = computeRaw().res;
  return { info, items, raw, text: materialsText(info, items, raw) };
}

const matDialog = $<HTMLDialogElement>('mat-dialog');
$('mat-export-btn').addEventListener('click', () => {
  const ex = materialsExport();
  if (!ex) return;
  $('mat-export-info').textContent = `${ex.items.length} tipos de bloco · ${ex.info.scope}. Para mudar o filtro, use a lista "tudo / até esta camada / só esta camada".`;
  $<HTMLTextAreaElement>('mat-export-preview').value = ex.text;
  matDialog.showModal();
});
$('mat-export-copy').addEventListener('click', async () => {
  const ex = materialsExport();
  if (ex && (await copyText(ex.text))) toast('Lista copiada! Cole na IA para planejar a coleta.', 4000);
});
$('mat-export-txt').addEventListener('click', () => {
  const ex = materialsExport();
  if (ex) download(`${slug(ex.info.name)}-materiais.txt`, URL.createObjectURL(new Blob([ex.text], { type: 'text/plain;charset=utf-8' })));
});
$('mat-export-json').addEventListener('click', () => {
  const ex = materialsExport();
  if (ex) downloadText(`${slug(ex.info.name)}-materiais.json`, materialsJson(ex.info, ex.items, ex.raw));
});

function setFocus(item: string | null) {
  focusItem = item;
  viewer.setFocus(item);
  updateFocusBar();
  renderMaterialList();
}

function updateFocusBar() {
  focusBar.hidden = !focusItem;
  if (!focusItem) return;
  focusBar.innerHTML = `Destacando: <b>${esc(itemName(focusItem))}</b> <button class="btn" title="Parar de destacar (Esc)">✕</button>`;
  focusBar.querySelector('button')!.addEventListener('click', () => setFocus(null));
}

matScope.addEventListener('change', renderMaterialList);

// ---------- 3D: legenda, destaque e medição ----------

viewer.onHover = (h) => {
  if (!h) {
    tooltip.hidden = true;
    return;
  }
  const part = h.voxel.part && project ? slotsOf(project).find((s) => s.key === h.voxel.part) : undefined;
  const extra = part && project?.mode !== 'rapido' ? `<div class="tt-coords">parte ${esc(part.num)}</div>` : '';
  showTooltip(tooltip, tooltipHtml(h.voxel, world(h.voxel)) + extra, h.clientX, h.clientY);
};

layerView.onHoverCell = (pos) => viewer.highlight(pos);

/** Coordenadas do projeto (as que a IA usa): interno − offset. */
function world(v: { x: number; y: number; z: number }) {
  const o = model?.offset ?? [0, 0, 0];
  return { x: v.x - o[0], y: v.y - o[1], z: v.z - o[2] };
}

const fmt = (v: Voxel) => {
  const w = world(v);
  return `${esc(blockName(v.id))} <span class="muted">(${w.x}, ${w.y}, ${w.z})</span>`;
};
viewer.onSelect = (sel) => {
  if (!sel.length) {
    measureEl.hidden = true;
    return;
  }
  measureEl.hidden = false;
  const [a, b] = sel;
  const close = '<button class="btn m-close" title="Limpar medição (Esc)">✕</button>';
  const wire = () => measureEl.querySelector('.m-close')!.addEventListener('click', () => viewer.clearSelection());
  if (!b) {
    measureEl.innerHTML = `${close}<span class="m-a">A</span> ${fmt(a)}<div class="muted">Clique em outro bloco para medir a distância.</div>`;
    wire();
    return;
  }
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const straight = Math.hypot(dx, dy, dz);
  const dir = (n: number, pos: string, neg: string) => (n === 0 ? '' : ` ${n > 0 ? pos : neg}`);
  measureEl.innerHTML = `${close}
    <div><span class="m-a">A</span> ${fmt(a)}</div>
    <div><span class="m-b">B</span> ${fmt(b)}</div>
    <div class="m-dist">
      Δx <b>${Math.abs(dx)}</b>${dir(dx, 'leste', 'oeste')} · Δy <b>${Math.abs(dy)}</b>${dir(dy, 'acima', 'abaixo')} · Δz <b>${Math.abs(dz)}</b>${dir(dz, 'sul', 'norte')}
    </div>
    <div class="muted">Linha reta: ${straight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} blocos · andando (sem diagonal): ${Math.abs(dx) + Math.abs(dy) + Math.abs(dz)}</div>
    <div class="muted small">Clique em outro bloco para medir de novo · Esc limpa.</div>`;
  wire();
};

// ---------- Camadas ----------

slider.addEventListener('input', () => setLayer(currentLayer()));
onlyLayer.addEventListener('change', () => setLayer(currentLayer()));
$('layer-up').addEventListener('click', () => setLayer(currentLayer() + 1));
$('layer-down').addEventListener('click', () => setLayer(currentLayer() - 1));
$('show-all').addEventListener('click', () => {
  onlyLayer.checked = false;
  setFocus(null);
  setLayer(topLayer());
  viewer.fitCamera();
});

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input:not([type=range]):not([type=checkbox]), textarea, select, dialog')) return;
  if (e.key === ']' || e.key === 'PageUp') setLayer(currentLayer() + 1);
  else if (e.key === '[' || e.key === 'PageDown') setLayer(currentLayer() - 1);
  else if (e.key === 'Escape') {
    viewer.clearSelection();
    setFocus(null);
  }
});

// ---------- Exportar ----------

$('save-btn').addEventListener('click', () => {
  if (!project) return;
  downloadText(`${slug(project.name)}.projeto.json`, exportProject(project));
  toast('Projeto salvo. Para continuar depois, clique em "Abrir" e escolha o arquivo.');
});

$('export-btn').addEventListener('click', () => {
  if (!project || !model || !built) return;
  const main: Blueprint | undefined = built.blueprints.get('estrutura') ?? built.blueprints.get('completo');
  const steps: Step[] = [];
  const notes: string[] = [];
  for (const s of slotsOf(project)) {
    const bp = built.blueprints.get(s.key);
    if (!bp || !s.part?.visible) continue;
    steps.push(...(bp.steps ?? []).map((st) => ({ ...st, title: project!.mode === 'etapas' ? `[${s.num}] ${st.title}` : st.title })));
    notes.push(...(bp.notes ?? []));
  }
  const flat = flattenToBlueprint(model, {
    name: project.name,
    description: main?.meta.description,
    category: main?.meta.category,
    minecraftVersion: main?.meta.minecraftVersion,
    plan: main?.plan ? { ...main.plan, floors: project.floors } : undefined,
    steps,
    notes,
  });
  downloadText(`${slug(project.name)}.json`, JSON.stringify(flat, null, 2));
  toast('Blueprint único exportado (só as etapas visíveis).');
});

$('shot-btn').addEventListener('click', () => {
  if (project) download(`${slug(project.name)}.png`, viewer.screenshot());
});

// ---------- Exemplos ----------

const base = import.meta.env.BASE_URL;

async function loadExample(file: string) {
  try {
    const text = await (await fetch(`${base}examples/${file}`)).text();
    if (importProject(text)) {
      if (!confirmReplace()) return;
      project = importProject(text)!;
    } else {
      const res = parseBlueprint(text);
      if (!res.ok || !res.blueprint) return showParseError(res);
      if (!confirmReplace()) return;
      project = emptyProject(res.blueprint.meta.name, 'rapido');
      setPart(project, 'completo', undefined, text);
    }
    project.fromExample = true;
    persist();
    rebuild();
  } catch {
    toast('Não consegui abrir o exemplo.');
  }
}

exampleSelect.addEventListener('change', () => {
  if (exampleSelect.value) loadExample(exampleSelect.value);
});

async function start() {
  let list: { file: string; name: string }[] = [];
  try {
    list = await (await fetch(`${base}examples/index.json`)).json();
    for (const ex of list) exampleSelect.add(new Option(ex.name, ex.file));
  } catch {
    /* sem exemplos */
  }
  project = loadProject() ?? null;
  if (project) {
    rebuild();
    return;
  }
  if (list[0]) {
    exampleSelect.value = list[0].file;
    await loadExample(list[0].file);
  } else rebuild();
}
start();

// ---------- Novo projeto (formulário do prompt) ----------

const promptDialog = $<HTMLDialogElement>('prompt-dialog');
const form = $<HTMLFormElement>('prompt-form');

function readForm(): PromptRequest {
  const f = new FormData(form);
  return {
    idea: String(f.get('idea') ?? ''),
    category: String(f.get('category') ?? 'casa'),
    size: String(f.get('size') ?? ''),
    materials: String(f.get('materials') ?? ''),
    version: String(f.get('version') ?? ''),
    refs: String(f.get('refs') ?? ''),
    detail: String(f.get('detail') ?? 'medio') as PromptRequest['detail'],
    photos: f.get('photos') === 'on',
    mode: f.get('mode') === 'rapido' ? 'rapido' : f.get('mode') === 'etapas' ? 'etapas' : 'livre',
  };
}

function fillForm(r: PromptRequest) {
  const el = form.elements as any;
  el.idea.value = r.idea;
  el.category.value = r.category;
  el.size.value = r.size;
  el.materials.value = r.materials;
  el.version.value = r.version;
  el.refs.value = r.refs;
  el.detail.value = r.detail;
  el.photos.checked = r.photos;
  for (const radio of form.querySelectorAll<HTMLInputElement>('input[name=mode]')) radio.checked = radio.value === (r.mode ?? 'livre');
}

$('prompt-btn').addEventListener('click', () => {
  fillForm(loadDraft());
  promptDialog.showModal();
});
form.addEventListener('input', () => saveDraft(readForm()));
$('prompt-copy').addEventListener('click', async () => {
  const r = readForm();
  if (!r.idea.trim()) {
    (form.elements as any).idea.focus();
    toast('Escreva o que você quer construir primeiro.');
    return;
  }
  saveDraft(r);
  if (!confirmReplace()) return;
  const name = r.idea.trim().split(/[.,;\n]/)[0].slice(0, 48) || 'Novo projeto';
  project = emptyProject(name, r.mode ?? 'etapas', r);
  exampleSelect.value = '';
  persist();
  rebuild();
  const first = slotsOf(project)[0];
  const text = project.mode === 'livre' ? buildAutoPrompt(r) : buildStagePrompt(project, first, {});
  if (await copyText(text)) {
    promptDialog.close();
    toast(
      project.mode === 'livre'
        ? `Projeto criado e prompt copiado! Cole na IA${r.photos ? ' com as fotos' : ''}. Ela vai planejar as partes e mandar a parte 1: cole a resposta em "② Colar resposta da IA".`
        : project.mode === 'etapas'
        ? `Projeto criado e prompt da etapa 1 copiado! Cole na IA${r.photos ? ' com as fotos' : ''} e depois clique em "② Colar resposta da IA".`
        : `Prompt copiado! Cole na IA${r.photos ? ' com as fotos' : ''} e depois clique em "② Colar resposta da IA".`,
      6000,
    );
  }
});

// ---------- ✏️ Alterar / ampliar com a IA ----------

const editDialog = $<HTMLDialogElement>('edit-dialog');
const editForm = $<HTMLFormElement>('edit-form');
const editArea = editForm.elements.namedItem('area') as HTMLSelectElement;
const editNewChat = editForm.elements.namedItem('newchat') as HTMLInputElement;
const editRequest = editForm.elements.namedItem('request') as HTMLTextAreaElement;

/** Faixas de y (coordenadas do projeto) que dá para mostrar à IA. */
function editAreas(): { value: string; label: string; y0: number; y1: number }[] {
  if (!model) return [];
  const oy = model.offset[1];
  const all = { value: 'all', label: 'a construção inteira', y0: -oy, y1: model.size.y - 1 - oy };
  const cur = currentLayer() - oy;
  const list = [all];
  for (const [i, f] of (project?.floors ?? []).entries()) list.push({ value: `f${i}`, label: `só ${f.name} (y ${f.yFrom} a ${f.yTo})`, y0: f.yFrom, y1: f.yTo });
  list.push({ value: 'layer', label: `perto da camada atual (y ${cur - 2} a ${cur + 2})`, y0: cur - 2, y1: cur + 2 });
  list.push({ value: 'none', label: 'nada (a IA já conhece, mesma conversa)', y0: 0, y1: -1 });
  return list;
}

function updateEditSize() {
  const a = editAreas().find((x) => x.value === editArea.value);
  const chars = a && model && a.y1 >= a.y0 ? regionTextSize(model, a.y0, a.y1) : 0;
  $('edit-size').textContent = chars ? `≈ ${(chars / 1000).toFixed(0)} mil caracteres de estado${chars > 60000 ? ' (grande: prefira um andar só)' : ''}` : '';
}

$('edit-btn').addEventListener('click', () => {
  if (!model || !project) return toast('Abra ou crie um projeto primeiro.');
  editArea.innerHTML = '';
  const areas = editAreas();
  for (const a of areas) editArea.add(new Option(a.label, a.value));
  const whole = regionTextSize(model, areas[0].y0, areas[0].y1);
  // conversa nova por padrão se o projeto não nasceu no modo automático ou veio de arquivo/exemplo
  const startedHere = project.mode === 'livre' && !project.fromExample && project.parts.length > 0;
  editNewChat.checked = !startedHere;
  editArea.value = startedHere ? 'none' : whole <= 40000 ? 'all' : project.floors.length ? 'f0' : 'layer';
  updateEditSize();
  editDialog.showModal();
  editRequest.focus();
});
editArea.addEventListener('change', updateEditSize);

$('edit-copy').addEventListener('click', async () => {
  if (!model || !project || !built) return;
  const request = editRequest.value.trim();
  if (!request) {
    editRequest.focus();
    return toast('Escreva o que você quer mudar.');
  }
  const area = editAreas().find((x) => x.value === editArea.value);
  const state = area && area.y1 >= area.y0 ? regionToPromptText(model, area.y0, area.y1) : undefined;
  // a partir daqui o projeto segue no modo automático (partes numeradas)
  if (project.mode !== 'livre') {
    convertToAuto(project);
    persist();
    rebuild({ keepCamera: true });
  }
  const structure = [...built.blueprints.values()].find((b) => b.plan)?.plan;
  const msg = editMessage({
    number: nextPartNumber(project),
    request,
    state,
    newChat: editNewChat.checked,
    summary: projectSummary(project, structure?.style),
  });
  if (await copyText(msg)) {
    editDialog.close();
    editRequest.value = '';
    toast('Pedido copiado! Cole na IA e depois cole a resposta em 📥 Colar resposta: ela entra como parte nova, por cima do que já existe.', 6000);
  }
});

// fecha o menu "Salvar" depois de escolher
for (const id of ['save-btn', 'export-btn', 'shot-btn', 'share-btn', 'datapack-btn']) $(id).addEventListener('click', () => ($('save-menu') as HTMLDetailsElement).removeAttribute('open'));

// ---------- Visual: cores ou texturas do jogo ----------

const LOOK_KEY = 'fizzi-mine:visual';
let textureLib: TextureLibrary | null = null;
const packDialog = $<HTMLDialogElement>('pack-dialog');

function setLook(mode: 'cores' | 'jogo') {
  const useGame = mode === 'jogo' && !!textureLib;
  viewer.setTextures(useGame ? textureLib : null);
  $('look-colors').classList.toggle('active', !useGame);
  $('look-game').classList.toggle('active', useGame);
  try {
    localStorage.setItem(LOOK_KEY, useGame ? 'jogo' : 'cores');
  } catch {
    /* sem armazenamento */
  }
}

function updatePackStatus() {
  $('pack-status').innerHTML = textureLib
    ? `✔ Texturas carregadas: <b>${esc(textureLib.name)}</b> (${textureLib.count} texturas de bloco).`
    : 'Nenhuma textura carregada ainda.';
  $<HTMLButtonElement>('pack-forget').disabled = !textureLib;
}

$('look-colors').addEventListener('click', () => setLook('cores'));
$('look-game').addEventListener('click', () => {
  if (textureLib) return setLook('jogo');
  updatePackStatus();
  packDialog.showModal();
});
// clique com o botão direito (ou segurando) em "Texturas do jogo" abre a janela para trocar o arquivo
$('look-game').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  updatePackStatus();
  packDialog.showModal();
});

$<HTMLInputElement>('pack-input').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  $('pack-status').textContent = `Lendo ${file.name}…`;
  try {
    const pack = await readPack(file);
    textureLib = new TextureLibrary(pack);
    await savePack(pack);
    updatePackStatus();
    packDialog.close();
    setLook('jogo');
    toast(`Texturas do ${file.name} aplicadas (${pack.files.size} texturas).`, 4000);
  } catch (err) {
    $('pack-status').textContent = `⚠ ${(err as Error).message}`;
  }
});

$('pack-forget').addEventListener('click', async () => {
  await forgetPack();
  textureLib = null;
  setLook('cores');
  updatePackStatus();
  toast('Texturas esquecidas. Voltando para as cores.');
});

// ao abrir: recupera as texturas salvas no navegador
(async () => {
  const pack = await loadSavedPack();
  if (pack) textureLib = new TextureLibrary(pack);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LOOK_KEY);
  } catch {
    /* sem armazenamento */
  }
  setLook(saved === 'jogo' ? 'jogo' : 'cores');
})();

// ---------- Celular: abas de baixo ----------

function setTab(tab: string) {
  document.body.dataset.tab = tab;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.mobile-tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.mobile-tabs button')) b.addEventListener('click', () => setTab(b.dataset.tab!));
setTab('3d');

// ---------- 🔗 Link para compartilhar ----------

$('share-btn').addEventListener('click', async () => {
  if (!project) return;
  const url = shareUrl(encodeProject(exportProject(project)));
  const big = url.length > 60000 ? ' É um link grande: se o app de mensagem cortar, mande o arquivo (Salvar → Projeto).' : '';
  if (await copyText(url)) toast(`Link copiado (${(url.length / 1000).toFixed(1)} mil caracteres). Quem abrir vê este projeto.${big}`, 6000);
});

/** Abriu um link com projeto (#p=...): carrega e limpa o endereço. */
function openSharedFromHash() {
  const json = projectFromHash();
  if (!json) return false;
  history.replaceState(null, '', location.pathname + location.search);
  const shared = importProject(json);
  if (!shared) {
    toast('O link do projeto está incompleto ou corrompido.');
    return false;
  }
  if (project?.parts.length && !project.fromExample && !confirm(`Abrir o projeto compartilhado "${shared.name}"?\nO projeto atual ("${project.name}") será substituído. Se quiser guardar, cancele e use Salvar → Projeto antes.`)) return false;
  project = shared;
  persist();
  rebuild();
  toast(`Projeto compartilhado "${shared.name}" aberto.`, 4000);
  return true;
}
window.addEventListener('hashchange', openSharedFromHash);
setTimeout(openSharedFromHash, 0);

// ---------- 🎮 Datapack para construir no jogo ----------

const datapackDialog = $<HTMLDialogElement>('datapack-dialog');
let lastPack: ReturnType<typeof buildDatapack> | null = null;
$('datapack-btn').addEventListener('click', () => {
  if (!model || !project) return;
  lastPack = buildDatapack(model, project.name);
  const pack = lastPack;
  // camada inicial: a camada atual do slider, se existir no datapack
  const layerSel = $<HTMLSelectElement>('dp-layer');
  layerSel.innerHTML = '';
  for (const y of pack.layers) layerSel.add(new Option(`y = ${y}`, String(y)));
  const cur = currentLayer() - model.offset[1];
  layerSel.value = pack.layers.includes(cur) ? String(cur) : String(pack.layers[0] ?? 0);
  const fill = () => {
    for (const el of document.querySelectorAll<HTMLElement>('#datapack-dialog .dp-cmd')) {
      const fnName = el.dataset.fn === 'fantasma/' ? `fantasma/y${layerSel.value}` : el.dataset.fn;
      el.textContent = `/function ${pack.ns}/${fnName}`;
    }
  };
  layerSel.onchange = fill;
  fill();
  const big = pack.ghosts > 8000 ? ' · ⚠ fantasma grande: prefira mostrar uma camada por vez' : '';
  const many = pack.commands > 60000 ? ' · ⚠ muitos comandos para "construir" (limite 65.536)' : '';
  $('datapack-info').textContent = `${model.voxels.length.toLocaleString('pt-BR')} blocos · ${pack.ghosts.toLocaleString('pt-BR')} no fantasma · ${pack.layers.length} camadas · área ${model.size.x}×${model.size.y}×${model.size.z}${big}${many}.`;
  datapackDialog.showModal();
});
$('datapack-download').addEventListener('click', () => {
  if (lastPack) download(lastPack.fileName, URL.createObjectURL(new Blob([lastPack.zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' })));
});
// clicar num comando copia
for (const el of document.querySelectorAll<HTMLElement>('#datapack-dialog .dp-cmd')) {
  el.title = 'Clique para copiar';
  el.addEventListener('click', async () => {
    if (await copyText(el.textContent ?? '')) toast(`Copiado: ${el.textContent}`);
  });
}
