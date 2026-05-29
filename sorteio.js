/* ================================================================
   SORTEIRO PRO — JavaScript
   Modos: Roda da Sorte | Caça-Níquel | Cartas do Destino | Bolhas
   ================================================================ */

'use strict';

/* ───────────────────────────────────────────────
   ESTADO GLOBAL
─────────────────────────────────────────────── */
const state = {
  names:        [],   // todos os nomes cadastrados
  stages:       [],   // todas as etapas cadastradas
  history:      [],   // histórico de sorteios
  drawnNames:   [],   // participantes já sorteados (nunca repetem)
  drawnStages:  [],   // etapas já usadas no ciclo atual
  currentMode:  'wheel',
  isSpinning:   false,

  // Wheel
  wheelAngle:   0,
  wheelAnimId:  null,
  wheelCtx:     null,
  wheelCx: 230, wheelCy: 230, wheelR: 210,

  // Bubbles
  bubbles:      [],
  bubbleAnimId: null,
};

/* ───────────────────────────────────────────────
   CONSTANTES
─────────────────────────────────────────────── */
const WHEEL_COLORS = [
  '#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF',
  '#FF8B94','#FFA07A','#B8B8FF','#FFD93D',
  '#6BCB77','#4D96FF','#C7CEEA','#FFDAC1',
  '#B5EAD7','#FF9AA2','#E2F0CB','#98D8C8',
];
const BUBBLE_COLORS = [
  'rgba(255,107,107,.75)','rgba(78,204,163,.75)',
  'rgba(255,230,109,.75)','rgba(168,230,207,.75)',
  'rgba(184,184,255,.75)','rgba(253,121,168,.75)',
  'rgba(77,150,255,.75)','rgba(107,203,119,.75)',
];
const SAMPLE_NAMES  = ['Bruno','Lucas Marinho','Gabriel Bonfim','Lucas Correa','Henrique', 'Ryan'];
const SAMPLE_STAGES = ['Ambulatório','Emergência','Centro cirúrgico','Internação', 'Admissão', 'Estoque', 'Outros'];
const LS_KEY = 'sorteioPro_v2';

/* ───────────────────────────────────────────────
   DOM CACHE
─────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const dom = {
  themeToggle:     $('themeToggle'),
  tabBtns:         document.querySelectorAll('.tab-btn'),
  panelSetup:      $('panel-setup'),
  panelDraw:       $('panel-draw'),

  nameInput:       $('nameInput'),
  addNameBtn:      $('addNameBtn'),
  nameList:        $('nameList'),
  nameCount:       $('nameCount'),
  importNamesBtn:  $('importNamesBtn'),
  clearNamesBtn:   $('clearNamesBtn'),
  loadSampleNames: $('loadSampleNames'),

  stageInput:      $('stageInput'),
  addStageBtn:     $('addStageBtn'),
  stageList:       $('stageList'),
  stageCount:      $('stageCount'),
  clearStagesBtn:  $('clearStagesBtn'),
  loadSampleStages:$('loadSampleStages'),

  goDrawBtn:       $('goDrawBtn'),
  modeBtns:        document.querySelectorAll('.mode-btn'),

  modeWheel:       $('mode-wheel'),
  modeSlot:        $('mode-slot'),
  modeCards:       $('mode-cards'),
  modeBubbles:     $('mode-bubbles'),

  wheelCanvas:     $('wheelCanvas'),
  reelNames:       $('reelNames'),
  reelStages:      $('reelStages'),
  cardsArena:      $('cardsArena'),
  bubblesCanvas:   $('bubblesCanvas'),

  resultBox:       $('resultBox'),
  resultName:      $('resultName'),
  resultStage:     $('resultStage'),
  closeResult:     $('closeResult'),
  confettiLayer:   $('confettiLayer'),

  drawLayout:      $('drawLayout'),
  drawBtn:         $('drawBtn'),
  drawStatus:      $('drawStatus'),
  removeDrawnOpt:  $('removeDrawnOpt'),
  randomStageOpt:  $('randomStageOpt'),

  historyList:     $('historyList'),
  clearHistoryBtn: $('clearHistoryBtn'),

  importModal:     $('importModal'),
  importTextarea:  $('importTextarea'),
  closeImportModal:$('closeImportModal'),
  cancelImport:    $('cancelImport'),
  confirmImport:   $('confirmImport'),
};

/* ================================================================
   PERSISTÊNCIA (localStorage)
   ================================================================ */
