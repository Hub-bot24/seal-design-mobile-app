const state = { lookups: null, deferredPrompt: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const norm = (v) => String(v ?? '').trim().toUpperCase();
const asNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const round = (n, dp = 3) => Number.isFinite(n) ? Number(n.toFixed(dp)) : n;

function uniqueRows(tableName, field) {
  const rows = state.lookups.tables[tableName]?.rows || [];
  return [...new Set(rows.map(r => r[field]).filter(v => v !== undefined && v !== null && String(v).trim() !== ''))]
    .sort((a,b)=>String(a).localeCompare(String(b)));
}
function tableRows(name) { return state.lookups.tables[name]?.rows || []; }
function safe(v){ return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setOptions(select, values, preferred) {
  if (!select) return;
  select.innerHTML = values.map(v => `<option value="${safe(v)}">${safe(v)}</option>`).join('');
  if (preferred && values.some(v => norm(v) === norm(preferred))) select.value = values.find(v => norm(v) === norm(preferred));
}
function binderRowsForSpec(spec) {
  // 4K uses the extracted Austroads table. TN175 uses the TMR-specific table bucket.
  // The workbook extraction labels individual TN rows strangely, so TN175 mode uses all
  // rows in LUT_Factors4, then filters by seal type/treatment/binder.
  return norm(spec) === 'TN175' ? tableRows('LUT_Factors4') : tableRows('LUT_Factors');
}
function populateOptions() {
  const specs = ['AGPT04K-26', 'TN175'];
  const aggSizes = uniqueRows('LookupsTbl','B (Agg Size 2)');
  const surfaces = uniqueRows('LookupsTbl','A (Agg Size 1)');
  setOptions($('[name="spec"]'), specs, 'TN175');
  setOptions($('[name="aggregateSize"]'), aggSizes, '10mm');
  setOptions($('[name="surfaceType"]'), surfaces, 'N/A');
  updateTreatmentAndBinderOptions();
}
function valuesFromRows(rows, field) {
  return [...new Set(rows.map(r => r[field]).filter(v => v !== undefined && v !== null && String(v).trim() !== ''))]
    .sort((a,b)=>String(a).localeCompare(String(b)));
}
function updateTreatmentAndBinderOptions() {
  const spec = $('[name="spec"]')?.value || 'TN175';
  const typeEl = $('[name="sealType"]');
  const treatmentEl = $('[name="treatment"]');
  const binderEl = $('[name="binder"]');
  const rows = binderRowsForSpec(spec);

  const currentType = typeEl?.value;
  const types = valuesFromRows(rows, 'BF_Type');
  setOptions(typeEl, types, currentType && types.some(v => norm(v) === norm(currentType)) ? currentType : 'Double 1st Coat');

  const currentTreatment = treatmentEl?.value;
  const typeRows = rows.filter(r => norm(r.BF_Type) === norm(typeEl?.value));
  const treatments = valuesFromRows(typeRows, 'BF_Treatment');
  setOptions(treatmentEl, treatments, currentTreatment && treatments.some(v => norm(v) === norm(currentTreatment)) ? currentTreatment : 'Conventional Seal');

  const currentBinder = binderEl?.value;
  const binderRows = typeRows.filter(r => norm(r.BF_Treatment) === norm(treatmentEl?.value));
  const binders = valuesFromRows(binderRows, 'BF_Binder');
  const preferredBinder = currentBinder && binders.some(v => norm(v) === norm(currentBinder)) ? currentBinder : (binders.includes('C170') ? 'C170' : binders[0]);
  setOptions(binderEl, binders, preferredBinder);
}
function formValues() {
  const fd = new FormData($('#designForm'));
  return Object.fromEntries([...fd.entries()].map(([k,v]) => [k, v]));
}
function currentDesignYear() { return new Date().getFullYear(); }
function compoundTraffic({ initialAadt, growthRate, baseYear, laneSplit }) {
  const designYear = currentDesignYear();
  const years = Math.max(0, designYear - asNum(baseYear, designYear));
  const aadt = asNum(initialAadt) * Math.pow(1 + asNum(growthRate) / 100, years);
  const vld = aadt * (asNum(laneSplit, 50) / 100);
  return { years, aadt, vld, designYear };
}
function vehicleFactor(vld, sealType) {
  if (!vld) return 0;
  const st = norm(sealType);
  if (st.includes('DOUBLE 1ST')) return round(vld <= 500 ? 0.2359 * Math.pow(vld, -0.084) : 0.2385 * Math.pow(vld, -0.086), 3);
  return round(vld <= 110 ? 0.388 * Math.pow(110, -0.1304) : vld <= 500 ? 0.388 * Math.pow(vld, -0.1304) : 0.3687 * Math.pow(vld, -0.1226), 3);
}
function heavyVehicleGradientCorrection(ehvPct, gradient, braking) {
  const ehv = asNum(ehvPct) / 100;
  const slow = norm(gradient).includes('CLIMBING');
  const brake = norm(braking) === 'YES';
  if (ehv > 65) return 0;
  if (!slow) {
    if (ehv < 0.15) return brake ? -0.01 : 0;
    if (ehv <= 0.25) return brake ? -0.02 : -0.01;
    if (ehv <= 0.45) return brake ? -0.03 : -0.02;
    if (ehv <= 0.65) return brake ? -0.04 : -0.03;
  }
  if (ehv < 0.15) return brake ? -0.02 : -0.01;
  if (ehv <= 0.25) return brake ? -0.03 : -0.02;
  if (ehv <= 0.45) return -0.04;
  if (ehv <= 0.65) return brake ? -0.05 : -0.04;
  return 0;
}
function binderFactor(spec, sealType, treatment, binder) {
  const rows = binderRowsForSpec(spec);
  const matches = rows.filter(r => norm(r.BF_Type) === norm(sealType) && norm(r.BF_Treatment) === norm(treatment) && norm(r.BF_Binder) === norm(binder));
  const result = matches.reduce((sum, r) => sum + asNum(r.BF_Result, 0), 0);
  return result || null;
}
function aggregateShapeAdjustment(flIndex) {
  const fi = asNum(flIndex, NaN);
  if (!Number.isFinite(fi)) return { va: 0, shape: 'Missing', level: 'WARNING', message: 'Flakiness Index is missing. Va has been set to 0 until a tested value is entered.' };
  if (fi > 35) return { va: 0, shape: 'Very flaky', level: 'WARNING', message: 'Flakiness Index is greater than 35%. Do not accept this aggregate for seal design without designer review.' };
  if (fi >= 26) return { va: -0.01, shape: 'Flaky', level: 'CHECK', message: 'Flakiness Index is 26–35%. Va = -0.01 applied.' };
  if (fi >= 16) return { va: 0, shape: 'Angular', level: 'INFO', message: 'Flakiness Index is 16–25%. Va = 0 applied.' };
  if (fi >= 10) return { va: 0.01, shape: 'Cubic', level: 'INFO', message: 'Flakiness Index is 10–15%. Va = +0.01 applied.' };
  return { va: 0.02, shape: 'Very cubic', level: 'CHECK', message: 'Flakiness Index is below 10%. Va = +0.02 applied; check suitability, especially for double/double bottom layer interlock.' };
}
function note(level, field, message, source = '') {
  return { level, field, message, source };
}
function buildDesignNotes(r) {
  const notes = [];
  const spec = norm(r.v.spec);
  const fi = asNum(r.v.flIndex, NaN);
  const ald = asNum(r.v.ald, NaN);
  const ast = asNum(r.v.sandPatch, NaN);
  const laneSplit = asNum(r.v.laneSplit, 50);

  notes.push(note('INFO', 'Traffic', `Design AADT compounded from ${r.v.baseYear} to ${r.traffic.designYear}; ${round(r.traffic.aadt,0)} used for design traffic.`, 'App traffic calculation'));

  if (spec === 'AGPT04K-26') {
    notes.push(note('INFO', 'SPEC', '4K mode selected. AGPT04K-26 rules are the reference for flakiness/ALD/voids/binder/aggregate checks.', 'AGPT04K-26'));
  } else if (spec === 'TN175') {
    notes.push(note('CHECK', 'SPEC', 'TN175 mode selected. TMR/TN175-specific logic must be validated against TN175 before real use.', 'TN175'));
  }

  if (!Number.isFinite(ald) || ald <= 0) {
    notes.push(note('WARNING', 'ALD', 'ALD is missing or zero. Binder rate and aggregate spread cannot be trusted.', 'AGPT04K-26 Section 5.3.1'));
  }

  if (Number.isFinite(fi)) {
    notes.push(note(r.shape.level, 'Flakiness Index', r.shape.message, 'AGPT04K-26 Table 6.1'));
  } else {
    notes.push(note('WARNING', 'Flakiness Index', r.shape.message, 'AGPT04K-26 Table 6.1'));
  }

  if (!Number.isFinite(ast)) {
    notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture/sand patch value is missing. Ast has been treated as 0.', 'AGPT04K-26 Table 6.3'));
  } else if (ast < 0) {
    notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture/sand patch value cannot be negative.', 'Designer check'));
  } else if (ast > 0.5) {
    notes.push(note('WARNING', 'Surface texture / sand patch', `Surface texture allowance/sand patch input is ${ast}. This is high; review aggregate size and/or treatment selection.`, 'AGPT04K-26 Section 6.2.2 / Table 6.3'));
  } else if (ast > 0) {
    notes.push(note('INFO', 'Surface texture / sand patch', `Surface texture allowance/sand patch input ${ast} applied to binder allowance.`, 'AGPT04K-26 Table 6.3'));
  }

  if (r.ar.note) {
    notes.push(note('CHECK', 'Surface/Aggregate lookup', r.ar.note, 'Extracted Lookups tab'));
  }

  if (laneSplit !== 50) {
    notes.push(note('CHECK', 'Design lane split', `Design lane split is ${laneSplit}%, not 50%. Confirm this is intentional.`, 'Traffic distribution check'));
  }

  if ((r.shvPct + r.lhvPct) > 100) {
    notes.push(note('WARNING', 'Traffic breakdown', 'SHV% + LHV% exceeds 100%. LV has been forced to 0, but the input is invalid.', 'Traffic breakdown check'));
  }
  if (r.ehvPct > 45) {
    notes.push(note('WARNING', 'EHV %', `EHV is ${round(r.ehvPct,2)}%. High heavy-vehicle loading: check treatment/binder selection.`, 'AGPT04K-26 Section 5.2.5'));
  } else if (r.ehvPct > 25) {
    notes.push(note('CHECK', 'EHV %', `EHV is ${round(r.ehvPct,2)}%. Review heavy vehicle effects and stress conditions.`, 'AGPT04K-26 Section 5.2.5'));
  }

  if (!r.bf) {
    notes.push(note('WARNING', 'Binder factor', 'Binder factor not found for this SPEC + TYPE + TREATMENT + BINDER. Do not use the binder rate until mapped/validated.', 'Extracted Lookups tab / AGPT04K-26 Tables 6.4 and 6.5'));
  } else {
    notes.push(note('INFO', 'Binder selection', `Binder list filtered to ${r.v.spec} + ${r.v.sealType} + ${r.v.treatment}; BF ${r.bf} applied for ${r.v.binder}.`, 'Binder factor lookup'));
  }
  if (r.finalBinder <= 0) {
    notes.push(note('WARNING', 'Design binder rate', 'Calculated binder rate is zero or negative. Inputs are incomplete, unsupported, or the lookup is missing.', 'Calculation check'));
  }
  notes.push(note('CHECK', 'Validation', 'App calculation still needs Excel validation cases before real design use.', 'Project validation rule'));
  return notes;
}
function aggregateRetention(surfaceType, aggregateSize, sandPatch) {
  const sp = asNum(sandPatch);
  const row = tableRows('LookupsTbl').find(r => norm(r.KeyA || r['A (Agg Size 1)']) === norm(surfaceType) && norm(r.KeyB || r['B (Agg Size 2)']) === norm(aggregateSize) && asNum(r['C (Min Sand Patch)']) <= sp && asNum(r['D (Max Sand Patch)']) >= sp);
  if (!row) return { value: 0, numeric: 0, note: 'No aggregate-retention lookup match' };
  return { value: row['E (Value)'], numeric: asNum(row.E_num, asNum(row['E (Value)'], 0)), note: '' };
}
function aggregateSpreadRate(spec, sealType, treatment, binder, ald) {
  const st = norm(sealType), tr = norm(treatment), b = norm(binder);
  let base = 950;
  if (tr === 'SAMI' || tr.includes('WATERPROOFING')) base = 1000;
  else if (tr.includes('UNMODIFIED EMULSION') || tr.includes('HI-FLOAT') || tr.includes('PRIMER')) base = 800;
  else if (tr.includes('CONVENTIONAL') && ['AMC5'].includes(b)) base = 800;
  else if (st.includes('DOUBLE 1ST')) base = b.startsWith('AMC') ? 850 : 950;
  else if (st.includes('DOUBLE 2ND')) base = 900;
  const m2m3 = base / Math.max(asNum(ald, 1), 0.1);
  return { base, m2m3 };
}
function calculate() {
  const v = formValues();
  const shvPct = Math.max(0, asNum(v.shvPct));
  const lhvPct = Math.max(0, asNum(v.lhvPct));
  const hvPct = Math.min(100, shvPct + lhvPct);
  const ehvPct = Math.min(100, shvPct + (lhvPct * 3));
  const lvPct = Math.max(0, 100 - hvPct);
  const traffic = compoundTraffic(v);
  const vf = vehicleFactor(traffic.vld, v.sealType);
  const vt = heavyVehicleGradientCorrection(ehvPct, v.gradient, v.braking);
  const shape = aggregateShapeAdjustment(v.flIndex);
  const bf = binderFactor(v.spec, v.sealType, v.treatment, v.binder);
  const ar = aggregateRetention(v.surfaceType, v.aggregateSize, v.sandPatch);
  const designVf = vf + shape.va + vt;
  const baseBinder = designVf * asNum(v.ald);
  const modifiedBinder = baseBinder * (bf ?? 0);
  const finalBinder = modifiedBinder + ar.numeric;
  const agg = aggregateSpreadRate(v.spec, v.sealType, v.treatment, v.binder, v.ald);
  const result = { v, traffic, shvPct, lhvPct, lvPct, ehvPct, vf, vt, shape, bf, ar, designVf, baseBinder, modifiedBinder, finalBinder, agg, notes: [] };
  result.notes = buildDesignNotes(result);
  return result;
}
function noteIcon(level) {
  return level === 'WARNING' ? '⚠' : level === 'CHECK' ? '◆' : 'i';
}
function renderNoteCard(n) {
  const source = n.source ? `<small>${safe(n.source)}</small>` : '';
  return `<div class="note-card ${safe(n.level.toLowerCase())}"><b>${noteIcon(n.level)} ${safe(n.level)} — ${safe(n.field)}</b><span>${safe(n.message)}</span>${source}</div>`;
}
function renderInlineNotes(notes) {
  const byField = new Map();
  notes.forEach(n => { if (!byField.has(n.field)) byField.set(n.field, []); byField.get(n.field).push(n); });
  $$('[data-note-for]').forEach(el => {
    const key = el.dataset.noteFor;
    let matches = [];
    if (key === 'flIndex') matches = byField.get('Flakiness Index') || [];
    if (key === 'ald' || key === 'aldMirror') matches = byField.get('ALD') || [];
    if (key === 'sandPatch') matches = byField.get('Surface texture / sand patch') || [];
    const important = matches.find(n => n.level === 'WARNING') || matches.find(n => n.level === 'CHECK') || matches[0];
    if (!important) { el.innerHTML = ''; el.className = el.className.replace(/\b(info|check|warning)\b/g, '').trim(); return; }
    el.innerHTML = `${noteIcon(important.level)} ${safe(important.message)}`;
    el.className = `${el.className.replace(/\b(info|check|warning)\b/g, '').trim()} ${important.level.toLowerCase()}`;
  });
}
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function setVal(name, value) { const el = $(`[name="${name}"]`); if (el) el.value = value; }
function syncAld(source) {
  const ald = $('[name="ald"]');
  const mirror = $('[name="aldMirror"]');
  if (!ald || !mirror) return;
  if (source === mirror) ald.value = mirror.value;
  else mirror.value = ald.value;
}
function render(e) {
  if (['spec','sealType','treatment'].includes(e?.target?.name)) updateTreatmentAndBinderOptions();
  if (e?.target?.name === 'aldMirror') syncAld(e.target);
  if (e?.target?.name === 'ald') syncAld(e.target);
  const r = calculate();
  const designAadt = round(r.traffic.aadt, 0);
  const vld = round(r.traffic.vld, 0);
  const lv = round(r.traffic.vld * (r.lvPct / 100), 1);
  const shvVeh = round(r.traffic.vld * (r.shvPct / 100), 1);
  const lhvVeh = round(r.traffic.vld * (r.lhvPct / 100), 1);
  setText('awdtOut', round(asNum(r.v.initialAadt) * 2.06, 0));
  setText('awedtOut', round(asNum(r.v.initialAadt) * 1.39, 0));
  setText('aadtCalcOut', designAadt);
  setText('lvOut', lv);
  setText('shvVehOut', shvVeh);
  setText('lhvVehOut', lhvVeh);
  setText('lvPctOut', `${round(r.lvPct,1).toFixed(1)}%`);
  setText('vldOut', vld);
  setText('ehvOut', `${round(r.ehvPct,2).toFixed(2)}%`);
  setText('yearCountOut', r.traffic.years);
  setText('designAadtBig', designAadt);
  setText('designTrafficOut', vld);
  setText('vfOut', round(r.vf,3).toFixed(3));
  setText('vaOut', round(r.shape.va,3));
  setText('vtOut', round(r.vt,3));
  setText('otherOut', '0');
  setText('designVfOut', round(r.designVf,3).toFixed(3));
  setText('baseBinderOut', round(r.baseBinder,2).toFixed(2));
  setText('bfOut', r.bf ?? '0.0');
  setText('modifiedBinderOut', round(r.modifiedBinder,2).toFixed(2));
  setText('abaOut', '0');
  setText('apOut', '0');
  setText('embedOut', '0');
  setText('finalBinderOut', round(r.finalBinder,2).toFixed(2));
  setText('aggSpreadOut', round(r.agg.m2m3,0));
  setText('rightTrafficOut', vld);
  setText('rightVfOut', round(r.vf,3).toFixed(3));
  $('#flagsList').innerHTML = r.notes.map(renderNoteCard).join('');
  renderInlineNotes(r.notes);
  localStorage.setItem('seal-design-form', JSON.stringify(r.v));
}
function restore() {
  const saved = JSON.parse(localStorage.getItem('seal-design-form') || '{}');
  for (const [k,v] of Object.entries(saved)) { const el = $(`[name="${k}"]`); if (el) el.value = v; }
  syncAld($('[name="ald"]'));
}
function copySummary() {
  const r = calculate();
  const text = `Spray seal design summary\nProject: ${r.v.projectName}\nRoad: ${r.v.roadName}\nSpec: ${r.v.spec}\nType: ${r.v.sealType}\nTreatment: ${r.v.treatment}\nBinder: ${r.v.binder}\nAggregate: ${r.v.aggregateSize}\nClient AADT: ${r.v.initialAadt}\nDesign AADT: ${round(r.traffic.aadt,0)}\nv/l/d: ${round(r.traffic.vld,0)}\nBinder: ${round(r.finalBinder,2)} L/m²\nAggregate spread: ${round(r.agg.m2m3,0)} m²/m³\nDesign notes:\n${r.notes.map(n => `- ${n.level} | ${n.field}: ${n.message}${n.source ? ` (${n.source})` : ''}`).join('\n')}`;
  navigator.clipboard?.writeText(text);
  alert('Summary copied.');
}
async function init() {
  state.lookups = await fetch('./data/lookups.json').then(r => r.json());
  populateOptions();
  restore();
  updateTreatmentAndBinderOptions();
  $('#designForm').addEventListener('input', render);
  $('#copyBtn').addEventListener('click', copySummary);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#resetBtn').addEventListener('click', () => { localStorage.removeItem('seal-design-form'); location.reload(); });
  render();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredPrompt = e; const b=$('#installBtn'); b.hidden=false; b.onclick=()=>state.deferredPrompt.prompt(); });
init().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', `<div style="background:#fee2e2;border:2px solid #991b1b;padding:12px;margin:12px;font-weight:800">App failed to load lookup data. Open it through GitHub Pages or Live Server, not by double-clicking index.html.</div>`);
});
