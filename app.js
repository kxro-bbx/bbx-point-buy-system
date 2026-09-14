const CONFIG = window.BBX_CONFIG || {};
const state = {
  blades: [],
  selected: [null, null, null],
  budget: Number(CONFIG.DEFAULT_BUDGET || 18),
  activeSlot: 0,
};

const el = (id) => document.getElementById(id);
const slotsEl = el('slots');
const modal = el('bladeModal');
const bladeList = el('bladeList');
const search = el('bladeSearch');

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && quoted && n === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

function normalizeRows(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(x => String(x).trim().toLowerCase());
  const bladeIdx = header.findIndex(x => x === 'blade' || x.includes('beyblade'));
  const pointsIdx = header.findIndex(x => x === 'kosten' || x.includes('punkt'));
  if (bladeIdx < 0 || pointsIdx < 0) throw new Error('Spalten Blade/Kosten nicht gefunden.');
  return rows.slice(1)
    .map(r => ({ name: String(r[bladeIdx] || '').trim(), points: Number(String(r[pointsIdx] || '').replace(',', '.')) }))
    .filter(x => x.name && Number.isFinite(x.points))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'de'));
}

async function loadData() {
  const remote = String(CONFIG.SHEET_CSV_URL || '').trim();
  if (remote) {
    try {
      const res = await fetch(remote, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.blades = normalizeRows(parseCSV(await res.text()));
      el('dataStatus').textContent = 'Live aus Spreadsheet';
      return;
    } catch (err) {
      console.warn('Spreadsheet konnte nicht geladen werden, Snapshot wird genutzt:', err);
      el('dataStatus').textContent = 'Snapshot (Live-Quelle nicht erreichbar)';
    }
  }
  const local = await fetch('data/blades.json', { cache: 'no-store' });
  state.blades = await local.json();
  if (!remote) el('dataStatus').textContent = 'Stand: BBX - Point Buy Meta';
}

function renderSlots() {
  slotsEl.innerHTML = '';
  state.selected.forEach((blade, index) => {
    const row = document.createElement('div');
    row.className = 'slot' + (blade ? ' filled' : '');
    row.innerHTML = `
      <div class="slot-index">${index + 1}</div>
      <div class="slot-main" data-slot="${index}"><div class="slot-name">${blade ? escapeHtml(blade.name) : 'Blade wählen'}</div></div>
      <div class="slot-points">${blade ? blade.points + ' P' : '–'}</div>
      <button class="slot-remove" data-remove="${index}" title="Slot leeren">${blade ? '×' : '›'}</button>`;
    slotsEl.appendChild(row);
  });
  slotsEl.querySelectorAll('[data-slot]').forEach(n => n.addEventListener('click', () => openModal(Number(n.dataset.slot))));
  slotsEl.querySelectorAll('[data-remove]').forEach(n => n.addEventListener('click', () => {
    const i = Number(n.dataset.remove);
    if (state.selected[i]) { state.selected[i] = null; update(); }
    else openModal(i);
  }));
}

function update() {
  renderSlots();
  const chosen = state.selected.filter(Boolean);
  const total = chosen.reduce((sum, b) => sum + Number(b.points), 0);
  el('usedPoints').textContent = total;
  el('budgetDisplay').textContent = state.budget;
  el('selectedCount').textContent = chosen.length;
  el('bladeCount').textContent = state.blades.length;
  const percent = Math.min(100, (total / state.budget) * 100);
  const bar = el('progressBar');
  bar.style.width = `${percent}%`;
  bar.classList.toggle('over', total > state.budget);

  const msg = el('budgetMessage');
  msg.className = 'budget-message';
  if (total > state.budget) {
    msg.textContent = `${total - state.budget} Punkte über dem Budget.`;
    msg.classList.add('error');
  } else if (chosen.length === 3) {
    msg.textContent = total === state.budget ? 'Perfekt – Budget exakt genutzt.' : `${state.budget - total} Punkte übrig. Deck ist gültig.`;
    msg.classList.add('ok');
  } else {
    msg.textContent = `${3 - chosen.length} Blade${chosen.length === 2 ? '' : 's'} noch auswählen.`;
  }
  renderChart();
}


function setBudget(value, sourceButton = null) {
  state.budget = Math.max(1, Math.min(Number(CONFIG.MAX_BUDGET || 28), Number(value) || 18));
  document.querySelectorAll('#budgetPresets button').forEach(b => b.classList.remove('active'));
  if (sourceButton) sourceButton.classList.add('active');
  el('customBudget').value = state.budget;
  update();
  history.replaceState(null, '', `#${state.budget}`);
}

function openModal(slot) {
  state.activeSlot = slot;
  search.value = '';
  renderBladeList('');
  modal.hidden = false;
  setTimeout(() => search.focus(), 20);
}
function closeModal() { modal.hidden = true; }

function renderBladeList(query) {
  const q = query.trim().toLowerCase();
  const selectedNames = new Set(state.selected.filter(Boolean).map(b => b.name));
  bladeList.innerHTML = '';
  state.blades.filter(b => !q || b.name.toLowerCase().includes(q)).forEach(blade => {
    const btn = document.createElement('button');
    btn.className = 'blade-option';
    btn.disabled = selectedNames.has(blade.name) && state.selected[state.activeSlot]?.name !== blade.name;
    btn.innerHTML = `<span>${escapeHtml(blade.name)}</span><span class="points">${blade.points} P</span>`;
    btn.addEventListener('click', () => {
      state.selected[state.activeSlot] = blade;
      closeModal(); update();
    });
    bladeList.appendChild(btn);
  });
}

function renderChart() {
  const counts = new Map();
  state.blades.forEach(b => counts.set(b.points, (counts.get(b.points) || 0) + 1));
  const levels = [...counts.keys()].sort((a,b) => b-a);
  const max = Math.max(...counts.values(), 1);
  el('distributionChart').innerHTML = levels.map(level => `
    <div class="bar-row">
      <div class="bar-label">${level} P</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(counts.get(level)/max)*100}%"></div></div>
      <div class="bar-value">${counts.get(level)}</div>
    </div>`).join('');
}

function randomDeck() {
  const shuffled = [...state.blades].sort(() => Math.random() - 0.5);
  for (let tries = 0; tries < 2000; tries++) {
    const a = shuffled[Math.floor(Math.random() * shuffled.length)];
    const b = shuffled[Math.floor(Math.random() * shuffled.length)];
    const c = shuffled[Math.floor(Math.random() * shuffled.length)];
    if (new Set([a.name,b.name,c.name]).size === 3 && a.points + b.points + c.points <= state.budget) {
      state.selected = [a,b,c]; update(); return;
    }
  }
  showToast('Kein passendes Zufallsdeck gefunden.');
}


function maxDeck() {
  if (state.blades.length < 3) return showToast('Zu wenige Blades geladen.');
  const blades = [...state.blades];
  let best = null;
  let bestTotal = -1;
  for (let i = 0; i < blades.length - 2; i++) {
    for (let j = i + 1; j < blades.length - 1; j++) {
      for (let k = j + 1; k < blades.length; k++) {
        const total = Number(blades[i].points) + Number(blades[j].points) + Number(blades[k].points);
        if (total <= state.budget && total > bestTotal) {
          best = [blades[i], blades[j], blades[k]];
          bestTotal = total;
          if (bestTotal === state.budget) break;
        }
      }
      if (bestTotal === state.budget) break;
    }
    if (bestTotal === state.budget) break;
  }
  if (!best) return showToast('Kein gültiges Deck für dieses Budget gefunden.');
  state.selected = best;
  update();
  showToast(bestTotal === state.budget ? 'Budget exakt ausgereizt.' : `Bestmöglich: ${bestTotal}/${state.budget} Punkte.`);
}

async function copyDeck() {
  const chosen = state.selected.filter(Boolean);
  if (!chosen.length) return showToast('Noch keine Blades ausgewählt.');
  const total = chosen.reduce((s,b)=>s+b.points,0);
  const text = chosen.map((b,i)=>`${i+1}. ${b.name} — ${b.points} P`).join('\n') + `\nGesamt: ${total}/${state.budget} Punkte`;
  try { await navigator.clipboard.writeText(text); showToast('Deck kopiert.'); }
  catch { showToast('Kopieren wurde vom Browser blockiert.'); }
}

function showToast(text) {
  const toast = el('toast');
  toast.textContent = text; toast.hidden = false;
  clearTimeout(showToast.t); showToast.t = setTimeout(() => toast.hidden = true, 1800);
}

function escapeHtml(v) {
  return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
}

function initUI() {
  document.querySelectorAll('#budgetPresets [data-budget]').forEach(btn => btn.addEventListener('click', () => {
    el('customBudgetWrap').hidden = true;
    setBudget(Number(btn.dataset.budget), btn);
  }));
  el('customBudgetBtn').addEventListener('click', (e) => {
    el('customBudgetWrap').hidden = !el('customBudgetWrap').hidden;
    document.querySelectorAll('#budgetPresets button').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
  });
  el('applyCustomBudget').addEventListener('click', () => setBudget(el('customBudget').value, el('customBudgetBtn')));
  el('customBudget').addEventListener('keydown', e => { if (e.key === 'Enter') setBudget(e.currentTarget.value, el('customBudgetBtn')); });

  search.addEventListener('input', () => renderBladeList(search.value));
  document.querySelectorAll('[data-close-modal]').forEach(n => n.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  document.querySelectorAll('.drawer-toggle').forEach(btn => btn.addEventListener('click', () => {
    const panel = el(`drawer-${btn.dataset.drawer}`);
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  }));

  el('randomBtn').addEventListener('click', randomDeck);
  el('maxBtn').addEventListener('click', maxDeck);
  el('copyBtn').addEventListener('click', copyDeck);
  el('clearBtn').addEventListener('click', () => { state.selected = [null,null,null]; update(); });

  const hashBudget = Number(location.hash.replace('#',''));
  if (hashBudget >= 1 && hashBudget <= Number(CONFIG.MAX_BUDGET || 28)) {
    const btn = document.querySelector(`#budgetPresets [data-budget="${hashBudget}"]`);
    setBudget(hashBudget, btn || el('customBudgetBtn'));
  }
}

(async function start() {
  initUI();
  await loadData();
  update();
})().catch(err => {
  console.error(err);
  el('dataStatus').textContent = 'Fehler beim Laden';
  showToast('Daten konnten nicht geladen werden.');
});