function saveState() {
  try {
    const data = {
      names:   state.names,
      stages:  state.stages,
      history: state.history.slice(0, 100),
      drawnNames: state.drawnNames,
      drawnStages: state.drawnStages,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch(_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.names       = data.names       || [];
    state.stages      = data.stages      || [];
    state.history     = data.history     || [];
    state.drawnNames  = data.drawnNames  || [];
    state.drawnStages = data.drawnStages || [];
    syncDrawnFromHistory();
  } catch(_) {}
}

/** Garante que participantes do histórico não voltem ao pool */
function syncDrawnFromHistory() {
  state.history.forEach(h => {
    if (h.name && !state.drawnNames.includes(h.name)) state.drawnNames.push(h.name);
  });
  if (!state.drawnStages.length) {
    state.history.forEach(h => {
      if (h.stage && h.stage !== '—' && !state.drawnStages.includes(h.stage)) {
        state.drawnStages.push(h.stage);
      }
    });
  }
}

/* ================================================================
   TEMA
   ================================================================ */
function initTheme() {
  const saved = localStorage.getItem('sorteioPro_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sorteioPro_theme', next);
  // Redraw canvas-based modes
  if (state.currentMode === 'wheel') drawWheel();
}

/* ================================================================
   TABS
   ================================================================ */
function switchTab(tab) {
  dom.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  dom.panelSetup.classList.toggle('hidden', tab !== 'setup');
  dom.panelDraw .classList.toggle('hidden', tab !== 'draw');
  if (tab === 'draw') setTimeout(initCurrentMode, 80);
}

/* ================================================================
   NOMES — Gerenciamento
   ================================================================ */
function addName(raw) {
  const name = (raw ?? dom.nameInput.value).trim();
  if (!name) return;
  if (state.names.includes(name)) {
    dom.nameInput.classList.add('shake');
    setTimeout(() => dom.nameInput.classList.remove('shake'), 350);
    return;
  }
  state.names.push(name);
  dom.nameInput.value = '';
  renderNames();
  animateBadge(dom.nameCount);
  updateDrawBtn();
  if (state.currentMode === 'wheel') drawWheel();
  saveState();
}

function removeName(idx) {
  state.names.splice(idx, 1);
  state.drawnNames = state.drawnNames.filter(n => state.names.includes(n));
  renderNames();
  updateDrawBtn();
  if (state.currentMode === 'wheel') drawWheel();
  saveState();
}

function startEditName(idx, rowEl) {
  const span = rowEl.querySelector('.item-name');
  span.contentEditable = 'true';
  span.focus();
  selectAll(span);

  const finish = () => {
    const val = span.textContent.trim();
    span.contentEditable = 'false';
    if (val && val !== state.names[idx] && !state.names.includes(val)) {
      state.names[idx] = val;
      if (state.currentMode === 'wheel') drawWheel();
      saveState();
    } else {
      span.textContent = state.names[idx];
    }
    updateDrawBtn();
  };

  span.addEventListener('blur',  finish, { once: true });
  span.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); span.blur(); }
    if (e.key === 'Escape') { span.textContent = state.names[idx]; span.blur(); }
  });
}

function renderNames() {
  dom.nameCount.textContent = state.names.length;

  if (state.names.length === 0) {
    dom.nameList.innerHTML = `
      <div class="list-empty">
        <span>🧑</span>
        <p>Nenhum participante ainda.<br>Adicione nomes acima!</p>
        <button class="link-btn sample-btn" id="loadSampleNames">Carregar exemplos</button>
      </div>`;
    $('loadSampleNames').addEventListener('click', loadSampleNamesHandler);
    return;
  }

  dom.nameList.innerHTML = state.names.map((n, i) => `
    <div class="list-item" data-idx="${i}">
      <span class="item-num">${i + 1}</span>
      <span class="item-name">${esc(n)}</span>
      <div class="item-actions">
        <button class="icon-btn" title="Editar" onclick="startEditName(${i}, this.closest('.list-item'))">✏️</button>
        <button class="icon-btn del" title="Remover" onclick="removeName(${i})">🗑️</button>
      </div>
    </div>`).join('');
}

/* ================================================================
   ETAPAS — Gerenciamento
   ================================================================ */
function addStage(raw) {
  const stage = (raw ?? dom.stageInput.value).trim();
  if (!stage) return;
  state.stages.push(stage);
  dom.stageInput.value = '';
  renderStages();
  animateBadge(dom.stageCount);
  updateDrawBtn();
  saveState();
}

function removeStage(idx) {
  state.stages.splice(idx, 1);
  renderStages();
  updateDrawBtn();
  saveState();
}

