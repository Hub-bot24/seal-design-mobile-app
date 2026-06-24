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
function populateOptions() {
  const specs = [...new Set([...uniqueRows('LUT_Factors','Spec'), ...uniqueRows('LUT_Factors4','Spec')])];
  const types = [...new Set([...uniqueRows('LUT_Factors','BF_Type'), ...uniqueRows('LUT_Factors4','BF_Type')])];
  const treatments = [...new Set([...uniqueRows('LUT_Factors','BF_Treatment'), ...uniqueRows('LUT_Factors4','BF_Treatment')])];
  const binders = [...new Set([...uniqueRows('LUT_Factors','BF_Binder'), ...uniqueRows('LUT_Factors4','BF_Binder')])];
  const aggSizes = uniqueRows('LookupsTbl','B (Agg Size 2)');
  const surfaces = uniqueRows('LookupsTbl','A (Agg Size 1)');
  setOptions($('[name="spec"]'), specs, 'TN175');
  setOptions($('[name="sealType"]'), types, 'Double 1st Coat');
  setOptions($('[name="treatment"]'), treatments, 'HSS2-M');
  setOptions($('[name="binder"]'), binders, 'S15R');
  setOptions($('[name="aggregateSize"]'), aggSizes, '10mm');
  setOptions($('[name="surfaceType"]'), surfaces, 'N/A');
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
  const shv = asNum(v.shvPct);
  const lhv = asNum(v.lhvPct);
  const ehvPct = shv + lhv;
  const traffic = compoundTraffic(v);
  const vf = vehicleFactor(traffic.vld, v.sealType);
  const vt = heavyVehicleGradientCorrection(ehvPct, v.gradient, v.braking);
  const bf = binderFactor(v.spec, v.sealType, v.treatment, v.binder);
  const ar = aggregateRetention(v.surfaceType, v.aggregateSize, v.sandPatch);
  const designVf = vf + vt;
  const baseBinder = designVf * asNum(v.ald);
  const modifiedBinder = baseBinder * (bf ?? 0);
  const finalBinder = modifiedBinder + ar.numeric;
  const agg = aggregateSpreadRate(v.spec, v.sealType, v.treatment, v.binder, v.ald);
  const flags = [];
  if (!bf) flags.push('Binder factor not found for this Spec + Type + Treatment + Binder. Do not use the rate until this is mapped against Excel.');
  if (ar.note) flags.push(ar.note);
  if (finalBinder <= 0) flags.push('Calculated binder rate is zero or negative. Inputs are incomplete or unsupported.');
  flags.push('This version is layout-corrected to match your Excel-style screen, but it still needs Excel validation cases before real design use.');
  return { v, traffic, shv, lhv, ehvPct, vf, vt, bf, ar, designVf, baseBinder, modifiedBinder, finalBinder, agg, flags };
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
  if (e?.target?.name === 'aldMirror') syncAld(e.target);
  if (e?.target?.name === 'ald') syncAld(e.target);
  const r = calculate();
  const designAadt = round(r.traffic.aadt, 0);
  const vld = round(r.traffic.vld, 0);
  const lv = round(r.traffic.vld, 1);
  setText('awdtOut', round(asNum(r.v.initialAadt) * 2.06, 0));
  setText('awedtOut', round(asNum(r.v.initialAadt) * 1.39, 0));
  setText('aadtCalcOut', designAadt);
  setText('lvOut', lv);
  setText('vldOut', vld);
  setText('ehvOut', `${round(r.ehvPct,2).toFixed(2)}%`);
  setText('yearCountOut', r.traffic.years);
  setText('designAadtTop', designAadt);
  setText('designAadtBig', designAadt);
  setText('designTrafficOut', vld);
  setText('vfOut', round(r.vf,3).toFixed(3));
  setText('vaOut', '0');
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
  $('#flagsList').innerHTML = r.flags.map(f => `<div class="flag ${f.startsWith('This version')?'ok':''}">${safe(f)}</div>`).join('');
  localStorage.setItem('seal-design-form', JSON.stringify(r.v));
}
function restore() {
  const saved = JSON.parse(localStorage.getItem('seal-design-form') || '{}');
  for (const [k,v] of Object.entries(saved)) { const el = $(`[name="${k}"]`); if (el) el.value = v; }
  syncAld($('[name="ald"]'));
}
function copySummary() {
  const r = calculate();
  const text = `Spray seal design summary\nProject: ${r.v.projectName}\nRoad: ${r.v.roadName}\nSpec: ${r.v.spec}\nType: ${r.v.sealType}\nTreatment: ${r.v.treatment}\nBinder: ${r.v.binder}\nAggregate: ${r.v.aggregateSize}\nAADT: ${round(r.traffic.aadt,0)}\nv/l/d: ${round(r.traffic.vld,0)}\nBinder: ${round(r.finalBinder,2)} L/m²\nAggregate spread: ${round(r.agg.m2m3,0)} m²/m³\nFlags: ${r.flags.join(' | ')}`;
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
  render();
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.deferredPrompt = e; const b=$('#installBtn'); b.hidden=false; b.onclick=()=>state.deferredPrompt.prompt(); });
init().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', `<div style="background:#fee2e2;border:2px solid #991b1b;padding:12px;margin:12px;font-weight:800">App failed to load lookup data. Open it through GitHub Pages or Live Server, not by double-clicking index.html.</div>`);
});
