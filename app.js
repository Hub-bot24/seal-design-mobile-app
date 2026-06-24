const state = { lookups: null, deferredPrompt: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const norm = (v) => String(v ?? '').trim().toUpperCase();
const asNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const round = (n, dp = 3) => Number.isFinite(n) ? Number(n.toFixed(dp)) : n;

function uniqueRows(tableName, field) {
  const rows = state.lookups.tables[tableName]?.rows || [];
  return [...new Set(rows.map(r => r[field]).filter(v => v !== undefined && v !== null && String(v).trim() !== ''))].sort((a,b)=>String(a).localeCompare(String(b)));
}

function tableRows(name) { return state.lookups.tables[name]?.rows || []; }

function setOptions(select, values, preferred) {
  select.innerHTML = values.map(v => `<option value="${String(v).replaceAll('"','&quot;')}">${v}</option>`).join('');
  if (preferred && values.some(v => norm(v) === norm(preferred))) select.value = values.find(v => norm(v) === norm(preferred));
}

function populateOptions() {
  const specs = [...new Set([...uniqueRows('LUT_Factors','Spec'), ...uniqueRows('LUT_Factors4','Spec')])];
  const types = [...new Set([...uniqueRows('LUT_Factors','BF_Type'), ...uniqueRows('LUT_Factors4','BF_Type')])];
  const treatments = [...new Set([...uniqueRows('LUT_Factors','BF_Treatment'), ...uniqueRows('LUT_Factors4','BF_Treatment')])];
  const binders = [...new Set([...uniqueRows('LUT_Factors','BF_Binder'), ...uniqueRows('LUT_Factors4','BF_Binder')])];
  const aggSizes = uniqueRows('LookupsTbl','B (Agg Size 2)');
  const surfaces = uniqueRows('LookupsTbl','A (Agg Size 1)');
  setOptions($('[name="spec"]'), specs, 'AGPT04K-18');
  setOptions($('[name="sealType"]'), types, 'Single');
  setOptions($('[name="treatment"]'), treatments, 'Conventional Seal');
  setOptions($('[name="binder"]'), binders, 'C170');
  setOptions($('[name="aggregateSize"]'), aggSizes, '10mm');
  setOptions($('[name="surfaceType"]'), surfaces, 'Primed');
}

function formValues() {
  const fd = new FormData($('#designForm'));
  return Object.fromEntries([...fd.entries()].map(([k,v]) => [k, v]));
}

function compoundTraffic({ initialAadt, growthRate, baseYear, designYear, laneSplit }) {
  const years = Math.max(0, asNum(designYear, new Date().getFullYear()) - asNum(baseYear, new Date().getFullYear()));
  const aadt = asNum(initialAadt) * Math.pow(1 + asNum(growthRate) / 100, years);
  const vld = aadt * (asNum(laneSplit, 50) / 100);
  return { years, aadt, vld };
}

// Converted from Calculation!H19 / AG19 logic.
function vehicleFactor(vld, sealType) {
  if (!vld) return 0;
  const st = norm(sealType);
  if (st.includes('DOUBLE 1ST')) return round(vld <= 500 ? 0.2359 * Math.pow(vld, -0.084) : 0.2385 * Math.pow(vld, -0.086), 3);
  return round(vld <= 110 ? 0.388 * Math.pow(110, -0.1304) : vld <= 500 ? 0.388 * Math.pow(vld, -0.1304) : 0.3687 * Math.pow(vld, -0.1226), 3);
}

// Converted from Calculation!H21 / AG21 logic.
function temperatureCorrection(tempC) {
  const t = asNum(tempC);
  if (t > 35) return { value: 0, note: 'Cant Use: Excel rule flags surface temp above 35°C' };
  if (t < 10) return { value: 0.02, note: '' };
  if (t > 25 && t < 36) return { value: -0.01, note: '' };
  if (t > 15 && t < 26) return { value: 0, note: '' };
  if (t > 9 && t < 16) return { value: 0.01, note: '' };
  return { value: 0, note: 'Temperature boundary not explicit in Excel rule' };
}

// Collapsed from Calculation!H22 / AG22 nested IF blocks.
function heavyVehicleGradientCorrection(ehvPct, gradient, braking) {
  const ehv = asNum(ehvPct) / 100;
  const slow = norm(gradient).includes('CLIMBING');
  const brake = norm(braking) === 'YES';
  if (ehv > 0.65) return 0;
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
  const rows = [...tableRows('LUT_Factors'), ...tableRows('LUT_Factors4')];
  const matches = rows.filter(r => norm(r.Spec) === norm(spec) && norm(r.BF_Type) === norm(sealType) && norm(r.BF_Treatment) === norm(treatment) && norm(r.BF_Binder) === norm(binder));
  const result = matches.reduce((sum, r) => sum + asNum(r.BF_Result, 0), 0);
  return result || null;
}

function aggregateRetention(surfaceType, aggregateSize, sandPatch) {
  const sp = asNum(sandPatch);
  const row = tableRows('LookupsTbl').find(r => norm(r.KeyA || r['A (Agg Size 1)']) === norm(surfaceType) && norm(r.KeyB || r['B (Agg Size 2)']) === norm(aggregateSize) && asNum(r['C (Min Sand Patch)']) <= sp && asNum(r['D (Max Sand Patch)']) >= sp);
  if (!row) return { value: 0, numeric: 0, note: 'No aggregate-retention lookup match' };
  return { value: row['E (Value)'], numeric: asNum(row.E_num, asNum(row['E (Value)'], 0)), note: '' };
}

// Converted from Calculation!H39 coat-count adjustment.
function coatCountCorrection(vld, coatCount) {
  const c = String(coatCount);
  const v = asNum(vld);
  if (c === 'N/A') return 0;
  if (c === '>3') return 'NOTE';
  if (c === '1') {
    if (v <= 1200) return 0; if (v <= 2600) return -0.1; if (v <= 9500) return -0.2; return -0.3;
  }
  if (c === '2') {
    if (v <= 800) return 0; if (v <= 1800) return -0.1; if (v <= 4200) return -0.2; return -0.3;
  }
  if (c === '3') {
    if (v <= 400) return 0; if (v <= 1400) return -0.1; if (v <= 2600) return -0.2; return -0.3;
  }
  return 0;
}

function aggregateSpreadRate(spec, sealType, treatment, binder, ald) {
  // This is a first-pass translation of the long H45/H46 rules, not the final certified table.
  const st = norm(sealType), tr = norm(treatment), b = norm(binder), sp = norm(spec);
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
  const traffic = compoundTraffic(v);
  const vf = vehicleFactor(traffic.vld, v.sealType);
  const temp = temperatureCorrection(v.surfaceTemp);
  const hvc = heavyVehicleGradientCorrection(v.heavyVehiclePct, v.gradient, v.braking);
  const bf = binderFactor(v.spec, v.sealType, v.treatment, v.binder);
  const ar = aggregateRetention(v.surfaceType, v.aggregateSize, v.sandPatch);
  const coat = coatCountCorrection(traffic.vld, v.coatCount);
  const coatNum = typeof coat === 'number' ? coat : 0;
  const perMm = vf + temp.value + hvc;
  const baseBinder = perMm * asNum(v.ald);
  const finalBinder = (baseBinder * (bf ?? 0)) + ar.numeric + coatNum;
  const litres = finalBinder * asNum(v.area);
  const agg = aggregateSpreadRate(v.spec, v.sealType, v.treatment, v.binder, v.ald);
  const tonnesApprox = asNum(v.area) / Math.max(agg.m2m3, 0.1);
  const flags = [];
  if (!bf) flags.push('Binder factor not found for this Spec + Type + Treatment + Binder. Do not use result until mapped.');
  if (temp.note) flags.push(temp.note);
  if (ar.note) flags.push(ar.note);
  if (coat === 'NOTE') flags.push('Existing coat count >3 returns NOTE in Excel. Needs engineer decision.');
  if (finalBinder <= 0) flags.push('Calculated binder rate is zero or negative. Inputs are probably incomplete or unsupported.');
  flags.push('First-pass engine: validate every output against Excel before using for real work.');
  return { v, traffic, vf, temp, hvc, bf, ar, coat, perMm, baseBinder, finalBinder, litres, agg, tonnesApprox, flags };
}

function metric(label, value, small='') { return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div>${small ? `<div class="small">${small}</div>` : ''}</div>`; }
function render() {
  const r = calculate();
  $('#resultsGrid').innerHTML = [
    metric('Design AADT', round(r.traffic.aadt,0), `${r.traffic.years} year compound`),
    metric('Design lane v/l/d', round(r.traffic.vld,1), 'Traffic value used by Vf'),
    metric('Vf', round(r.vf,3), 'Vehicle factor'),
    metric('BF', r.bf ?? 'Missing', 'Binder factor lookup'),
    metric('Binder L/m²', round(r.finalBinder,3), `Base ${round(r.baseBinder,3)} + AR ${r.ar.value}`),
    metric('Binder litres', round(r.litres,0), `${r.v.area} m²`),
    metric('Agg spread m²/m³', round(r.agg.m2m3,1), `Base ${r.agg.base}`),
    metric('Agg m³ approx.', round(r.tonnesApprox,2), 'Area ÷ spread')
  ].join('') + `<div class="metric" style="grid-column:1/-1"><div class="label">Flags</div>${r.flags.map(f=>`<div class="flag ${f.startsWith('First')?'ok':''}">${f}</div>`).join('')}</div>`;
  localStorage.setItem('seal-design-form', JSON.stringify(r.v));
}
function restore() {
  const saved = JSON.parse(localStorage.getItem('seal-design-form') || '{}');
  for (const [k,v] of Object.entries(saved)) { const el = $(`[name="${k}"]`); if (el) el.value = v; }
}
function copySummary() {
  const r = calculate();
  const text = `Seal design summary\nProject: ${r.v.projectName}\nRoad: ${r.v.roadName}\nSpec: ${r.v.spec}\nType: ${r.v.sealType}\nTreatment: ${r.v.treatment}\nBinder: ${r.v.binder}\nAggregate: ${r.v.aggregateSize}\nAADT: ${round(r.traffic.aadt,0)}\nBinder: ${round(r.finalBinder,3)} L/m²\nBinder total: ${round(r.litres,0)} L\nAggregate spread: ${round(r.agg.m2m3,1)} m²/m³\nFlags: ${r.flags.join(' | ')}`;
  navigator.clipboard?.writeText(text);
  alert('Summary copied.');
}
async function init() {
  state.lookups = await fetch('./data/lookups.json').then(r => r.json());
  populateOptions();
  restore();
  $('#designForm').addEventListener('input', render);
  $('#copyBtn').addEventListener('click', copySummary);
  $('#printBtn').addEventListener('click', () => window.print());
  $('#resetBtn').addEventListener('click', () => { localStorage.removeItem('seal-design-form'); location.reload(); });
  $('#validationList').textContent = 'No validation cases loaded yet. Next: enter 5–10 known Excel designs and compare app outputs.';
  render();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredPrompt = e; const b=$('#installBtn'); b.hidden=false; b.onclick=()=>state.deferredPrompt.prompt(); });
init();