function startEditStage(idx, rowEl) {
  const span = rowEl.querySelector('.item-name');
  span.contentEditable = 'true';
  span.focus();
  selectAll(span);

  const finish = () => {
    const val = span.textContent.trim();
    span.contentEditable = 'false';
    if (val) { state.stages[idx] = val; saveState(); }
    else { span.textContent = state.stages[idx]; }
    renderStages();
    updateDrawBtn();
  };

  span.addEventListener('blur',  finish, { once: true });
  span.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); span.blur(); }
    if (e.key === 'Escape') { span.textContent = state.stages[idx]; span.blur(); }
  });
}

function renderStages() {
  dom.stageCount.textContent = state.stages.length;

  if (state.stages.length === 0) {
    dom.stageList.innerHTML = `
      <div class="list-empty">
        <span>📝</span>
        <p>Nenhuma etapa ainda.<br>Adicione etapas acima!</p>
        <button class="link-btn sample-btn" id="loadSampleStages">Carregar exemplos</button>
      </div>`;
    $('loadSampleStages').addEventListener('click', loadSampleStagesHandler);
    return;
  }

  dom.stageList.innerHTML = state.stages.map((s, i) => `
    <div class="list-item" data-idx="${i}">
      <span class="item-num">${i + 1}</span>
      <span class="item-name">${esc(s)}</span>
      <div class="item-actions">
        <button class="icon-btn" title="Editar" onclick="startEditStage(${i}, this.closest('.list-item'))">✏️</button>
        <button class="icon-btn del" title="Remover" onclick="removeStage(${i})">🗑️</button>
      </div>
    </div>`).join('');
}

/* ================================================================
   POOL DE SORTEIO
   ================================================================ */
/** Participantes ainda elegíveis (nunca repetem após sorteados) */
function getPool() {
  return state.names.filter(n => !state.drawnNames.includes(n));
}

/** Nomes exibidos na roda/bolhas: todos ou só os restantes */
function getDisplayNames() {
  if (dom.removeDrawnOpt.checked) return getPool();
  return [...state.names];
}

function getAvailableStages() {
  let available = state.stages.filter(s => !state.drawnStages.includes(s));
  if (available.length === 0 && state.stages.length > 0) {
    state.drawnStages = [];
    available = [...state.stages];
  }
  return available;
}

function pickStage() {
  const available = getAvailableStages();
  if (available.length === 0) return '—';
  if (dom.randomStageOpt.checked) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return available[0];
}

