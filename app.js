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
  const rows = binderRowsForSpec(spec);
  const lookupType = uiSealTypeToLookupType(sealType);
  const matches = rows.filter(r => norm(r.BF_Type) === norm(lookupType) && norm(r.BF_Treatment) === norm(treatment) && norm(r.BF_Binder) === norm(binder));
  const result = matches.reduce((sum, r) => sum + asNum(r.BF_Result, 0), 0);
  return result || null;
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

  if (spec === 'TN175' && !isSecondCoat) {
    notes.push(note('CHECK', 'SPEC', 'TN175 mode selected. Use TN175/TMR-specific rules and project requirements for this design.', 'TN175'));
  }

  if (cutback) {
    const zeroAllowance = aba === 0 && ap === 0 ? ' Aba and Ap are currently 0, so confirm no absorption allowance is required.' : '';
    notes.push(note('CHECK', coatPrefix + 'Cutback binder / AMC', `${r.v.binder} selected. Consider whether +0.1 L/m² is required for binder absorption/porous pavement conditions. For initial seals on granular/unbound or porous pavement, pavement absorption commonly sits in the +0.1 to +0.2 L/m² check range. Do not add it blindly; enter the allowance in Ap or Aba only when the pavement/aggregate condition justifies it.${zeroAllowance} Confirm cutter oil proportion suits the surface and conditions.`, 'AGPT04K-26 Table 4.6 Note 2 / Section 6.2.4'));
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
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture input is missing. Ast lookup has been treated as 0.', 'Lookups tab / AGPT04K-26 Table 6.3'));
    } else if (textureInput < 0) {
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture input cannot be negative.', 'Designer check'));
    }
    const arNote = norm(r.ar.value);
    if (arNote === 'NOTE 1') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 1: embedment considerations are dominant. Review embedment allowance and treatment suitability.', 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 2') {
      notes.push(note('WARNING', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 2: specialised treatments are necessary. Do not treat this as a normal Ast allowance.', 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 3') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 3: this treatment might not be advisable depending on aggregate shape/interlock. Consider alternative treatment, surface enrichment, or smaller aggregate seal.', 'Lookups tab surface texture table'));
    } else if (arNote === 'NOTE 4') {
      notes.push(note('CHECK', 'Surface texture / sand patch', 'Surface texture lookup returned NOTE 4: for aggregate sizes greater than 14 mm, adopt allowances applicable to 14 mm aggregate.', 'Lookups tab surface texture table'));
    } else if (r.ar.note && r.ar.value === '') {
      notes.push(note('APPLIED', 'Surface texture / sand patch', r.ar.note, 'Calculation sheet surface texture rule'));
    } else if (ast > 0.5) {
      notes.push(note('WARNING', 'Surface texture / sand patch', `Surface texture allowance Ast = ${ast} L/m² applied from the lookup. This is high; review aggregate size and/or treatment selection.`, 'Lookups tab surface texture table / AGPT04K-26 Table 6.3'));
    } else if (ast !== 0 || Number.isFinite(textureInput)) {
      notes.push(note('APPLIED', 'Surface texture / sand patch', `Surface texture allowance Ast = ${ast} L/m² applied from surface '${r.v.surfaceType}', aggregate '${r.v.aggregateSize}', and sand patch ${r.v.surfaceTexture}.`, 'Lookups tab surface texture table'));
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

  if (!r.bf) {
    notes.push(note('WARNING', coatPrefix + 'Binder factor', 'Binder factor not found for this SPEC + TYPE + TREATMENT + BINDER. Do not use the binder rate until mapped/validated.', 'Extracted Lookups tab / AGPT04K-26 Tables 6.4 and 6.5'));
  }
  if (r.finalBinder <= 0) {
    notes.push(note('WARNING', coatPrefix + 'Design binder rate', 'Calculated binder rate is zero or negative. Inputs are incomplete, unsupported, or the lookup is missing.', 'Calculation check'));
  }
  return notes;
}

function surfaceTextureAllowance(surfaceType, aggregateSize, sandPatch, sealType, treatment) {
  const st = norm(sealType);
  const tr = norm(treatment);
  const surf = norm(surfaceType);
  const sp = asNum(sandPatch, NaN);

  // Match the spreadsheet guard clauses before using LookupsTbl.
  if (tr === 'HATELIT' || tr === 'HUESKER CHIPSEAL GRID A10' || tr === 'HUESKER CHIPSEAL GRID A15' || st === 'DOUBLE 2ND COAT' || surf === 'N/A') {
    return { value: 'N/A', numeric: 0, display: 'N/A', note: 'Surface texture allowance is not applicable for an immediate double/double second application.' };
  }
  if (['GRANULAR','FOAMED BITUMEN','PRIMED','PRIMER SEAL','BRIDGE DECK'].includes(surf)) {
    return { value: 0, numeric: 0, display: '0', note: 'Surface type is treated as 0 surface texture allowance by the calculation-sheet rule.' };
  }
  if (!Number.isFinite(sp)) {
    return { value: null, numeric: 0, display: '0', note: 'No sand patch/texture value entered.' };
  }

  const row = tableRows('LookupsTbl').find(r =>
    norm(r.KeyA || r['A (Agg Size 1)']) === norm(surfaceType) &&
    norm(r.KeyB || r['B (Agg Size 2)']) === norm(aggregateSize) &&
    asNum(r['C (Min Sand Patch)']) <= sp &&
    asNum(r['D (Max Sand Patch)']) >= sp
  );
  if (!row) return { value: null, numeric: 0, display: 'NO MATCH', note: `No surface texture lookup match for surface ${surfaceType}, aggregate ${aggregateSize}, sand patch ${sandPatch}.` };

  const raw = row['E (Value)'];
  const rawNorm = norm(raw);
  const numeric = Number.isFinite(Number(raw)) ? Number(raw) : 0;
  return { value: raw, numeric, display: rawNorm.startsWith('NOTE') ? rawNorm : String(raw), note: '' };
}

function embedmentAllowance(vld, ballpin) {
  const bpRaw = String(ballpin ?? '').trim();
  const bp = asNum(ballpin, NaN);
  const traffic = asNum(vld, 0);
  if (norm(bpRaw) === 'N/A') return { value: 'N/A', numeric: 0, display: 'N/A', note: '' };
  if (bpRaw === '') return { value: 0, numeric: 0, display: '0', note: '' };
  if (bpRaw === '>3' || (Number.isFinite(bp) && bp > 3)) return { value: 'NOTE', numeric: 0, display: 'NOTE', note: 'Ball penetration is greater than 3 mm. Spreadsheet returns NOTE; designer review is required rather than a simple numeric embedment allowance.' };
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
function aggregateSpreadRate(spec, sealType, treatment, binder, ald) {
  const st = norm(uiSealTypeToLookupType(sealType)), tr = norm(treatment), b = norm(binder);
  let base = 950;
  if (tr === 'SAMI' || tr.includes('WATERPROOFING')) base = 1000;
  else if (tr.includes('UNMODIFIED EMULSION') || tr.includes('HI-FLOAT') || tr.includes('PRIMER')) base = 800;
  else if (tr.includes('CONVENTIONAL') && ['AMC5'].includes(b)) base = 800;
  else if (st.includes('DOUBLE 1ST')) base = b.startsWith('AMC') ? 850 : 950;
  else if (st.includes('DOUBLE 2ND')) base = 900;
  const m2m3 = base / Math.max(asNum(ald, 1), 0.1);
  return { base, m2m3 };
}
function calculateCoat(v) {
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
  const ar = surfaceTextureAllowance(v.surfaceType, v.aggregateSize, v.surfaceTexture, v.sealType, v.treatment);
  const otherAdjustment = allowanceNum(v.otherAdjustment);
  const ald = asNum(v.aldMirror, 0);
  const designVf = vf + shape.va + vt + otherAdjustment;
  const baseBinder = designVf * ald;
  const modifiedBinder = baseBinder * (bf ?? 0);
  const aba = allowanceNum(v.aba);
  const ap = allowanceNum(v.ap);
  const ae = embedmentAllowance(traffic.vld, v.ballpin);
  const finalBinder = modifiedBinder + ar.numeric + aba + ap + ae.numeric;
  const agg = aggregateSpreadRate(v.spec, v.sealType, v.treatment, v.binder, ald);
  return { v, traffic, shvPct, lhvPct, lvPct, ehvPct, vf, vt, shape, bf, ar, aba, ap, ae, otherAdjustment, ald, designVf, baseBinder, modifiedBinder, finalBinder, agg, notes: [] };
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
  setText('vfOut', round(r.vf,3).toFixed(3));
  setText('vaOut', round(r.shape.va,3));
  setText('vtOut', round(r.vt,3));
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
  setText('aggSpreadBaseOut', round(r.agg.base,0));
  setText('aggSpreadOut', round(r.agg.m2m3,0));
  const s2 = r.second;
  setText('designTrafficOut2', s2 ? round(s2.traffic.vld,0) : '');
  setText('vfOut2', s2 ? round(s2.vf,3).toFixed(3) : '');
  setText('vaOut2', s2 ? round(s2.shape.va,3) : '');
  setText('vtOut2', s2 ? round(s2.vt,3) : '');
  setText('otherAdjustmentOut2', s2 ? round(s2.otherAdjustment,3) : '');
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
  setText('aggSpreadBaseOut2', s2 ? round(s2.agg.base,0) : '');
  setText('aggSpreadOut2', s2 ? round(s2.agg.m2m3,0) : '');
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
  const secondText = r.second ? `

Second coat:
Type: Double 2nd Coat
Binder: ${r.second.v.binder}
Aggregate: ${r.second.v.aggregateSize}
ALD: ${round(r.second.ald,2)} mm
Flakiness Index: ${r.second.v.flIndex}%
Binder: ${round(r.second.finalBinder,2)} L/m²
Design aggregate spread base: ${round(r.second.agg.base,0)} m²/m³
Aggregate application rate: ${round(r.second.agg.m2m3,0)} m²/m³
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
Adjustments: Va ${round(r.shape.va,3)} + Vt ${round(r.vt,3)} + Other ${round(r.otherAdjustment,3)}
Allowances: Ast ${round(r.ar.numeric,2)} + Aba ${round(r.aba,2)} + Ap ${round(r.ap,2)} + Ae ${r.ae.display ?? round(r.ae.numeric,2)} L/m²
Design aggregate spread base: ${round(r.agg.base,0)} m²/m³
Aggregate application rate: ${round(r.agg.m2m3,0)} m²/m³${secondText}

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
