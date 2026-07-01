// v36 TN175 binder factors + embedment notes - Q6.4/Q6.5/Q6.2.3
const state = { lookups: null, binderMatrix: null, deferredPrompt: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const norm = (v) => String(v ?? '').trim().toUpperCase();
const asNum = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const round = (n, dp = 3) => Number.isFinite(n) ? Number(n.toFixed(dp)) : n;


function uiSealTypeToLookupType(value) {
  const v = norm(value);
  if (v.includes('2ND')) return 'Double 2nd Coat';
  if (v.includes('DOUBLE')) return 'Double 1st Coat';
  return 'Single';
}
function uiSealTypeLabel(value) {
  return norm(value).includes('DOUBLE') ? 'Double Seal' : 'Single Seal';
}
function isDoubleSeal(value) { return norm(value).includes('DOUBLE'); }

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
  const group = norm(spec) === 'TN175' ? 'TN175' : 'AGPT04K-26';
  const rows = state.binderMatrix?.rows || [];
  // Use the workbook Lookups-derived binder matrix as the rulebook. Do not show
  // binders unless that SPEC + TYPE + TREATMENT combination exists in the matrix.
  return rows
    .filter(r => norm(r.spec) === group)
    .map(r => ({ BF_Type: r.type, BF_Treatment: r.treatment, BF_Binder: r.binder, BF_Result: r.bf }));
}
function populateOptions() {
  const specs = ['AGPT04K-26', 'TN175'];
  const aggSizes = uniqueRows('LookupsTbl','B (Agg Size 2)');
  const surfaces = uniqueRows('LookupsTbl','A (Agg Size 1)');
  setOptions($('[name="spec"]'), specs, 'TN175');
  setOptions($('[name="aggregateSize"]'), aggSizes, '10mm');
  setOptions($('[name="aggregateSize2"]'), aggSizes, '7mm');
  setOptions($('[name="surfaceType"]'), surfaces, 'N/A');
  setOptions($('[name="sealType"]'), ['Single Seal','Double Seal'], 'Single Seal');
  updateTreatmentAndBinderOptions();
}
function valuesFromRows(rows, field) {
  const out = [];
  const seen = new Set();
  rows.forEach(r => {
    const v = r[field];
    const key = norm(v);
    if (v !== undefined && v !== null && String(v).trim() !== '' && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  });
  return out;
}
function updateTreatmentAndBinderOptions() {
  const spec = $('[name="spec"]')?.value || 'TN175';
  const typeEl = $('[name="sealType"]');
  const treatmentEl = $('[name="treatment"]');
  const binderEl = $('[name="binder"]');
  const binder2El = $('[name="binder2"]');
  const agg2El = $('[name="aggregateSize2"]');
  const ald2El = $('[name="aldMirror2"]');
  const rows = binderRowsForSpec(spec);

  const currentType = uiSealTypeLabel(typeEl?.value || 'Single Seal');
  setOptions(typeEl, ['Single Seal', 'Double Seal'], currentType);
  const lookupType = uiSealTypeToLookupType(typeEl?.value);

  const currentTreatment = treatmentEl?.value;
  const typeRows = rows.filter(r => norm(r.BF_Type) === norm(lookupType));
  const treatments = valuesFromRows(typeRows, 'BF_Treatment');
  setOptions(treatmentEl, treatments, currentTreatment && treatments.some(v => norm(v) === norm(currentTreatment)) ? currentTreatment : 'Conventional Seal');

  const currentBinder = binderEl?.value;
  const binderRows = typeRows.filter(r => norm(r.BF_Treatment) === norm(treatmentEl?.value));
  const binders = valuesFromRows(binderRows, 'BF_Binder');
  const preferredBinder = currentBinder && binders.some(v => norm(v) === norm(currentBinder)) ? currentBinder : (binders.includes('C170') ? 'C170' : binders[0]);
  setOptions(binderEl, binders, preferredBinder);

  // Second application binder is its own selection. It comes from Double 2nd Coat + current treatment.
  const secondType = rows.find(r => norm(r.BF_Type).includes('DOUBLE 2ND'))?.BF_Type || 'Double 2nd Coat';
  const secondRows = rows.filter(r => norm(r.BF_Type).includes('DOUBLE 2ND') && norm(r.BF_Treatment) === norm(treatmentEl?.value));
  const secondBinders = valuesFromRows(secondRows, 'BF_Binder');
  const currentBinder2 = binder2El?.value;
  const preferredBinder2 = currentBinder2 && secondBinders.some(v => norm(v) === norm(currentBinder2))
    ? currentBinder2
    : (secondBinders.some(v => norm(v) === norm(binderEl?.value)) ? binderEl.value : (secondBinders.includes('C170') ? 'C170' : secondBinders[0]));
  setOptions(binder2El, secondBinders, preferredBinder2);

  // Keep a sensible default for the second aggregate, but let the user overwrite it.
  if (agg2El && !agg2El.value) agg2El.value = secondCoatAggregate($('[name="aggregateSize"]')?.value || '10mm');
  if (ald2El && (!ald2El.value || Number(ald2El.value) <= 0)) ald2El.value = defaultAldForAggregate(agg2El?.value || '7mm', 3.8);
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
  const st = norm(uiSealTypeToLookupType(sealType));
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
  // TN175 is a TMR amendment to Part 4K. When TN175 is selected, the TN175
  // Q6.4/Q6.5 binder factor tables override workbook/4K mappings.
  if (isTn175(spec)) {
    const tn = tn175BinderFactorFallback(sealType, treatment, binder);
    if (tn !== null && tn !== undefined) return tn;
  }
  const rows = binderRowsForSpec(spec);
  const lookupType = uiSealTypeToLookupType(sealType);
  const matches = rows.filter(r => norm(r.BF_Type) === norm(lookupType) && norm(r.BF_Treatment) === norm(treatment) && norm(r.BF_Binder) === norm(binder));
  const result = matches.reduce((sum, r) => sum + asNum(r.BF_Result, 0), 0);
  if (result) return result;
  return null;
}
function aggregateShapeAdjustment(flIndex) {
  const fi = asNum(flIndex, NaN);
  if (!Number.isFinite(fi)) return { va: 0, shape: 'Missing', level: 'WARNING', message: 'Flakiness Index is missing. Va has been set to 0 until a tested value is entered.' };
  if (fi > 35) return { va: 0, shape: 'Very flaky', level: 'WARNING', message: 'Flakiness Index is greater than 35%. Do not accept this aggregate for seal design without designer review.' };
  if (fi >= 26) return { va: -0.01, shape: 'Flaky', level: 'APPLIED', message: 'Flakiness Index is 26–35%. Va = -0.01 applied.' };
  if (fi >= 16) return { va: 0, shape: 'Angular', level: 'APPLIED', message: 'Flakiness Index is 16–25%. Va = 0 applied.' };
  if (fi >= 10) return { va: 0.01, shape: 'Cubic', level: 'APPLIED', message: 'Flakiness Index is 10–15%. Va = +0.01 applied.' };
  return { va: 0.02, shape: 'Very cubic', level: 'APPLIED', message: 'Flakiness Index is below 10%. Va = +0.02 applied; check suitability, especially for double/double bottom layer interlock.' };
}
function note(level, field, message, source = '') {
  return { level, field, message, source };
}
function isCutbackBinder(binder) {
  const raw = String(binder ?? '');
  const b = raw.toUpperCase().trim();
  const compact = b.replace(/[^A-Z0-9]/g, '');
  // Be deliberately broad here. AMC binders are cutback binders in this app context,
  // and the note must trigger even if the lookup text has spaces, punctuation, or hidden characters.
  return compact.startsWith('AMC')
    || compact.includes('AMC5')
    || compact.includes('AMC6')
    || compact.includes('AMC7')
    || b.includes('CUTBACK')
    || b.includes('CUT BACK')
    || b.includes('CUTTER');
}
function allowanceNum(v) {
  const n = asNum(v, 0);
  return Number.isFinite(n) ? n : 0;
}
function isWaterproofingFixedVfTreatment(treatment) {
  const tr = norm(treatment);
  return tr === 'SAMI'
    || tr === 'WPA'
    || tr === 'WP-A'
    || tr.includes('WATERPROOFING')
    || tr.includes('INTERLAYER BOND WATERPROOFING')
    || tr.includes('BRIDGE DECK WATERPROOFING')
    || tr.includes('WATERPROOFING SEAL UNDER ASPHALT');
}

function isSamiTreatment(treatment) {
  return isWaterproofingFixedVfTreatment(treatment);
}

function isTn175WpA(treatment) {
  const tr = norm(treatment);
  return tr.includes('WPA') || tr.includes('WP-A') || tr.includes('INTERLAYER BOND WATERPROOFING') || tr.includes('BRIDGE DECK WATERPROOFING') || (tr.includes('WATERPROOFING') && !tr.includes('S/S'));
}

function isTn175Sami(treatment) {
  const tr = norm(treatment);
  return tr === 'SAMI' || tr.includes('SAMI');
}

function isTn175SsUnderAsphalt(treatment) {
  const tr = norm(treatment);
  return tr.includes('S/S') || tr.includes('SINGLE / SINGLE') || tr.includes('UNDER ASPHALT');
}

function isTn175(spec) { return norm(spec) === 'TN175'; }
function aggregateSizeClass(aggregateSize) {
  const n = parseFloat(String(aggregateSize || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 'ALL';
  if (n <= 7) return '5_OR_7';
  if (n <= 10) return '10';
  return '14_PLUS';
}
function existingSurfaceClass(surfaceType) {
  const s = norm(surfaceType);
  if (s.includes('ASPHALT') || s.includes('MICRO')) return 'ASPHALT_MICRO';
  if (s.includes('5') || s.includes('7')) return '5_OR_7_SEAL';
  if (s.includes('10')) return '10_SEAL';
  if (s.includes('14') || s.includes('16') || s.includes('20')) return '14_PLUS_SEAL';
  return null;
}
function tnRange(sp, rules) {
  for (const r of rules) {
    const minOk = r.minInclusive ? sp >= r.min : sp > r.min;
    const maxOk = r.maxInclusive ? sp <= r.max : sp < r.max;
    if (minOk && maxOk) return r.val;
  }
  return null;
}
function tn175SurfaceTextureAllowance(surfaceType, aggregateSize, sandPatch) {
  const sp = asNum(sandPatch, NaN);
  if (!Number.isFinite(sp)) return { value: null, numeric: 0, display: '0', note: 'No sand patch/texture value entered.', source: 'TN175 Table Q6.3' };
  const surf = existingSurfaceClass(surfaceType);
  const agg = aggregateSizeClass(aggregateSize);
  const rule = (val) => ({ value: val, numeric: Number.isFinite(Number(val)) ? Number(val) : 0, display: String(val).toUpperCase(), note: '', source: 'TN175 Table Q6.3' });
  const R = (arr) => rule(tnRange(sp, arr));
  const base = [
    {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:'NOTE 1'},
    {min:0.3,max:0.9,minInclusive:false,maxInclusive:true,val:0.1},
    {min:0.9,max:1.4,minInclusive:false,maxInclusive:true,val:0.2},
    {min:1.4,max:2.0,minInclusive:false,maxInclusive:true,val:0.3},
    {min:2.0,max:2.7,minInclusive:false,maxInclusive:true,val:0.4},
    {min:2.7,max:1e9,minInclusive:false,maxInclusive:true,val:0.5},
  ];
  if (surf === 'ASPHALT_MICRO') return R([
    {min:0,max:0.1,minInclusive:true,maxInclusive:true,val:0},
    {min:0.1,max:0.4,minInclusive:false,maxInclusive:true,val:0.1},
    {min:0.4,max:0.8,minInclusive:false,maxInclusive:true,val:0.2},
    {min:0.8,max:1.4,minInclusive:false,maxInclusive:true,val:0.3},
    {min:1.4,max:1e9,minInclusive:false,maxInclusive:true,val:0.4},
  ]);
  if (surf === '14_PLUS_SEAL') {
    if (agg === '5_OR_7') return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:'NOTE 1'},
      {min:0.3,max:0.6,minInclusive:false,maxInclusive:true,val:'NOTE 2'},
      {min:0.6,max:0.9,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.9,max:1.3,minInclusive:false,maxInclusive:true,val:0.2},
      {min:1.3,max:1.9,minInclusive:false,maxInclusive:true,val:0.3},
      {min:1.9,max:2.9,minInclusive:false,maxInclusive:true,val:0.4},
      {min:2.9,max:1e9,minInclusive:false,maxInclusive:true,val:0.5},
    ]);
    if (agg === '10') return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:-0.1}, {min:0.3,max:0.5,minInclusive:false,maxInclusive:true,val:0},
      {min:0.5,max:0.7,minInclusive:false,maxInclusive:true,val:0.1}, {min:0.7,max:0.9,minInclusive:false,maxInclusive:true,val:0.2},
      {min:0.9,max:1.3,minInclusive:false,maxInclusive:true,val:0.3}, {min:1.3,max:1.8,minInclusive:false,maxInclusive:true,val:0.4},
      {min:1.8,max:2.2,minInclusive:false,maxInclusive:true,val:0.5}, {min:2.2,max:1e9,minInclusive:false,maxInclusive:true,val:'NOTE 3'},
    ]);
    return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:-0.1}, {min:0.3,max:0.5,minInclusive:false,maxInclusive:true,val:0},
      {min:0.5,max:0.6,minInclusive:false,maxInclusive:true,val:0.1}, {min:0.6,max:0.7,minInclusive:false,maxInclusive:true,val:0.2},
      {min:0.7,max:0.9,minInclusive:false,maxInclusive:true,val:0.3}, {min:0.9,max:1.3,minInclusive:false,maxInclusive:true,val:0.4},
      {min:1.3,max:2.2,minInclusive:false,maxInclusive:true,val:0.5}, {min:2.2,max:1e9,minInclusive:false,maxInclusive:true,val:'NOTE 3'},
    ]);
  }
  if (surf === '10_SEAL') {
    if (agg === '5_OR_7') return R(base);
    if (agg === '10') return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:'NOTE 1'}, {min:0.3,max:0.7,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.7,max:1.1,minInclusive:false,maxInclusive:true,val:0.2}, {min:1.1,max:1.7,minInclusive:false,maxInclusive:true,val:0.3},
      {min:1.7,max:2.2,minInclusive:false,maxInclusive:true,val:0.4}, {min:2.2,max:1e9,minInclusive:false,maxInclusive:true,val:'NOTE 3'},
    ]);
    return R([
      {min:0,max:0.2,minInclusive:true,maxInclusive:true,val:'NOTE 1'}, {min:0.2,max:0.6,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.6,max:0.9,minInclusive:false,maxInclusive:true,val:0.2}, {min:0.9,max:1.2,minInclusive:false,maxInclusive:true,val:0.3},
      {min:1.2,max:1.7,minInclusive:false,maxInclusive:true,val:0.4}, {min:1.7,max:2.2,minInclusive:false,maxInclusive:true,val:0.5},
      {min:2.2,max:1e9,minInclusive:false,maxInclusive:true,val:'NOTE 3'},
    ]);
  }
  if (surf === '5_OR_7_SEAL') {
    if (agg === '5_OR_7') return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:'NOTE 1'}, {min:0.3,max:0.9,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.9,max:1.5,minInclusive:false,maxInclusive:true,val:0.2}, {min:1.5,max:2.2,minInclusive:false,maxInclusive:true,val:0.3},
      {min:2.2,max:3.2,minInclusive:false,maxInclusive:true,val:0.4}, {min:3.2,max:1e9,minInclusive:false,maxInclusive:true,val:0.5},
    ]);
    if (agg === '10') return R([
      {min:0,max:0.3,minInclusive:true,maxInclusive:true,val:'NOTE 1'}, {min:0.3,max:0.7,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.7,max:1.1,minInclusive:false,maxInclusive:true,val:0.2}, {min:1.1,max:1.8,minInclusive:false,maxInclusive:true,val:0.3},
      {min:1.8,max:2.2,minInclusive:false,maxInclusive:true,val:0.4}, {min:2.2,max:1e9,minInclusive:false,maxInclusive:true,val:'NOTE 3'},
    ]);
    return R([
      {min:0,max:0.2,minInclusive:true,maxInclusive:true,val:'NOTE 1'}, {min:0.2,max:0.6,minInclusive:false,maxInclusive:true,val:0.1},
      {min:0.6,max:0.9,minInclusive:false,maxInclusive:true,val:0.2}, {min:0.9,max:1.4,minInclusive:false,maxInclusive:true,val:0.3},
      {min:1.4,max:2.0,minInclusive:false,maxInclusive:true,val:0.4}, {min:2.0,max:1e9,minInclusive:false,maxInclusive:true,val:0.5},
    ]);
  }
  return { value: null, numeric: 0, display: 'NO MATCH', note: `No TN175 Q6.3 match for existing surface ${surfaceType}, proposed aggregate ${aggregateSize}, texture ${sandPatch}.`, source: 'TN175 Table Q6.3' };
}
function isEmulsionOrCutbackBinder(binder) {
  const b = norm(binder);
  return b.includes('EMULSION') || b.includes('AMC') || b.includes('CUTBACK') || b.includes('CUT BACK') || b.includes('HBCE');
}
function tn175BinderFactorFallback(sealType, treatment, binder) {
  const type = norm(uiSealTypeToLookupType(sealType));
  const tr = norm(treatment);
  const b = norm(binder);
  const isDouble = type.includes('DOUBLE');
  const isSecond = type.includes('2ND');

  // TN175 Table Q6.4 (single/single) and Q6.5 (double/double) binder factors.
  // These override Part 4K when SPEC = TN175.
  if (b === 'M500') return 1.1;
  if (['C170','C240','C320'].includes(b) || b.includes('CRUMB')) return 1.0;
  if (b.includes('67') || b.includes('HBCE') || b.includes('HIGH BINDER CONTENT')) return 1.1;
  if (b.includes('EMULSION') || b.includes('60')) return 1.0;

  if (tr.includes('WPA') || tr.includes('WP-A') || tr.includes('WATERPROOF')) {
    if (['S20E','S25E','S15R','S15RF','S18RF'].includes(b) || b === 'C170') return 1.3;
  }
  if (tr.includes('SAMI') || tr.includes('INTERLAYER')) {
    if (['S25E','S18RF'].includes(b)) return 1.3; // lower end of TN175 1.3–1.52 range, designer note added.
  }
  if (tr.includes('SAM') && !tr.includes('SAMI')) {
    if (isDouble) return 1.1;
    if (['S10E','S35E','S9R','S9RF'].includes(b)) return 1.2;
    if (['S15E','S15R','S15RF','S20E'].includes(b)) return 1.31;
  }
  if (tr.includes('XSS') || tr.includes('EXTREME')) {
    if (['S15E','S15R','S15RF','S20E'].includes(b)) return 1.1;
  }
  if (tr.includes('HSS') || tr.includes('HIGH STRESS')) {
    if (['S10E','S35E','S9R','S9RF'].includes(b)) return 1.0;
    if (['S15E','S15R','S15RF','S20E'].includes(b)) return 1.1;
  }
  return null;
}
function buildDesignNotes(r) {
  const notes = [];
  const spec = norm(r.v.spec);
  const fi = asNum(r.v.flIndex, NaN);
  const ald = asNum(r.v.aldMirror, NaN);
  const textureInput = asNum(r.v.surfaceTexture, NaN);
  const ast = r.ar.numeric;
  const laneSplit = asNum(r.v.laneSplit, 50);
  const aba = allowanceNum(r.v.aba);
  const ap = allowanceNum(r.v.ap);
  const ae = r.ae?.numeric ?? 0;
  const cutback = isCutbackBinder(r.v.binder);
  const isSecondCoat = String(r.v._secondCoat || '') === '1';
  const coatPrefix = isSecondCoat ? 'Second coat – ' : '';

  if (r.samiMode) {
    const source = spec === 'TN175' ? 'TN175 Section 5.5.4 / Table Q5.5.4; Part 4K Equation 4' : 'AGPT04K-26 Section 5.5.4';
    notes.push(note('APPLIED', coatPrefix + 'WATERPROOFING / SAMI / WP-A DESIGN VOIDS FACTOR', `${r.v.treatment} selected. Design voids factor VF is fixed at 0.17; normal basic voids factor and Va/Vt/Other adjustments are not applied.`, source));
    notes.push(note('APPLIED', coatPrefix + 'WATERPROOFING / INTERLAYER TREATMENT', `${r.v.treatment} is treated as a waterproofing/interlayer style treatment. If it will be left under traffic for longer, review whether it should be designed as a SAM or normal wearing seal instead.`, source));
    if (spec !== 'TN175' && r.finalBinder < 1.8) {
      notes.push(note('WARNING', coatPrefix + 'WATERPROOFING / SAMI MINIMUM BINDER RATE', `${r.v.treatment} calculated binder rate is ${round(r.finalBinder,1).toFixed(1)} L/m². 4K recommends a minimum design binder application rate of 1.8 L/m² for effective crack reflection performance where this SAMI-style rule is used.`, 'AGPT04K-26 Section 5.5.4'));
    }
  }

  if (spec === 'TN175' && !isSecondCoat) {
    notes.push(note('APPLIED', 'TN175 / TMR mode', 'TN175 mode selected. TN175 is treated as a TMR amendment layer to Part 4K: TN175 rules override 4K where coded; 4K still applies where TN175 is silent.', 'TN175 Section 1'));
  }
  if (spec === 'TN175' && r.bf) {
    notes.push(note('APPLIED', coatPrefix + 'TN175 binder factor', `Binder factor BF = ${r.bf} applied for ${r.v.treatment} with ${r.v.binder}. TN175 Table Q6.4 applies for single/single seals and Table Q6.5 applies for double/double seals.`, isSecondCoat ? 'TN175 Table Q6.5' : 'TN175 Table Q6.4 / Table Q6.5'));
    const tr = norm(r.v.treatment);
    const b = norm(r.v.binder);
    if ((tr.includes('SAMI') || tr.includes('INTERLAYER')) && (b === 'S25E' || b === 'S18RF')) {
      notes.push(note('CHECK', coatPrefix + 'SAMI binder factor range', 'TN175 lists SAMI binder factor as 1.3–1.52 for S25E/S18RF. The app uses the lower end (1.3) until the project-specific adopted factor is confirmed.', 'TN175 Table Q6.4'));
    }
    if (!isSecondCoat && r.ehvPct >= 25) {
      notes.push(note('CHECK', 'TN175 binder factor reduction review', 'High heavy-vehicle percentage detected. TN175 notes binder factors may be reduced by 0.1 in high stress / very heavy traffic conditions, but must not be reduced below 1.0. Apply only by designer judgement, not automatically.', isDoubleFirst(r.v.sealType) ? 'TN175 Table Q6.5 Note 1' : 'TN175 Table Q6.4 Note 1'));
    }
    if (isTn175WpA(r.v.treatment)) {
      if (['S15R','S15RF','S18RF'].includes(b)) notes.push(note('CHECK', 'TN175 WP-A PMB experience risk', `${r.v.binder} selected for WP-A. TN175 says TMR has limited experience with S15R/S15RF/S18RF in WP-A and bleeding-through-asphalt risk is not yet determined; use should be limited to small-scale trials until more experience is gained.`, 'TN175 Table Q6.4 Note 3'));
      if (b === 'C170') notes.push(note('CHECK', 'TN175 WP-A C170 approval', 'C170 selected for WP-A / waterproofing. TN175 allows C170 only where approved by the Administrator and says consider reducing binder application rate to minimise bleeding through asphalt surfacing.', 'TN175 Section 5.5.4 / Table Q5.5.4 / Table Q6.4 Note 2'));
    }
    if (isTn175Sami(r.v.treatment) && b === 'S18RF') {
      notes.push(note('CHECK', 'TN175 SAMI S18RF experience risk', 'S18RF selected for SAMI. TN175 says TMR has limited experience with S18RF for SAMI and use should be limited to small-scale trials until more experience is gained.', 'TN175 Table Q6.4 Note 2'));
    }
  }

  if (cutback) {
    const zeroAllowance = aba === 0 && ap === 0 ? ' Aba and Ap are currently 0, so confirm no absorption allowance is required.' : '';
    notes.push(note('CHECK', coatPrefix + 'Cutback binder / AMC', `${r.v.binder} selected. Consider whether +0.1 L/m² is required for binder absorption/porous pavement conditions. For initial seals on granular/unbound or porous pavement, pavement absorption commonly sits in the +0.1 to +0.2 L/m² check range. Do not add it blindly; enter the allowance in Ap or Aba only when the pavement/aggregate condition justifies it.${zeroAllowance} Confirm cutter oil proportion suits the surface and conditions.`, 'AGPT04K-26 Table 4.6 Note 2 / Section 6.2.4; TN175 Sections 4.8 and 4.8.1 where applicable'));
  }

  if (!Number.isFinite(ald) || ald <= 0) {
    notes.push(note('WARNING', coatPrefix + 'ALD', 'ALD is missing or zero. Binder rate and aggregate spread cannot be trusted.', 'AGPT04K-26 Section 5.3.1'));
  }

  if (Number.isFinite(fi)) {
    notes.push(note(r.shape.level, coatPrefix + 'Flakiness Index', r.shape.message, 'AGPT04K-26 Table 6.1'));
  } else {
    notes.push(note('WARNING', coatPrefix + 'Flakiness Index', r.shape.message, 'AGPT04K-26 Table 6.1'));
  }

  if (r.vt !== 0) {
    notes.push(note('APPLIED', coatPrefix + 'Traffic effects', `Traffic effects adjustment Vt = ${round(r.vt,3)} applied from EHV ${round(r.ehvPct,2)}%, gradient '${r.v.gradient}', and channelised/braking '${r.v.braking}'.`, 'AGPT04K-26 Table 6.2 / traffic effects lookup'));
  }
  if (r.otherAdjustment !== 0) {
    notes.push(note('APPLIED', coatPrefix + 'Other voids adjustment', `Other voids adjustment = ${round(r.otherAdjustment,3)} applied by designer entry.`, 'Designer entry'));
  }

  if (!isSecondCoat) {
    if (!Number.isFinite(textureInput)) {
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture input is missing. Ast lookup has been treated as 0.', r.ar.source || r.ar.source || 'Lookups tab surface texture table'));
    } else if (textureInput < 0) {
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture input cannot be negative.', 'Designer check'));
    }
    const arNote = norm(r.ar.value);
    if (arNote === 'NOTE 1') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 1: embedment considerations are dominant. Review embedment allowance and treatment suitability.', r.ar.source || 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 2') {
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 2: specialised treatments are necessary. Do not treat this as a normal Ast allowance.', r.ar.source || 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 3') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 3: this treatment might not be advisable depending on aggregate shape/interlock. Consider alternative treatment, surface enrichment, or smaller aggregate seal.', r.ar.source || 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 4') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 4: for aggregate sizes greater than 14 mm, adopt allowances applicable to 14 mm aggregate.', r.ar.source || 'Lookups tab surface texture table'));
    } else if (r.ar.note && r.ar.value === '') {
      notes.push(note('APPLIED', 'Surface texture / sand patch', r.ar.note, 'Calculation sheet surface texture rule'));
    } else if (ast > 0.5) {
      notes.push(note('WARNING', 'Surface texture / sand patch', `Surface texture allowance Ast = ${ast} L/m² applied from the lookup. This is high; review aggregate size and/or treatment selection.`, r.ar.source || r.ar.source || 'Lookups tab surface texture table'));
    } else if (ast !== 0 || Number.isFinite(textureInput)) {
      notes.push(note('APPLIED', 'Surface texture / sand patch', `Surface texture allowance Ast = ${ast} L/m² applied from surface '${r.v.surfaceType}', aggregate '${r.v.aggregateSize}', and sand patch ${r.v.surfaceTexture}.`, r.ar.source || 'Lookups tab surface texture table'));
    }

    if (ap > 0.2) {
      notes.push(note('WARNING', 'Binder Abs. by Pav.', `Pavement absorption allowance Ap = ${ap} L/m². 4K says allowances above 0.2 L/m² should trigger consideration of an alternative treatment.`, 'AGPT04K-26 Section 6.2.4'));
    } else if (ap > 0) {
      notes.push(note('APPLIED', 'Binder Abs. by Pav.', `Pavement absorption allowance Ap = ${ap} L/m² applied. Confirm this matches pavement type and surface condition.`, 'AGPT04K-26 Section 6.2.4'));
    }
    if (aba > 0.1) {
      notes.push(note('WARNING', 'Binder Abs. by Agg.', `Aggregate absorption allowance Aba = ${aba} L/m². 4K says aggregate absorption, if required, should not usually exceed 0.1 L/m².`, 'AGPT04K-26 Section 6.2.4'));
    } else if (aba > 0) {
      notes.push(note('APPLIED', 'Binder Abs. by Agg.', `Aggregate absorption allowance Aba = ${aba} L/m² applied. Confirm aggregate is absorptive/porous/vesicular and tested.`, 'AGPT04K-26 Section 6.2.4'));
    }
    if (r.ae?.display === 'NOTE') {
      notes.push(note('CHECK', 'Embedment', r.ae.note, 'Calculation sheet embedment lookup'));
    } else if (ae !== 0) {
      notes.push(note('APPLIED', 'Embedment', `Embedment allowance Ae = ${ae} L/m² applied from design traffic ${round(r.traffic.vld,0)} v/l/d and ball penetration ${r.v.ballpin} mm.`, 'Calculation sheet embedment lookup / AGPT04K-26 Section 6.2.3'));
    }

  }
  if (isSecondCoat) {
    notes.push(note('APPLIED', 'Second coat allowances', 'Second coat allowance rules applied: Ast = N/A, Ap = N/A and Ae = N/A for an immediate double/double second application. Aba2 is the only allowance 4K says could be considered, and is usually nil for normal aggregates.', 'AGPT04K-26 Section 5.5.2'));
    if (aba > 0.1) {
      notes.push(note('WARNING', 'Second coat – Binder Abs. by Agg.', `Second coat aggregate absorption allowance Aba2 = ${aba} L/m². 4K says aggregate absorption, if required, should not usually exceed 0.1 L/m².`, 'AGPT04K-26 Sections 5.5.2 and 6.2.4'));
    } else if (aba > 0) {
      notes.push(note('APPLIED', 'Second coat – Binder Abs. by Agg.', `Second coat aggregate absorption allowance Aba2 = ${aba} L/m² applied. Confirm the second coat aggregate is absorptive/porous/vesicular and tested.`, 'AGPT04K-26 Sections 5.5.2 and 6.2.4'));
    }
  }


  if (!isSecondCoat && laneSplit !== 50) {
    notes.push(note('CHECK', 'Design lane split', `Design lane split is ${laneSplit}%, not 50%. Confirm this is intentional.`, 'Traffic distribution check'));
  }

  if (!isSecondCoat && (r.shvPct + r.lhvPct) > 100) {
    notes.push(note('WARNING', 'Traffic breakdown', 'SHV% + LHV% exceeds 100%. LV has been forced to 0, but the input is invalid.', 'Traffic breakdown check'));
  }
  if (!isSecondCoat && r.ehvPct > 45) {
    notes.push(note('WARNING', 'EHV %', `EHV is ${round(r.ehvPct,2)}%. High heavy-vehicle loading: check treatment/binder selection.`, 'AGPT04K-26 Section 5.2.5'));
  } else if (!isSecondCoat && r.ehvPct > 25) {
    notes.push(note('CHECK', 'EHV %', `EHV is ${round(r.ehvPct,2)}%. Review heavy vehicle effects and stress conditions.`, 'AGPT04K-26 Section 5.2.5'));
  }


  if (spec === 'TN175') {
    if (!isSecondCoat && (r.ehvPct >= 25 || r.traffic.aadt >= 1000)) {
      notes.push(note('CHECK', 'TN175 variable-rate spray review', `High EHV/AADT conditions can make one uniform spray rate too low in non-wheelpaths but too high in wheelpaths. If texture allowance differs by ≥0.3 L/m² across the lane, TN175 says variable-rate spraying should be considered. Variable-rate seals are not typically used where daily minimum air temperature is expected below 10°C within one month after completion.`, 'TN175 Section 3.4.1'));
    }
    if (!isSecondCoat && r.ar?.source?.includes('TN175')) {
      notes.push(note('APPLIED', 'TN175 surface texture allowance', `TN175 Table Q6.3 surface texture allowance used for existing surface '${r.v.surfaceType}', proposed aggregate '${r.v.aggregateSize}', texture ${r.v.surfaceTexture}. Result: ${r.ar.display}.`, 'TN175 Table Q6.3'));
    }
    if ((r.agg?.source || '').includes('TN175')) {
      const range = r.agg.displayM2M3 ? ` Calculated application rate display: ${r.agg.displayM2M3} m²/m³.` : '';
      notes.push(note('APPLIED', coatPrefix + 'TN175 aggregate spread rate', (r.agg.note || `TN175 aggregate spread rate rule applied. Base ${r.agg.displayBase || r.agg.base} m²/m³.`) + range, r.agg.source));
    }
    const bp = asNum(r.v.ballpin, NaN);
    const limit = r.traffic.vld > 2000 ? 3 : 4;
    if (!isSecondCoat && Number.isFinite(bp)) {
      if (bp > limit) notes.push(note('WARNING', 'TN175 embedment / ball penetration', `Ball penetration ${bp} mm exceeds TN175 prepared surface limit of ${limit} mm for ${round(r.traffic.vld,0)} v/l/d. Defer sealing, re-prepare/strengthen, or consider armour coat options before sealing.`, 'TN175 Section 6.2.3'));
      else notes.push(note('APPLIED', 'TN175 embedment / ball penetration', `Ball penetration ${bp} mm is within the TN175 prepared surface limit of ${limit} mm for ${round(r.traffic.vld,0)} v/l/d.`, 'TN175 Section 6.2.3'));
    }
    if (!isSecondCoat && r.second) {
      const halfAld = asNum(r.ald,0) / 2;
      const secondAld = asNum(r.second.ald,0);
      const secondFi = asNum(r.second.v.flIndex, NaN);
      if (secondAld > halfAld) {
        const fiOk = Number.isFinite(secondFi) && secondFi >= 16 && secondFi <= 25;
        notes.push(note(fiOk ? 'CHECK' : 'WARNING', 'TN175 double seal ALD / interlock', `Second coat ALD ${round(secondAld,2)} mm is greater than half the first coat ALD (${round(halfAld,2)} mm). TN175 requires second layer FI to target 16–25%, a more open/lighter first coat spread rate (about 10–20% lighter than typical), and possible total binder reduction up to 0.2 L/m². Current second FI: ${Number.isFinite(secondFi) ? secondFi : 'missing'}%.`, 'TN175 Table Q4.3.2'));
      } else {
        notes.push(note('APPLIED', 'TN175 double seal ALD / interlock', `Second coat ALD ${round(secondAld,2)} mm is approximately half or less than first coat ALD (${round(r.ald,2)} mm). TN175 marks this aggregate relationship as acceptable subject to contract requirements.`, 'TN175 Table Q4.3.2'));
      }
    }
    if (!isSecondCoat) {
      const area = r.v.designArea || 'Traffic lane / wheel path';
      const areaKey = norm(area);
      const lowTraffic = r.traffic.vld < 100;
      if (areaKey.includes('TRAFFIC LANE') || areaKey.includes('WHEEL PATH')) {
        notes.push(note('APPLIED', 'TN175 design area', 'Design area selected as Traffic lane / wheel path. Normal trafficked-lane Vt logic has been applied.', 'TN175 Section 6.1.2 / Part 4K Table 6.2'));
      } else if (areaKey.includes('WIDE SHOULDER')) {
        notes.push(note(lowTraffic ? 'CHECK' : 'CHECK', 'TN175 Vt – wide shoulder', `Design area selected as Wide shoulder. ${lowTraffic ? 'Traffic is below 100 v/l/d; TN175 says Vt = 0.00 can be used for areas such as wide shoulders.' : 'Traffic is not below 100 v/l/d; confirm whether the shoulder should be designed from its own traffic or through-lane traffic.'} Review the selected Vt rather than blindly using the traffic-lane value.`, 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('NARROW SHOULDER')) {
        notes.push(note('CHECK', 'TN175 Vt – narrow shoulder', 'Design area selected as Narrow shoulder. TN175 says where through-lane traffic counts are used for narrow shoulders, Vt = +0.02 can be used. Confirm whether through-lane traffic is being used for this design area.', 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('CENTRELINE')) {
        notes.push(note('CHECK', 'TN175 Vt – centreline / between lanes', 'Design area selected as Centreline / between lanes. TN175 says where through-lane traffic counts are used for centrelines, Vt = +0.02 can be used. Confirm the area is a centreline/between-lanes strip and not a median or traffic lane.', 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('MEDIAN')) {
        notes.push(note('CHECK', 'TN175 Vt – median', 'Design area selected as Median / painted or physical median. Confirm whether the median is genuinely non-trafficked or whether through-lane traffic counts are being used; TN175 mentions medians in the Vt guidance.', 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('HEAVY VEHICLE REST')) {
        notes.push(note('CHECK', 'TN175 Vt – heavy vehicle rest area', `Design area selected as Heavy vehicle rest area. TN175 recommends reviewing final binder rates for single/single seals where traffic is <100 v/l/d, especially heavy vehicle rest areas with high heavy vehicle percentages, high stress, vehicle wander and hot climates. Current traffic: ${round(r.traffic.vld,0)} v/l/d.`, 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('REST AREA') || areaKey.includes('PARKING')) {
        notes.push(note('CHECK', 'TN175 Vt – rest area / parking area', 'Design area selected as Rest area / parking area. Do not treat this as simply non-trafficked: vehicles may park, turn, brake and accelerate. Review Vt, stress condition, heavy vehicle percentage and final binder rate.', 'TN175 Section 6.1.2'));
      } else if (areaKey.includes('GORE') || areaKey.includes('PAINTED ISLAND') || areaKey.includes('NON-TRAFFICKED')) {
        notes.push(note('CHECK', 'TN175 Vt – gore / non-trafficked sealed area', `Design area selected as Gore / painted island / non-trafficked sealed area. Confirm whether it is truly non-trafficked or designed using adjacent through-lane traffic. ${lowTraffic ? 'Where traffic is below 100 v/l/d, Vt = 0.00 may be appropriate for some low/non-trafficked areas.' : 'If through-lane traffic counts are being used, TN175 may justify Vt = +0.02.'}`, 'TN175 Section 6.1.2'));
      }
    }
    if (r.samiMode) {
      const tr = norm(r.v.treatment);
      const aggClass = aggregateSizeClass(r.v.aggregateSize);
      const isSami = isTn175Sami(r.v.treatment);
      const isWpa = isTn175WpA(r.v.treatment);
      if (isSami && !(aggClass === '14_PLUS')) notes.push(note('CHECK', coatPrefix + 'TN175 SAMI aggregate size', `TN175 typically uses 14 mm aggregate for SAMI, with 16 mm sometimes used where 14 mm is unavailable. Current aggregate: ${r.v.aggregateSize}.`, 'TN175 Section 5.5.4 / Table Q5.5.4'));
      if (isSami && norm(r.v.aggregateSize).includes('16')) notes.push(note('CHECK', coatPrefix + 'TN175 SAMI 16 mm aggregate', '16 mm aggregate is sometimes used where 14 mm is not locally available. Increase binder application rate as appropriate where 16 mm is used for SAMI sealing.', 'TN175 Section 5.5.4 footnote 1'));
      if (isWpa && !(aggClass === '10' || aggClass === '14_PLUS')) notes.push(note('CHECK', coatPrefix + 'TN175 WP-A aggregate size', `TN175 WP-A typically uses 10 mm or 14 mm aggregate. Current aggregate: ${r.v.aggregateSize}.`, 'TN175 Section 5.5.4 / Table Q5.5.4'));
      if (isWpa) notes.push(note('CHECK', coatPrefix + 'TN175 WP-A treatment selection', 'WP-A with PMB is designed the same as SAMI except 10 mm aggregate is typically used to achieve lower binder rates around 1.5–1.6 L/m². 14 mm must be used under SMA14. Binder selection requires Administrator approval.', 'TN175 Section 5.5.4 / Table Q5.5.4'));
      if (isCutbackBinder(r.v.binder)) notes.push(note('WARNING', coatPrefix + 'TN175 SAMI/WP-A cutter', 'No cutter should be used in SAMI or WP-A seals. Do not use AMC/cutback binder for SAMI/WP-A unless the design is explicitly reviewed and approved.', 'TN175 Section 5.5.4 Binder additives'));
      if (isWpa && norm(r.v.binder) === 'C170') notes.push(note('CHECK', coatPrefix + 'TN175 WP-A C170 approval', 'C170 may be used in WP-A only where approved by the Administrator, generally for minimal areas or small isolated exposed granular sections; consider tack coat to exposed granular surface and consider reducing binder rate to minimise bleeding through asphalt.', 'TN175 Section 5.5.4 / Table Q5.5.4 Note 2'));
      if (isSami) notes.push(note('CHECK', coatPrefix + 'TN175 SAMI high shear review', 'TN175 says SAMI is typically around 2.0–2.5 L/m² and can be reduced to 1.5–1.8 L/m² in high shear locations such as approaches to signalised intersections or roundabouts. Milling prior to placement can be considered instead of reducing binder where mechanical interlock is needed.', 'TN175 Section 5.5.4 / Table Q5.5.4 Note 3'));
      if (isSami && r.finalBinder < 1.8) notes.push(note('WARNING', coatPrefix + 'TN175 SAMI spray rate', `SAMI binder rate ${round(r.finalBinder,1)} L/m² is below the TN175 typical minimum of 1.8 L/m². Typical SAMI is 2.0–2.5 L/m², with 1.5–1.8 L/m² only for high shear risk locations.`, 'TN175 Table Q5.5.4'));
      if (isWpa) {
        const min = aggClass === '14_PLUS' ? 1.8 : 1.5;
        if (r.finalBinder < min) notes.push(note('WARNING', coatPrefix + 'TN175 WP-A spray rate', `WP-A binder rate ${round(r.finalBinder,1)} L/m² is below TN175 typical minimum of ${min} L/m² for ${r.v.aggregateSize}.`, 'TN175 Table Q5.5.4'));
      }
      notes.push(note('APPLIED', coatPrefix + 'TN175 interlayer aggregate spread', 'SAMI and WP-A aggregate spread rates are typically 20% lighter than standard single/single seal spread rates to ensure asphalt layer adhesion. Overspreading can cause debonding and/or shoving failures.', 'TN175 Section 5.5.4 / Table Q6.10'));
    }
    if (isTn175SsUnderAsphalt(r.v.treatment)) {
      notes.push(note('CHECK', coatPrefix + 'TN175 S/S waterproofing under asphalt', 'For exposed granular pavement under asphalt, TN175 typically requires a prime followed by a single/single seal or initial seal to waterproof the pavement. If immediate trafficking is required, an initial seal can be used in lieu of prime and seal. Adequate prime curing time must be allowed.', 'TN175 Section 5.5.4 / Table Q5.5.4'));
      if (norm(r.v.binder).startsWith('S')) notes.push(note('CHECK', coatPrefix + 'TN175 PMB adhesion on primed granular surface', 'TN175 notes reduced adhesion may occur between primed granular pavement and polymer modified binder compared with primed granular pavement and C170.', 'TN175 Section 5.5.4'));
    }
    const sprayMin = tn175TypicalSprayMinimum(r.v.treatment, r.v.aggregateSize);
    if (sprayMin && !r.samiMode) {
      if (r.finalBinder < sprayMin.min) notes.push(note('WARNING', coatPrefix + 'TN175 typical spray rate', `Design binder rate ${round(r.finalBinder,2)} L/m² is below TN175 typical minimum ${sprayMin.min} L/m² (${sprayMin.typical}).`, sprayMin.source));
      else notes.push(note('APPLIED', coatPrefix + 'TN175 typical spray rate', `Design binder rate ${round(r.finalBinder,2)} L/m² meets TN175 typical check: ${sprayMin.typical}.`, sprayMin.source));
    }
    if (r.emulsionContent) {
      notes.push(note('APPLIED', coatPrefix + 'Emulsion spray rate', `Emulsion binder selected. Residual binder rate ${round(r.finalBinder,2)} L/m² converts to approximate emulsion spray rate ${round(r.emulsionSprayRate,2)} L/m² at ${round(r.emulsionContent*100,0)}% binder content. Confirm product binder content from supplier/MRTS12 before adoption.`, 'TN175 Sections 4.8.1 and Table Q6.4/Q6.5; product data required'));
    }
    if (!isSecondCoat && isCutbackBinder(r.v.binder) && norm(r.v.binder).includes('AMC7')) {
      notes.push(note('CHECK', 'TN175 AMC7 / initial seal risk', 'AMC7 is a low cutter content cutback. TN175 flags poor adhesion risk where surface preparation is dusty/cementitiously stabilised, and notes AMC7 is commonly used in hot conditions or to reduce curing time but flushing/bleeding risk must be assessed.', 'TN175 Sections 4.8 and 4.8.1'));
    }
  }

  if (!r.bf) {
    notes.push(note('WARNING', coatPrefix + 'Binder factor', 'Binder factor not found for this SPEC + TYPE + TREATMENT + BINDER. Do not use the binder rate until mapped/validated.', 'Extracted Lookups tab / AGPT04K-26 Tables 6.4 and 6.5'));
  }
  if (r.finalBinder <= 0) {
    notes.push(note('WARNING', coatPrefix + 'Design binder rate', 'Calculated binder rate is zero or negative. Inputs are incomplete, unsupported, or the lookup is missing.', 'Calculation check'));
  }
  return notes;
}

function surfaceTextureAllowance(spec, surfaceType, aggregateSize, sandPatch, sealType, treatment) {
  const sourceLabel = isTn175(spec) ? 'TN175 Table Q6.3' : 'AGPT04K-26 Table 6.3 / workbook Lookups tab';
  const st = norm(sealType);
  const tr = norm(treatment);
  const surf = norm(surfaceType);
  const sp = asNum(sandPatch, NaN);

  if (tr === 'HATELIT' || tr === 'HUESKER CHIPSEAL GRID A10' || tr === 'HUESKER CHIPSEAL GRID A15' || st === 'DOUBLE 2ND COAT' || surf === 'N/A') {
    return { value: 'N/A', numeric: 0, display: 'N/A', note: 'Surface texture allowance is not applicable for an immediate double/double second application.', source: sourceLabel };
  }
  if (['GRANULAR','FOAMED BITUMEN','PRIMED','PRIMER SEAL','BRIDGE DECK'].includes(surf)) {
    return { value: 0, numeric: 0, display: '0', note: 'Surface type is treated as 0 surface texture allowance by the calculation-sheet rule.', source: sourceLabel };
  }
  if (isTn175(spec)) return tn175SurfaceTextureAllowance(surfaceType, aggregateSize, sandPatch);
  if (!Number.isFinite(sp)) {
    return { value: null, numeric: 0, display: '0', note: 'No sand patch/texture value entered.', source: sourceLabel };
  }

  const row = tableRows('LookupsTbl').find(r =>
    norm(r.KeyA || r['A (Agg Size 1)']) === norm(surfaceType) &&
    norm(r.KeyB || r['B (Agg Size 2)']) === norm(aggregateSize) &&
    asNum(r['C (Min Sand Patch)']) <= sp &&
    asNum(r['D (Max Sand Patch)']) >= sp
  );
  if (!row) return { value: null, numeric: 0, display: 'NO MATCH', note: `No surface texture lookup match for surface ${surfaceType}, aggregate ${aggregateSize}, sand patch ${sandPatch}.`, source: sourceLabel };

  const raw = row['E (Value)'];
  const rawNorm = norm(raw);
  const numeric = Number.isFinite(Number(raw)) ? Number(raw) : 0;
  return { value: raw, numeric, display: rawNorm.startsWith('NOTE') ? rawNorm : String(raw), note: '', source: sourceLabel };
}

function embedmentAllowance(vld, ballpin, spec = '') {
  const bpRaw = String(ballpin ?? '').trim();
  const bp = asNum(ballpin, NaN);
  const traffic = asNum(vld, 0);
  if (norm(bpRaw) === 'N/A') return { value: 'N/A', numeric: 0, display: 'N/A', note: '' };
  if (bpRaw === '') return { value: 0, numeric: 0, display: '0', note: '' };
  if (isTn175(spec) && Number.isFinite(bp)) {
    const limit = traffic > 2000 ? 3 : 4;
    if (bp > limit) return {
      value: 'NOTE',
      numeric: 0,
      display: 'NOTE',
      note: `Ball penetration ${bp} mm exceeds the TN175 prepared-surface limit of ${limit} mm for ${round(traffic,0)} v/l/d. Do not treat this as a simple allowance. TN175 says excessive embedment on underlying pavements is typically avoided where the prepared surface is sufficiently hard. Consider dry-back/retest, re-preparation, strengthening/stabilising, or a small aggregate armour-coat option before sealing.`
    };
  }
  if (bpRaw === '>3' || (!isTn175(spec) && Number.isFinite(bp) && bp > 3)) return { value: 'NOTE', numeric: 0, display: 'NOTE', note: 'Ball penetration is greater than 3 mm. Spreadsheet returns NOTE; designer review is required rather than a simple numeric embedment allowance.' };
  if (!Number.isFinite(bp)) return { value: 0, numeric: 0, display: '0', note: 'Ball penetration value is not numeric; embedment allowance set to 0 until checked.' };

  let ae = 0;
  if (bp === 1) {
    if (traffic > 1200 && traffic <= 2600) ae = -0.1;
    else if (traffic > 2600 && traffic <= 9500) ae = -0.2;
    else if (traffic > 9500 && traffic <= 10000) ae = -0.3;
  } else if (bp === 2) {
    if (traffic > 800 && traffic <= 1800) ae = -0.1;
    else if (traffic > 1800 && traffic <= 4200) ae = -0.2;
    else if (traffic > 4200 && traffic <= 10000) ae = -0.3;
  } else if (bp === 3) {
    if (traffic > 400 && traffic <= 1400) ae = -0.1;
    else if (traffic > 1400 && traffic <= 2600) ae = -0.2;
    else if (traffic > 2600 && traffic <= 10000) ae = -0.3;
  }
  return { value: ae, numeric: ae, display: String(round(ae, 2)), note: '' };
}


function isDoubleFirst(sealType) { return isDoubleSeal(sealType); }
function secondCoatAggregate(firstAgg) {
  const a = norm(firstAgg);
  if (a.includes('14')) return '7mm';
  if (a.includes('10')) return '7mm';
  if (a.includes('7')) return '5mm';
  return '7mm';
}
function defaultAldForAggregate(agg, fallback = 3.8) {
  const a = norm(agg);
  if (a.includes('14')) return 8.4;
  if (a.includes('10')) return 5.7;
  if (a.includes('7')) return 3.8;
  if (a.includes('5')) return 2.8;
  return fallback;
}

function rateRangeText(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
  const a = Math.round(min);
  const b = Math.round(max);
  return a === b ? String(a) : `${a}–${b}`;
}
function tnRateRange(baseMin, baseMax, aldNum) {
  const lo = baseMin / aldNum;
  const hi = baseMax / aldNum;
  return { min: lo, max: hi, displayM2M3: rateRangeText(lo, hi) };
}
function isUnderAsphaltTreatment(treatment) {
  const tr = norm(treatment);
  return tr.includes('S/S') || tr.includes('UNDER ASPHALT') || tr.includes('WPA') || tr.includes('WP-A') || tr.includes('SAMI') || tr.includes('WATERPROOFING');
}
function tn175TypicalSprayMinimum(treatment, aggregateSize) {
  const tr = norm(treatment);
  const cls = aggregateSizeClass(aggregateSize);
  if (tr.includes('SAMI')) return { min: 1.8, typical: 'typically 2.0–2.5 L/m²; 1.5–1.8 L/m² only in high shear risk locations', source: 'TN175 Table Q5.5.4' };
  if (isTn175WpA(treatment)) return { min: cls === '14_PLUS' ? 1.8 : 1.5, typical: cls === '14_PLUS' ? '≥1.8 L/m² for 14 mm WP-A' : '≥1.5 L/m² for 10 mm WP-A', source: 'TN175 Table Q5.5.4' };
  if (tr.includes('S/S') || tr.includes('WATERPROOFING')) {
    if (cls === '14_PLUS') return { min: 1.5, typical: '≥1.5 L/m² for 14 mm S/S under asphalt', source: 'TN175 Table Q5.5.4' };
    if (cls === '10') return { min: 1.2, typical: '≥1.2 L/m² for 10 mm S/S under asphalt', source: 'TN175 Table Q5.5.4' };
    return { min: 1.0, typical: '≥1.0 L/m² for 7 mm S/S under asphalt', source: 'TN175 Table Q5.5.4' };
  }
  return null;
}

function aggregateSpreadRate(spec, sealType, treatment, binder, ald, aggregateSize) {
  const st = norm(uiSealTypeToLookupType(sealType));
  const tr = norm(treatment);
  const agg = norm(aggregateSize);
  const aldNum = Math.max(asNum(ald, 1), 0.1);
  let base = 900;
  let source = isTn175(spec) ? 'TN175 Section 6.7' : 'AGPT04K-26 Section 6.7';

  // HARD TN175 OVERRIDE: when SPEC is TN175, aggregate spread rates must come from TN175
  // tables Q6.8-Q6.12 first. Do not fall back to the 4K fixed 900/ALD value.
  if (isTn175(spec)) {
    const cls = aggregateSizeClass(aggregateSize);
    const isSecond = st.includes('DOUBLE 2ND');
    const isFirstDouble = st.includes('DOUBLE 1ST');
    const isSingle = !isFirstDouble && !isSecond;

    function ranged(baseMin, baseMax, displayBase, source, noteText) {
      const rr = tnRateRange(baseMin, baseMax, aldNum);
      return {
        base: baseMin,
        baseMin,
        baseMax,
        displayBase,
        m2m3: rr.min,
        m2m3Min: rr.min,
        m2m3Max: rr.max,
        displayM2M3: rr.displayM2M3,
        fixed: false,
        source,
        note: noteText
      };
    }

    function fixed(value, displayBase, source, noteText, min=value, max=value) {
      return {
        base: value,
        baseMin: min,
        baseMax: max,
        displayBase,
        m2m3: value,
        m2m3Min: min,
        m2m3Max: max,
        displayM2M3: min === max ? String(Math.round(value)) : `${Math.round(min)}–${Math.round(max)}`,
        fixed: true,
        source,
        note: noteText
      };
    }

    // TN175 Table Q5.5.4 / Q6.10: SAMI and WP-A interlayers.
    if (tr === 'SAMI' || isTn175WpA(treatment)) {
      return ranged(
        1000,
        1100,
        '1000–1100',
        'TN175 Table Q5.5.4 / Table Q6.10',
        'TN175 SAMI/WP-A interlayer aggregate spread rate is 1000–1100/ALD. TN175 notes SAMI/WP-A aggregate spread rates are typically 20% lighter than standard single/single seal spread rates to ensure asphalt-layer adhesion.'
      );
    }

    // TN175 Table Q5.5.4: S/S waterproofing under asphalt.
    if (tr.includes('S/S') || tr.includes('WATERPROOFING')) {
      if (agg.includes('7')) {
        return fixed(220, '220', 'TN175 Table Q5.5.4', 'TN175 S/S under asphalt with 7 mm aggregate uses typical spread rate 220 m²/m³.');
      }
      return ranged(1000, 1100, '1000–1100', 'TN175 Table Q5.5.4', 'TN175 S/S under asphalt typical spread rate is 1000–1100/ALD for 14 mm and 10 mm aggregate.');
    }

    // TN175 Table Q6.12: double/double second application, little/no trafficking between applications.
    if (isSecond) {
      if (agg.includes('5')) {
        return fixed(225, '180–250', 'TN175 Table Q6.12', 'TN175 double/double second application with 7 or 5 mm no-ALD uses range 180–250 m²/m³.', 180, 250);
      }
      if (agg.includes('7')) {
        return ranged(800, 850, '800–850', 'TN175 Table Q6.12', 'TN175 double/double second application 7 mm aggregate spread rate range is 800/ALD–850/ALD.');
      }
      return ranged(850, 900, '850–900', 'TN175 Table Q6.12', 'TN175 double/double second application 10 mm aggregate spread rate range is 850/ALD–900/ALD.');
    }

    // TN175 Table Q6.11: double/double first application.
    if (isFirstDouble) {
      const cutbackEmulsion = isEmulsionOrCutbackBinder(binder);
      base = cutbackEmulsion ? 850 : 950;
      const val = base / aldNum;
      return {
        base,
        baseMin: base,
        baseMax: base,
        displayBase: `${base}`,
        m2m3: val,
        m2m3Min: val,
        m2m3Max: val,
        displayM2M3: String(Math.round(val)),
        fixed: false,
        source: 'TN175 Table Q6.11',
        note: `TN175 double/double first application spread rate ${base}/ALD applied based on binder class.`
      };
    }

    // TN175 Table Q6.8: single/single seals. This is the bug that previously fell back to 900/ALD.
    if (isSingle) {
      if (cls === '14_PLUS') {
        return ranged(900, 950, '900–950', 'TN175 Table Q6.8', 'TN175 single/single 14, 16 or 20 mm aggregate spread rate range is 900/ALD–950/ALD.');
      }
      if (cls === '10') {
        return ranged(800, 850, '800–850', 'TN175 Table Q6.8', 'TN175 single/single 10 mm aggregate spread rate range is 800/ALD–850/ALD.');
      }
      return ranged(750, 800, '750–800 or 180–230 no-ALD', 'TN175 Table Q6.8', 'TN175 single/single 7 or 5 mm aggregate spread rate range is 750/ALD–800/ALD, or 180–230 m²/m³ where no ALD is used.');
    }
  }

  // AGPT04K-26 aggregate spread rules from Tables 6.8, 6.11 and 6.12.
  if (tr === 'SAMI' || tr.includes('WATERPROOFING')) {
    base = 1000;
  } else if (st.includes('DOUBLE 2ND')) {
    if (agg.includes('5')) return { base: 225, displayBase:'225', m2m3: 225, m2m3Min:225, m2m3Max:225, displayM2M3:'225', fixed: true, source:'AGPT04K-26 Table 6.12' };
    base = 900;
  } else if (st.includes('DOUBLE 1ST')) {
    base = isEmulsionOrCutbackBinder(binder) ? 850 : 950;
  } else {
    base = isEmulsionOrCutbackBinder(binder) ? 800 : 900;
  }
  const m2m3 = base / aldNum;
  return { base, baseMin:base, baseMax:base, displayBase:String(base), m2m3, m2m3Min:m2m3, m2m3Max:m2m3, displayM2M3:String(Math.round(m2m3)), fixed: false, source:'AGPT04K-26 Tables 6.8 / 6.11 / 6.12' };
}

function emulsionBinderContent(binder) {
  const b = norm(binder);
  const m = b.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return asNum(m[1], 0) / 100;
  if (b.includes('67') || b.includes('HBCE')) return 0.67;
  if (b.includes('EMULSION')) return 0.60;
  return null;
}

function calculateCoat(v) {
  const shvPct = Math.max(0, asNum(v.shvPct));
  const lhvPct = Math.max(0, asNum(v.lhvPct));
  const hvPct = Math.min(100, shvPct + lhvPct);
  const ehvPct = Math.min(100, shvPct + (lhvPct * 3));
  const lvPct = Math.max(0, 100 - hvPct);
  const traffic = compoundTraffic(v);
  const samiMode = isSamiTreatment(v.treatment);
  const vfRaw = vehicleFactor(traffic.vld, v.sealType);
  const vtRaw = heavyVehicleGradientCorrection(ehvPct, v.gradient, v.braking);
  const shapeRaw = aggregateShapeAdjustment(v.flIndex);
  const bf = binderFactor(v.spec, v.sealType, v.treatment, v.binder);
  const ar = surfaceTextureAllowance(v.spec, v.surfaceType, v.aggregateSize, v.surfaceTexture, v.sealType, v.treatment);
  const otherRaw = allowanceNum(v.otherAdjustment);
  const ald = asNum(v.aldMirror, 0);
  const vf = samiMode ? 0 : vfRaw;
  const vt = samiMode ? 0 : vtRaw;
  const shape = samiMode ? { ...shapeRaw, va: 0, level: 'INFO', message: 'SAMI: aggregate shape adjustment not applied because VF is fixed at 0.17.' } : shapeRaw;
  const otherAdjustment = samiMode ? 0 : otherRaw;
  const designVf = samiMode ? 0.17 : (vf + shape.va + vt + otherAdjustment);
  const baseBinder = designVf * ald;
  const modifiedBinder = baseBinder * (bf ?? 0);
  const aba = allowanceNum(v.aba);
  const ap = allowanceNum(v.ap);
  const ae = embedmentAllowance(traffic.vld, v.ballpin, v.spec);
  const binderBeforeRounding = modifiedBinder + ar.numeric + aba + ap + ae.numeric;
  const finalBinder = samiMode ? round(Math.round(binderBeforeRounding * 10) / 10, 1) : binderBeforeRounding;
  const agg = aggregateSpreadRate(v.spec, v.sealType, v.treatment, v.binder, ald, v.aggregateSize);
  const emulsionContent = emulsionBinderContent(v.binder);
  const emulsionSprayRate = emulsionContent ? finalBinder / emulsionContent : null;
  return { v, traffic, shvPct, lhvPct, lvPct, ehvPct, samiMode, vf, vfRaw, vt, vtRaw, shape, shapeRaw, bf, ar, aba, ap, ae, otherAdjustment, otherRaw, ald, designVf, baseBinder, modifiedBinder, finalBinder, emulsionContent, emulsionSprayRate, agg, notes: [] };
}
function calculate() {
  const v = formValues();
  const result = calculateCoat(v);
  if (isDoubleFirst(v.sealType)) {
    const secondAgg = v.aggregateSize2 || secondCoatAggregate(v.aggregateSize);
    const secondV = {
      ...v,
      _secondCoat: '1',
      sealType: 'Double 2nd Coat',
      aggregateSize: secondAgg,
      aldMirror: v.aldMirror2 || defaultAldForAggregate(secondAgg, 3.8),
      flIndex: v.flIndex2 || v.flIndex,
      binder: v.binder2 || v.binder,
      // Second application is a separate coat over the first application.
      // It has its own ALD/flakiness/binder, but no existing-surface texture allowance,
      // no ball-penetration embedment allowance, and no pavement/aggregate absorption allowance.
      surfaceType: 'N/A',
      surfaceTexture: '',
      ballpin: 'N/A',
      aba: allowanceNum(v.aba2),
      ap: 0,
      otherAdjustment: 0
    };
    result.second = calculateCoat(secondV);
    result.secondLabel = `Double 2nd Coat / ${secondAgg}`;
  }
  result.notes = buildDesignNotes(result);
  if (result.second) {
    result.notes.unshift(note('APPLIED', 'Double/double second application', `Double Seal selected. A second calculation column has been applied as ${result.secondLabel}. The second coat uses its own ALD, flakiness index and binder. Ast, Ap and Ae are marked N/A; Aba2 remains optional and defaults to 0.`, 'AGPT04K-26 Section 5.5.2'));
    result.notes.push(...buildDesignNotes(result.second));
  }
  return result;
}
function noteIcon(level) {
  return level === 'WARNING' ? '⚠' : level === 'CHECK' ? '◆' : level === 'APPLIED' ? '✓' : 'i';
}
function renderNoteCard(n) {
  const source = n.source ? `<small>${safe(n.source)}</small>` : '';
  return `<div class="note-card ${safe(n.level.toLowerCase())}"><b>${noteIcon(n.level)} ${safe(n.level)} — ${safe(n.field)}</b><span>${safe(n.message)}</span>${source}</div>`;
}
function renderInlineNotes(notes) {
  const byField = new Map();
  notes.forEach(n => {
    if (!byField.has(n.field)) byField.set(n.field, []);
    byField.get(n.field).push(n);
  });

  $$('[data-note-for]').forEach(el => {
    const key = el.dataset.noteFor;
    let matches = [];
    if (key === 'flIndex') matches = [];
    if (key === 'ald' || key === 'aldMirror') matches = byField.get('ALD') || [];
    if (key === 'sandPatch') matches = byField.get('Surface texture / sand patch') || [];
    if (key === 'aba') matches = byField.get('Binder Abs. by Agg.') || [];
    if (key === 'ap') matches = (byField.get('Binder Abs. by Pav.') || []).concat(byField.get('Cutback binder / AMC') || []);
    if (key === 'ae') matches = byField.get('Embedment') || [];
    if (key === 'binder') matches = (byField.get('Binder factor') || []).concat(byField.get('Cutback binder / AMC') || []);
    if (key === 'binder2') matches = (byField.get('Second coat – Binder factor') || []).concat(byField.get('Second coat – Cutback binder / AMC') || []);

    const important = matches.find(n => n.level === 'WARNING') || matches.find(n => n.level === 'CHECK') || matches[0];
    const baseClass = el.className.includes('mini-note-dot') ? 'mini-note-dot' : (el.className.includes('cell-note') ? 'cell-note' : (el.className.includes('calc-note-row') ? 'calc-note-row' : 'field-note'));
    if (!important) {
      el.innerHTML = '';
      el.className = `${baseClass} is-empty`;
      return;
    }
    if (baseClass === 'mini-note-dot') {
      el.innerHTML = noteIcon(important.level);
      el.className = `${baseClass} ${safe(important.level.toLowerCase())}`;
      el.title = `${important.level}: see Design Notes / Warnings`;
      return;
    }
    const label = important.level === 'WARNING' ? 'Warning in notes' : 'Check notes';
    el.innerHTML = `<span class="note-chip">${noteIcon(important.level)} ${label}</span>`;
    el.className = `${baseClass} ${safe(important.level.toLowerCase())} compact`;
  });
}

function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function setVal(name, value) { const el = $(`[name="${name}"]`); if (el) el.value = value; }
function syncAld() { /* ALD is now entered once in the AGGREGATE block and pulled into the calculation table. */ }
function render(e) {
  if (['spec','sealType','treatment','aggregateSize'].includes(e?.target?.name)) {
    if (e?.target?.name === 'aggregateSize') {
      const agg2 = secondCoatAggregate(e.target.value);
      setVal('aggregateSize2', agg2);
      setVal('aldMirror2', defaultAldForAggregate(agg2, 3.8));
    }
    updateTreatmentAndBinderOptions();
  }

  const r = calculate();
  const doubleMode = Boolean(r.second);
  document.body.classList.toggle('double-mode', doubleMode);
  setText('primaryColHead', isDoubleFirst(r.v.sealType) ? 'Double 1st Coat' : 'Single');
  setText('aggOneTitle', isDoubleFirst(r.v.sealType) ? 'First coat aggregate' : 'Single seal aggregate');
  setText('secondColHead', r.second ? r.secondLabel : 'Second coat');
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
  setText('vfOut', r.samiMode ? 'N/A' : round(r.vf,3).toFixed(3));
  setText('vaOut', r.samiMode ? 'N/A' : round(r.shape.va,3));
  setText('vtOut', r.samiMode ? 'N/A' : round(r.vt,3));
  setText('designVfOut', round(r.designVf,3).toFixed(3));
  setText('aldCalcOut', round(r.ald,2));
  setText('baseBinderOut', round(r.baseBinder,2).toFixed(2));
  setText('bfOut', r.bf ?? '0.0');
  setText('modifiedBinderOut', round(r.modifiedBinder,2).toFixed(2));
  setText('astOut', r.ar.display || (r.ar.numeric === 0 ? '0' : round(r.ar.numeric,2)));
  setText('abaOut', round(r.aba,2));
  setText('apOut', round(r.ap,2));
  setText('embedOut', r.ae.display || round(r.ae.numeric,2));
  setText('finalBinderOut', round(r.finalBinder,2).toFixed(2));
  setText('aggSpreadBaseOut', cleanAggregateBaseDisplay(r.agg.displayBase || round(r.agg.base,0)));
  setText('aggSpreadOut', r.agg.displayM2M3 || round(r.agg.m2m3,0));
  const s2 = r.second;
  setText('designTrafficOut2', s2 ? round(s2.traffic.vld,0) : '');
  setText('vfOut2', s2 ? (s2.samiMode ? 'N/A' : round(s2.vf,3).toFixed(3)) : '');
  setText('vaOut2', s2 ? (s2.samiMode ? 'N/A' : round(s2.shape.va,3)) : '');
  setText('vtOut2', s2 ? (s2.samiMode ? 'N/A' : round(s2.vt,3)) : '');
  setText('otherAdjustmentOut2', s2 ? (s2.samiMode ? 'N/A' : round(s2.otherAdjustment,3)) : '');
  setText('designVfOut2', s2 ? round(s2.designVf,3).toFixed(3) : '');
  setText('aldCalcOut2', s2 ? round(s2.ald,2) : '');
  setText('baseBinderOut2', s2 ? round(s2.baseBinder,2).toFixed(2) : '');
  setText('bfOut2', s2 ? (s2.bf ?? '0.0') : '');
  setText('modifiedBinderOut2', s2 ? round(s2.modifiedBinder,2).toFixed(2) : '');
  setText('astOut2', s2 ? 'N/A' : '');
  setText('abaOut2', s2 ? round(s2.aba,2) : '');
  setText('apOut2', s2 ? 'N/A' : '');
  setText('embedOut2', s2 ? 'N/A' : '');
  setText('finalBinderOut2', s2 ? round(s2.finalBinder,2).toFixed(2) : '');
  setText('aggSpreadBaseOut2', s2 ? cleanAggregateBaseDisplay(s2.agg.displayBase || round(s2.agg.base,0)) : '');
  setText('aggSpreadOut2', s2 ? (s2.agg.displayM2M3 || round(s2.agg.m2m3,0)) : '');
  setText('rightTrafficOut', vld);
  setText('rightVfOut', r.samiMode ? 'N/A' : round(r.vf,3).toFixed(3));
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
  const secondText = r.second ? `

Second coat:
Type: Double 2nd Coat
Binder: ${r.second.v.binder}
Aggregate: ${r.second.v.aggregateSize}
ALD: ${round(r.second.ald,2)} mm
Flakiness Index: ${r.second.v.flIndex}%
Binder: ${round(r.second.finalBinder,2)} L/m²
Design aggregate spread base: ${cleanAggregateBaseDisplay(r.second.agg.displayBase || round(r.second.agg.base,0))} m²/m³
Aggregate application rate: ${r.second.agg.displayM2M3 || round(r.second.agg.m2m3,0)} m²/m³
Allowances: Ast N/A + Aba2 ${round(r.second.aba,2)} + Ap N/A + Ae N/A` : '';
  const text = `Spray seal design summary
Project: ${r.v.projectName}
Road: ${r.v.roadName}
Spec: ${r.v.spec}
Type: ${uiSealTypeLabel(r.v.sealType)}
Treatment: ${r.v.treatment}
Binder: ${r.v.binder}
Aggregate: ${r.v.aggregateSize}
Client AADT: ${r.v.initialAadt}
Design AADT: ${round(r.traffic.aadt,0)}
v/l/d: ${round(r.traffic.vld,0)}
Binder: ${round(r.finalBinder,2)} L/m²
Adjustments: ${r.samiMode ? 'Waterproofing/SAMI/WPA fixed VF 0.17; normal Va/Vt/Other not applied' : `Va ${round(r.shape.va,3)} + Vt ${round(r.vt,3)} + Other ${round(r.otherAdjustment,3)}`}
Allowances: Ast ${round(r.ar.numeric,2)} + Aba ${round(r.aba,2)} + Ap ${round(r.ap,2)} + Ae ${r.ae.display ?? round(r.ae.numeric,2)} L/m²
Design aggregate spread base: ${cleanAggregateBaseDisplay(r.agg.displayBase || round(r.agg.base,0))} m²/m³
Aggregate application rate: ${r.agg.displayM2M3 || round(r.agg.m2m3,0)} m²/m³${secondText}

Design notes:
${r.notes.map(n => `- ${n.level} | ${n.field}: ${n.message}${n.source ? ` (${n.source})` : ''}`).join('\n')}`;
  navigator.clipboard?.writeText(text);
  alert('Summary copied.');
}

async function init() {
  state.lookups = await fetch('./data/lookups.json').then(r => r.json());
  state.binderMatrix = await fetch('./data/binder-matrix.json').then(r => r.json());
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