/** Etapas únicas para sorteio em lote (cartas) */
function pickUniqueStages(count) {
  const stages = [];
  let available = getAvailableStages();
  for (let i = 0; i < count; i++) {
    if (available.length === 0) {
      state.drawnStages = [];
      available = [...state.stages];
    }
    if (available.length === 0) {
      stages.push('—');
      continue;
    }
    const idx = dom.randomStageOpt.checked
      ? Math.floor(Math.random() * available.length)
      : 0;
    stages.push(available.splice(idx, 1)[0]);
  }
  return stages;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateDrawLayout() {
  dom.drawLayout.classList.toggle('layout-cards', state.currentMode === 'cards');
}

function updateDrawBtn() {
  const pool = getPool();
  const isCards = state.currentMode === 'cards';
  const ready = state.names.length > 0 && state.stages.length > 0 && pool.length > 0 && !state.isSpinning;
  dom.drawBtn.disabled = !ready;

  const btnText = dom.drawBtn.querySelector('.btn-draw-text');
  if (btnText) btnText.textContent = isCards && pool.length > 0 ? 'REVELAR TODAS!' : 'SORTEAR!';

  if (state.names.length  === 0) { dom.drawStatus.textContent = 'Adicione participantes para sortear'; return; }
  if (state.stages.length === 0) { dom.drawStatus.textContent = 'Adicione etapas para sortear'; return; }
  if (pool.length         === 0) { dom.drawStatus.textContent = 'Todos sorteados! Limpe o histórico para reiniciar.'; return; }
  if (isCards) {
    dom.drawStatus.textContent = `${pool.length} carta(s) — sorteio único de todos os participantes restantes`;
    return;
  }
  const opt = dom.removeDrawnOpt.checked ? ' • sorteados removidos da visualização' : '';
  dom.drawStatus.textContent = `${pool.length} participante(s) restante(s) • ${state.stages.length} etapa(s)${opt}`;
}

/* ================================================================
   RESULTADO + HISTÓRICO
   ================================================================ */
function recordDraw(name, stage) {
  if (!state.drawnNames.includes(name)) state.drawnNames.push(name);
  if (stage && stage !== '—' && !state.drawnStages.includes(stage)) {
    state.drawnStages.push(stage);
  }
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  state.history.unshift({ name, stage, time });
}

function showResult(name, stage, { silent = false } = {}) {
  recordDraw(name, stage);
  renderHistory();
  updateDrawBtn();
  saveState();

  if (silent || state.currentMode === 'cards') return;

  dom.resultName.textContent  = name;
  dom.resultStage.textContent = stage;
  dom.resultBox.classList.remove('hidden');
  fireConfetti();
}

function showResultsBatch(pairs) {
  pairs.forEach(({ name, stage }) => recordDraw(name, stage));
  renderHistory();
  updateDrawBtn();
  saveState();
  dom.resultBox.classList.add('hidden');
}

function renderHistory() {
  if (state.history.length === 0) {
    dom.historyList.innerHTML = '<div class="history-empty">Nenhum sorteio realizado ainda...</div>';
    return;
  }
  dom.historyList.innerHTML = state.history.map((h, i) => `
    <div class="history-item">
      <span class="h-num">#${state.history.length - i}</span>
      <span class="h-name">${esc(h.name)}</span>
      <span class="h-arrow">→</span>
      <span class="h-stage">${esc(h.stage)}</span>
      <span class="h-time">${h.time}</span>
    </div>`).join('');
}

function fireConfetti() {
  const el   = dom.confettiLayer;
  const colors = ['#ff6b35','#4ecca3','#ffe66d','#ff6b6b','#b8b8ff','#fd79a8','#6bcb77','#4d96ff'];
  el.innerHTML = '';
  for (let i = 0; i < 55; i++) {
    const bit = document.createElement('div');
    const sz  = 5 + Math.random() * 9;
    const dur = 1.4 + Math.random() * 1.8;
    bit.className = 'confetti-bit';
    bit.style.cssText = `
      left:${Math.random()*100}%;
      width:${sz}px; height:${sz}px;
      border-radius:${Math.random() > .45 ? '50%' : '3px'};
      background:${colors[i % colors.length]};
      animation-duration:${dur}s;
      animation-delay:${Math.random()*.45}s;
    `;
    el.appendChild(bit);
  }
}

/* ================================================================
   TROCA DE MODO
   ================================================================ */
function switchMode(mode) {
  state.currentMode = mode;
  dom.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  if (state.bubbleAnimId) { cancelAnimationFrame(state.bubbleAnimId); state.bubbleAnimId = null; }

  [dom.modeWheel, dom.modeSlot, dom.modeCards, dom.modeBubbles].forEach(el => el.classList.add('hidden'));
  $(`mode-${mode}`).classList.remove('hidden');

  updateDrawLayout();
  if (mode !== 'cards') dom.resultBox.classList.add('hidden');

  setTimeout(initCurrentMode, 60);
  updateDrawBtn();
}

function initCurrentMode() {
  switch (state.currentMode) {
    case 'wheel':   initWheel();   break;
    case 'slot':    initSlot();    break;
    case 'cards':   initCards();   break;
    case 'bubbles': initBubbles(); break;
  }
}

/* ================================================================
   MODO 1 — RODA DA SORTE (Canvas)
   ================================================================ */
function initWheel() {
  const canvas = dom.wheelCanvas;
  const wrap   = canvas.parentElement;
  const size   = Math.min(wrap.offsetWidth - 20, 460);
  canvas.width  = size;
  canvas.height = size;
  state.wheelCtx = canvas.getContext('2d');
  state.wheelCx  = size / 2;
  state.wheelCy  = size / 2;
  state.wheelR   = size / 2 - 16;
  drawWheel();
}

function drawWheel() {
  const { wheelCtx: ctx, wheelCx: cx, wheelCy: cy, wheelR: R, wheelAngle } = state;
  const names = getDisplayNames();
  if (!ctx) return;

  const W = cx * 2;
  ctx.clearRect(0, 0, W, W);

  if (names.length === 0) {
    ctx.fillStyle = isDark() ? '#7777aa' : '#666688';
    ctx.font = 'bold 16px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Adicione participantes!', cx, cy);
    return;
  }

  const n     = names.length;
  const slice = (2 * Math.PI) / n;

  // Brilho externo
  const glow = ctx.createRadialGradient(cx, cy, R - 10, cx, cy, R + 28);
  glow.addColorStop(0, 'rgba(255,107,53,.22)');
  glow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, R + 28, 0, 2 * Math.PI);
  ctx.fillStyle = glow;
  ctx.fill();

  // Segmentos
  for (let i = 0; i < n; i++) {
    const a0  = wheelAngle - Math.PI / 2 + i * slice;
    const a1  = a0 + slice;
    const mid = a0 + slice / 2;
    const col = WHEEL_COLORS[i % WHEEL_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    ctx.strokeStyle = isDark() ? 'rgba(9,9,20,.65)' : 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Texto
    const raw = names[i];
    const maxC = Math.max(6, Math.floor(180 / Math.max(n, 1)));
    const label = raw.length > maxC ? raw.slice(0, maxC) + '…' : raw;
    const fSize = Math.max(9, Math.min(16, (2 * Math.PI * R / n) * .34));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'right';
    ctx.fillStyle = isLight(col) ? '#111' : '#fff';
    ctx.font = `bold ${fSize}px Nunito, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur  = 5;
    ctx.fillText(label, R - 12, fSize * .36);
    ctx.restore();
  }

  // Anel decorativo
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, 2 * Math.PI);
  ctx.strokeStyle = '#FFE66D';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Bolinhas no anel
  const dots = Math.min(n * 3, 48);
  for (let i = 0; i < dots; i++) {
    const a = wheelAngle - Math.PI / 2 + (i / dots) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(cx + (R + 6) * Math.cos(a), cy + (R + 6) * Math.sin(a), 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = i % 2 === 0 ? '#FFE66D' : '#FF6B35';
    ctx.fill();
  }

  // Hub central
  const hub = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 34);
  hub.addColorStop(0, '#fff');
  hub.addColorStop(.5, '#FFE66D');
  hub.addColorStop(1, '#FF6B35');
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, 2 * Math.PI);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.strokeStyle = isDark() ? '#090914' : '#fff';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.shadowBlur = 0;
  ctx.font = '21px serif';
  ctx.fillText('🎲', cx, cy + 8);
}

function spinWheel(targetIdx, segmentCount) {
  const n     = segmentCount;
  const slice = (2 * Math.PI) / n;

  const fullSpins  = (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
  const slotAngle  = -(targetIdx * slice + slice / 2);
  const normalized = ((slotAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const curNorm    = ((state.wheelAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let   delta      = normalized - curNorm;
  if (delta <= 0) delta += 2 * Math.PI;

  const finalAngle = state.wheelAngle + fullSpins + delta;
  const duration   = 4500 + Math.random() * 2000;
  const startAngle = state.wheelAngle;
  const startTime  = performance.now();

  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    // easeOutCubic
    const ease = 1 - Math.pow(1 - t, 3);
    state.wheelAngle = startAngle + (finalAngle - startAngle) * ease;
    drawWheel();

    if (t < 1) {
      state.wheelAnimId = requestAnimationFrame(tick);
    } else {
      state.wheelAngle  = finalAngle;
      state.wheelAnimId = null;
      state.isSpinning  = false;
      dom.modeWheel.classList.remove('spinning');
      const display = getDisplayNames();
      const winner = display[targetIdx];
      const stage  = pickStage();
      setTimeout(() => showResult(winner, stage), 420);
    }
  }
  state.wheelAnimId = requestAnimationFrame(tick);
}

function startWheelDraw() {
  const pool = getPool();
  if (!pool.length) return;
  const display = getDisplayNames();
  if (!display.length) return;
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const targetIdx = display.indexOf(winner);
  if (targetIdx === -1) return;
  dom.modeWheel.classList.add('spinning');
  spinWheel(targetIdx, display.length);
}

/* ================================================================
   MODO 2 — CAÇA-NÍQUEL (DOM scroll)
   ================================================================ */
function initSlot() {
  buildReel(dom.reelNames,  getDisplayNames(), 15);
  buildReel(dom.reelStages, state.stages, 15);
}

function buildReel(reelEl, items, reps) {
  if (items.length === 0) {
    reelEl.innerHTML = '<div class="slot-item">—</div>';
    return;
  }
  const all = [];
  for (let r = 0; r < reps; r++) items.forEach(x => all.push(x));
  reelEl.innerHTML = all.map(x => `<div class="slot-item">${esc(x)}</div>`).join('');
  reelEl.style.transition = 'none';
  reelEl.style.transform  = `translateY(-${4 * items.length * 96}px)`;
  reelEl.classList.remove('stopped');
}

function spinReel(reelEl, items, target, delay) {
  return new Promise(resolve => {
    if (!items.length || !target) { resolve(); return; }
    const idx  = items.indexOf(target);
    if (idx === -1) { resolve(); return; }
    const itemH = 96;
    const endY  = (10 * items.length + idx) * itemH;
    setTimeout(() => {
      const dur = 1800 + Math.random() * 1200;
      reelEl.style.transition = `transform ${dur}ms cubic-bezier(.12,.85,.18,1)`;
      reelEl.style.transform  = `translateY(-${endY}px)`;
      setTimeout(() => {
        reelEl.classList.add('stopped');
        resolve();
      }, dur + 120);
    }, delay);
  });
}

async function startSlotDraw() {
  const pool = getPool();
  if (!pool.length) {
    state.isSpinning = false;
    updateDrawBtn();
    return;
  }
  const displayNames = getDisplayNames();
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const stage  = pickStage();

  buildReel(dom.reelNames,  displayNames, 15);
  buildReel(dom.reelStages, state.stages, 15);
  await sleep(80);

  await Promise.all([
    spinReel(dom.reelNames,  displayNames, winner, 0),
    spinReel(dom.reelStages, state.stages, stage,  400),
  ]);

  state.isSpinning = false;
  showResult(winner, stage);
}

/* ================================================================
   MODO 3 — CARTAS DO DESTINO
   ================================================================ */
function initCards() {
  const pool  = getPool();
  const count = pool.length;

  dom.cardsArena.innerHTML = '';
  if (count === 0) {
    dom.cardsArena.innerHTML = '<p class="cards-empty-msg">Todos os participantes já foram sorteados.</p>';
    return;
  }

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'destiny-card';
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back-face">🎴</div>
        <div class="card-face card-front-face">
          <div class="card-winner-name" id="cwn-${i}">?</div>
          <div class="card-winner-arrow">↓</div>
          <div class="card-winner-stage" id="cws-${i}">?</div>
        </div>
      </div>`;
    dom.cardsArena.appendChild(card);
  }
}

async function startCardsDraw() {
  const pool = getPool();
  if (!pool.length) {
    state.isSpinning = false;
    updateDrawBtn();
    return;
  }

  const cards = [...dom.cardsArena.querySelectorAll('.destiny-card')];
  if (cards.length !== pool.length) {
    initCards();
    return startCardsDraw();
  }

  const names  = shuffleArray(pool);
  const stages = pickUniqueStages(names.length);
  const pairs  = names.map((name, i) => ({ name, stage: stages[i] }));

  cards.forEach(c => {
    c.classList.remove('flipped', 'winner-card');
    c.style.transform = '';
  });

  cards.forEach((c, i) => {
    c.classList.add('card-shuffling');
    c.style.animationDelay = `${i * 35}ms`;
  });
  await sleep(600);
  cards.forEach(c => c.classList.remove('card-shuffling'));

  pairs.forEach((p, i) => {
    const elN = $(`cwn-${i}`);
    const elS = $(`cws-${i}`);
    if (elN) elN.textContent = p.name;
    if (elS) elS.textContent = p.stage;
  });

  for (let i = 0; i < cards.length; i++) {
    cards[i].classList.add('flipped');
    await sleep(120);
  }
  await sleep(400);
  cards.forEach(c => c.classList.add('winner-card'));

  state.isSpinning = false;
  showResultsBatch(pairs);
  initCards();
}

/* ================================================================
   MODO 4 — BOLHAS MÁGICAS (Canvas)
   ================================================================ */
function initBubbles() {
  const canvas = dom.bubblesCanvas;
  const parent = canvas.parentElement;
  const W = parent.offsetWidth  || 600;
  const H = 400;
  canvas.width  = W;
  canvas.height = H;

  const display = getDisplayNames();
  state.bubbles = display.map((name, i) => ({
    name,
    x:  60 + Math.random() * (W - 120),
    y:  60 + Math.random() * (H - 120),
    r:  Math.min(50 + name.length * 2.5, 74),
    vx: (Math.random() - .5) * 1.6,
    vy: (Math.random() - .5) * 1.6,
    color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
    pulse: Math.random() * Math.PI * 2,
    popping:  false,
    popT:     0,
    isWinner: false,
    alpha: 1,
  }));

  if (state.bubbleAnimId) cancelAnimationFrame(state.bubbleAnimId);
  tickBubbles();
}

function tickBubbles() {
  const canvas = dom.bubblesCanvas;
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  let anyAlive = false;

  state.bubbles.forEach(b => {
    if (b.alpha <= 0) return;
    anyAlive = true;

    if (b.popping) {
      b.popT = Math.min(b.popT + .055, 1);
      b.alpha = 1 - b.popT;
      // Partículas de explosão
      for (let i = 0; i < 8; i++) {
        const a   = (i / 8) * Math.PI * 2;
        const dist = b.r * b.popT * 2.5;
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a)*dist, b.y + Math.sin(a)*dist, 5 * (1 - b.popT), 0, Math.PI*2);
        ctx.fillStyle = b.color.replace('.75)', `${(1-b.popT).toFixed(2)})`);
        ctx.fill();
      }
      return;
    }

    if (!b.isWinner) {
      b.x += b.vx; b.y += b.vy;
      b.pulse += .032;
      if (b.x - b.r < 0 || b.x + b.r > W) b.vx *= -1;
      if (b.y - b.r < 0 || b.y + b.r > H) b.vy *= -1;
      b.x = Math.max(b.r, Math.min(W - b.r, b.x));
      b.y = Math.max(b.r, Math.min(H - b.r, b.y));
    } else {
      // Winner vai pro centro suavemente
      b.x += (W/2 - b.x) * .07;
      b.y += (H/2 - b.y) * .07;
      b.pulse += .06;
    }

    const pr = b.r + Math.sin(b.pulse) * 4;

    // Halo vencedor
    if (b.isWinner) {
      const halo = ctx.createRadialGradient(b.x, b.y, pr, b.x, b.y, pr + 22 + Math.sin(b.pulse*2)*6);
      halo.addColorStop(0, 'rgba(255,230,109,.5)');
      halo.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(b.x, b.y, pr + 28, 0, Math.PI*2);
      ctx.fillStyle = halo;
      ctx.fill();
    }

    // Bolha
    const grad = ctx.createRadialGradient(b.x - pr*.3, b.y - pr*.3, pr*.08, b.x, b.y, pr);
    grad.addColorStop(0, 'rgba(255,255,255,.5)');
    grad.addColorStop(.5, b.color);
    grad.addColorStop(1, b.color.replace('.75)', '.95)'));
    ctx.globalAlpha = b.alpha;
    ctx.beginPath();
    ctx.arc(b.x, b.y, pr, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Brilho
    ctx.beginPath();
    ctx.arc(b.x - pr*.28, b.y - pr*.28, pr*.28, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fill();

    // Texto
    const maxC = Math.max(4, Math.floor(pr / 9));
    const lbl  = b.name.length > maxC ? b.name.slice(0, maxC) + '…' : b.name;
    const fSize= Math.max(9, Math.min(15, pr / 3.2));
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fSize}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur  = 5;
    ctx.fillText(lbl, b.x, b.y + fSize * .36);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });

  if (anyAlive) state.bubbleAnimId = requestAnimationFrame(tickBubbles);
}

async function startBubblesDraw() {
  const pool = getPool();
  if (!pool.length) {
    state.isSpinning = false;
    updateDrawBtn();
    return;
  }
  const winner = pool[Math.floor(Math.random() * pool.length)];
  const stage  = pickStage();

  state.bubbles.forEach((b, i) => {
    if (b.name !== winner) {
      setTimeout(() => { b.popping = true; }, i * 180 + 200);
    }
  });

  const totalPop = state.bubbles.length * 180 + 700;
  await sleep(totalPop);

  const wb = state.bubbles.find(b => b.name === winner);
  if (wb) {
    wb.isWinner = true;
    wb.vx = 0; wb.vy = 0;
    wb.r = 75;
  }

  await sleep(700);
  state.isSpinning = false;
  showResult(winner, stage);
}

/* ================================================================
   BOTÃO SORTEAR — Despachante central
   ================================================================ */
function handleDraw() {
  if (state.isSpinning) return;
  const pool = getPool();
  if (!pool.length) return;

  state.isSpinning = true;
  if (state.currentMode !== 'cards') dom.resultBox.classList.add('hidden');
  dom.drawBtn.disabled = true;

  if (state.currentMode === 'cards') initCards();

  switch (state.currentMode) {
    case 'wheel':   startWheelDraw();  break;
    case 'slot':    startSlotDraw();   break;
    case 'cards':   startCardsDraw();  break;
    case 'bubbles': startBubblesDraw(); break;
  }
}

/* ================================================================
   MODAL DE IMPORTAÇÃO
   ================================================================ */
function openImport()  { dom.importModal.classList.remove('hidden'); dom.importTextarea.focus(); }
function closeImport() { dom.importModal.classList.add('hidden'); dom.importTextarea.value = ''; }

function confirmImport() {
  const lines = dom.importTextarea.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !state.names.includes(l));
  lines.forEach(n => state.names.push(n));
  renderNames();
  animateBadge(dom.nameCount);
  updateDrawBtn();
  if (state.currentMode === 'wheel') drawWheel();
  saveState();
  closeImport();
}

/* ================================================================
   EXEMPLOS
   ================================================================ */
function loadSampleNamesHandler() {
  SAMPLE_NAMES.forEach(n => {
    if (!state.names.includes(n)) {
      state.names.push(n);
    }
  });

  renderNames();
  updateDrawBtn();

  if (state.currentMode === 'wheel') {
    drawWheel();
  }

  saveState();
}

function loadSampleStagesHandler() {
  SAMPLE_STAGES.forEach(s => {
    if (!state.stages.includes(s)) {
      state.stages.push(s);
    }
  });

  renderStages();
  updateDrawBtn();
  saveState();
}


/* ================================================================
   UTILITÁRIOS
   ================================================================ */
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isDark()  { return document.documentElement.getAttribute('data-theme') === 'dark'; }
function isLight(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 > 145;
}
function selectAll(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function animateBadge(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 400);
}

/* ================================================================
   EVENTOS
   ================================================================ */
function bindEvents() {
  // Tema
  dom.themeToggle.addEventListener('click', toggleTheme);

  // Tabs
  dom.tabBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  dom.goDrawBtn.addEventListener('click', () => switchTab('draw'));

  // Nomes
  dom.addNameBtn.addEventListener('click', () => addName());
  dom.nameInput .addEventListener('keydown', e => e.key === 'Enter' && addName());
  dom.clearNamesBtn.addEventListener('click', () => {
    if (!state.names.length || !confirm('Limpar todos os participantes?')) return;
    state.names = []; state.drawnNames = [];
    renderNames(); updateDrawBtn();
    if (state.currentMode === 'wheel') drawWheel();
    saveState();
  });
  dom.importNamesBtn.addEventListener('click', openImport);

  // Etapas
  dom.addStageBtn.addEventListener('click', () => addStage());
  dom.stageInput .addEventListener('keydown', e => e.key === 'Enter' && addStage());
  dom.clearStagesBtn.addEventListener('click', () => {
    if (!state.stages.length || !confirm('Limpar todas as etapas?')) return;
    state.stages = [];
    renderStages(); updateDrawBtn(); saveState();
  });

  // Amostras (podem não existir se a lista já tiver itens)
  document.addEventListener('click', e => {
    if (e.target.id === 'loadSampleNames')  loadSampleNamesHandler();
    if (e.target.id === 'loadSampleStages') loadSampleStagesHandler();
  });

  // Modos
  dom.modeBtns.forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));

  // Sortear
  dom.drawBtn.addEventListener('click', handleDraw);

  // Fechar resultado
  dom.closeResult.addEventListener('click', () => dom.resultBox.classList.add('hidden'));

  // Histórico
  dom.clearHistoryBtn.addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm('Limpar histórico e liberar todos os sorteados?')) return;
    state.history = [];
    state.drawnNames = [];
    state.drawnStages = [];
    renderHistory();
    updateDrawBtn();
    saveState();
    initCurrentMode();
  });

  dom.removeDrawnOpt.addEventListener('change', () => {
    updateDrawBtn();
    if (state.currentMode === 'wheel')   drawWheel();
    if (state.currentMode === 'slot')    initSlot();
    if (state.currentMode === 'bubbles') initBubbles();
    if (state.currentMode === 'cards')   initCards();
  });
  dom.randomStageOpt.addEventListener('change', updateDrawBtn);

  // Modal de importação
  dom.closeImportModal.addEventListener('click', closeImport);
  dom.cancelImport    .addEventListener('click', closeImport);
  dom.confirmImport   .addEventListener('click', confirmImport);
  dom.importModal     .addEventListener('click', e => { if (e.target === dom.importModal) closeImport(); });
  dom.importTextarea  .addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.ctrlKey) confirmImport();
  });

  // Redimensionamento
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.currentMode === 'wheel')   initWheel();
      if (state.currentMode === 'bubbles') initBubbles();
    }, 220);
  });
}

/* ================================================================
   INICIALIZAÇÃO
   ================================================================ */
function init() {
  loadState();
  initTheme();
  bindEvents();
  renderNames();
  renderStages();
  renderHistory();
  updateDrawLayout();
  updateDrawBtn();
}

document.addEventListener('DOMContentLoaded', init);

// Expõe ao HTML (onclick inline)
window.removeName     = removeName;
window.startEditName  = startEditName;
window.removeStage    = removeStage;
window.startEditStage = startEditStage;
