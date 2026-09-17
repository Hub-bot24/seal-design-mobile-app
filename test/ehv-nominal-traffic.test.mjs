// Regression tests for the EHV > 65% nominal design traffic fix.
//
// Why this exists: AGPT04K-26 / TN175 already correctly stop applying the normal Vt
// heavy-vehicle correction once EHV exceeds 65% (Vt = 0). But the app was still
// feeding the ordinary lane/common-path design traffic into the Basic Voids Factor
// (Vf) lookup for that same EHV > 65% design, instead of converting it to the
// required nominal design traffic:
//
//   nominalDesignTraffic = normalDesignTraffic * (LV% + 10*(SHV% + 3*LHV%)) / 100
//
// These tests exercise the REAL app.js (not a reimplementation) through a minimal
// VM sandbox: they call the actual `calculate()` / `calculateCoat()` /
// `getEffectiveDesignTraffic()` functions from app.js via Node's vm module, driving
// them through a fake <form> shim instead of a browser DOM. This proves the
// production code itself behaves correctly, not a copy of it.
//
// Run with:  node test/ehv-nominal-traffic.test.mjs
// Exits 0 on success, 1 on any failed assertion.

import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS_PATH = path.join(__dirname, '..', 'app.js');

// app.js ends with two top-level statements that assume a real browser:
//   window.addEventListener('beforeinstallprompt', ...)
//   init().catch(...)
// Everything before that is pure function/const declarations. We cut the source
// there so it can be evaluated in Node without a DOM. This is a test-only, in-memory
// operation - it never touches the app.js file on disk.
const CUT_MARKER = "\nwindow.addEventListener('beforeinstallprompt'";
const rawSource = fs.readFileSync(APP_JS_PATH, 'utf8');
const cutIdx = rawSource.indexOf(CUT_MARKER);
assert.notEqual(cutIdx, -1, 'app.js: expected end-of-declarations marker not found; refusing to guess where to cut the source');
const declarationsSource = rawSource.slice(0, cutIdx);

// --- Minimal sandbox: just enough for calculate()/calculateCoat() to run with no DOM. ---
let currentFormValues = {};
class FakeFormData {
  constructor(formEl) { this._entries = Object.entries((formEl && formEl.__values) || {}); }
  entries() { return this._entries[Symbol.iterator](); }
}
const sandbox = {
  console,
  window: {},
  navigator: {},
  document: {
    querySelector(sel) { return sel === '#designForm' ? { __values: currentFormValues } : null; },
    getElementById() { return null; },
    body: { classList: { toggle() {} } },
  },
  FormData: FakeFormData,
};
const ctx = vm.createContext(sandbox);
vm.runInContext(declarationsSource, ctx, { filename: 'app.js' });

// calculate()/calculateCoat() read state.lookups / state.binderMatrix. This mirrors
// exactly what the real init() does when the JSON fetch fails (loadJsonWithFallback):
// it falls back to the embedded EMBEDDED_LOOKUPS / EMBEDDED_BINDER_MATRIX constants
// that ship inside app.js itself, so this is real production data, not test fixtures.
vm.runInContext('state.lookups = EMBEDDED_LOOKUPS; state.binderMatrix = EMBEDDED_BINDER_MATRIX;', ctx);

function calc(formValues) {
  currentFormValues = formValues;
  return vm.runInContext('calculate()', ctx, { filename: 'test-call.js' });
}

function getEffectiveDesignTraffic(...args) {
  return vm.runInContext(
    `getEffectiveDesignTraffic(${args.map(a => JSON.stringify(a)).join(',')})`,
    ctx,
    { filename: 'test-call.js' }
  );
}

function round(n, dp) { return Number(n.toFixed(dp)); }

const BASE_FORM = {
  projectName: 'Test', roadName: 'Test Rd', designer: 'Test',
  baseYear: 2026, initialAadt: 700, growthRate: 0, laneSplit: 50,
  shvPct: 0, lhvPct: 0,
  spec: 'AGPT04K-26', sealType: 'Single Seal', treatment: 'Conventional Seal',
  reinforcementSystem: 'None', hueskerBondMode: 'Auto from texture',
  aggregateSize: '10mm', aldMirror: 5.7, flIndex: 20, binder: 'C170',
  aggregateSize2: '7mm', aldMirror2: 3.8, flIndex2: 20, binder2: 'C170',
  surfaceType: '10mm', surfaceTexture: 1.9, ballpin: 1,
  gradient: 'Flat or Downhill', braking: 'No', roadWidth: 3,
  designArea: 'Traffic lane / wheel path',
  otherAdjustment: 0, aba: 0, ap: 0, aba2: 0, samiAdoptedBf: '',
};
function form(overrides) { return { ...BASE_FORM, ...overrides }; }

function approx(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ~${expected} (+/-${tolerance}), got ${actual}`);
}

// --- Test registry ---
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('TEST 1 - normal low EHV: normalDesignTraffic used, existing Vf/Vt/binder logic unchanged', () => {
  const r = calc(form({ initialAadt: 700, laneSplit: 50, shvPct: 5, lhvPct: 5 }));
  assert.ok(r.ehvPct <= 65, 'sanity: this case must be <=65% EHV');
  assert.strictEqual(r.effectiveDesignTraffic, r.normalDesignTraffic, 'effectiveDesignTraffic must equal normalDesignTraffic when EHV<=65%');
  assert.strictEqual(r.effectiveDesignTraffic, r.traffic.vld, 'effectiveDesignTraffic must equal the existing traffic.vld when EHV<=65%');
  approx(r.vf, 0.181, 1e-9, 'Vf must match the existing vehicleFactor formula on normal traffic');
  assert.strictEqual(r.vt, -0.01, 'Vt must still come from the normal (unmodified) traffic-effects branch');
});

test('TEST 2 - EHV exactly 65%: nominal conversion NOT triggered, normal logic stays active', () => {
  const r = calc(form({ initialAadt: 700, laneSplit: 50, shvPct: 65, lhvPct: 0 }));
  assert.strictEqual(r.ehvPct, 65, 'sanity: EHV must be exactly 65%');
  assert.strictEqual(r.effectiveDesignTraffic, r.normalDesignTraffic, 'effectiveDesignTraffic must equal normalDesignTraffic at exactly EHV=65%');
  assert.notStrictEqual(r.vt, 0, 'Vt must still use the normal (non-zero) traffic-effects logic at exactly EHV=65%');
});

test('TEST 3 - EHV slightly above 65% (65.01%): nominal traffic triggered, Vt=0, Vf uses nominal traffic', () => {
  const r = calc(form({ initialAadt: 700, laneSplit: 50, shvPct: 65.01, lhvPct: 0 }));
  approx(r.ehvPct, 65.01, 1e-9, 'sanity: EHV must be 65.01%');
  assert.strictEqual(r.vt, 0, 'Vt must be 0 once EHV > 65%');
  assert.notStrictEqual(r.effectiveDesignTraffic, r.normalDesignTraffic, 'effectiveDesignTraffic must diverge from normalDesignTraffic once EHV > 65%');
  assert.strictEqual(r.effectiveDesignTraffic, r.nominalDesignTraffic, 'effectiveDesignTraffic must equal nominalDesignTraffic once EHV > 65%');
  const v = r.effectiveDesignTraffic;
  const expectedVf = round(v <= 500 ? 0.388 * Math.pow(v, -0.1304) : 0.3687 * Math.pow(v, -0.1226), 3);
  approx(r.vf, expectedVf, 1e-9, 'Vf must be computed from the nominal (effective) traffic using the unmodified Vf formula');
});

test('TEST 4 - Hebel example: normal ~106.47, nominal ~1232, Vt=0, Vf from nominal traffic', () => {
  // Exact precision numbers as supplied: normalDesignTraffic=106.47, LV=49.08, SHV=26.92, LHV=30.47 v/l/d
  const normal = 49.08 + 26.92 + 30.47; // = 106.47
  const lvPct = 49.08 / normal * 100, shvPct = 26.92 / normal * 100, lhvPct = 30.47 / normal * 100;
  const { nominalDesignTraffic, effectiveDesignTraffic } = getEffectiveDesignTraffic(normal, shvPct + 3 * lhvPct, lvPct, shvPct, lhvPct);
  approx(normal, 106.47, 0.01, 'normal design traffic');
  approx(nominalDesignTraffic, 1232, 1, 'nominal design traffic');
  approx(effectiveDesignTraffic, 1232, 1, 'effective design traffic must equal nominal traffic (EHV>65%)');

  // Full pipeline via the real AADT path (AADT=212, two distinct lanes => laneSplit=50,
  // growthRate=0 so the design-year AADT is exactly 212 and reproducible on any date).
  const r = calc(form({ initialAadt: 212, growthRate: 0, laneSplit: 50, shvPct: 25.28, lhvPct: 28.62 }));
  approx(r.traffic.aadt, 212, 0.5, 'actual AADT must remain ~212 (unchanged by this fix)');
  approx(r.normalDesignTraffic, 106, 1, 'normal lane traffic must remain ~106 (unchanged by this fix)');
  assert.ok(r.ehvPct > 65, 'EHV must exceed 65% for the Hebel example');
  assert.strictEqual(r.vt, 0, 'Vt must be 0 for the Hebel example');
  assert.ok(r.effectiveDesignTraffic > 1000, `effective design traffic must be the large nominal value (~1232), got ${r.effectiveDesignTraffic}`);
  assert.notStrictEqual(r.effectiveDesignTraffic, r.normalDesignTraffic, 'effective traffic must not remain ~106');
});

test('TEST 5 - common traffic path is NOT auto-halved before the >65% conversion', () => {
  // laneSplit=100 represents a common-path design where the full compounded traffic
  // applies (whatever the existing lane/path logic already produced) - the fix must
  // start from that value as-is, not silently divide it by two again.
  const r = calc(form({ initialAadt: 150, growthRate: 0, laneSplit: 100, shvPct: 25.28, lhvPct: 28.62 }));
  assert.strictEqual(r.normalDesignTraffic, 150, 'normalDesignTraffic must be the full common-path traffic, not halved');
  assert.ok(r.ehvPct > 65);
  const expectedNominal = 150 * (r.lvPct + 10 * (r.shvPct + 3 * r.lhvPct)) / 100;
  approx(r.effectiveDesignTraffic, expectedNominal, 1e-6, 'nominal traffic must be derived from the un-halved common-path traffic');
});

test('TEST 6 - changing AADT updates the nominal traffic proportionally', () => {
  const r1 = calc(form({ initialAadt: 100, growthRate: 0, laneSplit: 100, shvPct: 40, lhvPct: 20 }));
  const r2 = calc(form({ initialAadt: 200, growthRate: 0, laneSplit: 100, shvPct: 40, lhvPct: 20 }));
  assert.ok(r1.ehvPct > 65 && r2.ehvPct > 65);
  approx(r2.effectiveDesignTraffic, r1.effectiveDesignTraffic * 2, 1e-6, 'doubling AADT must double the nominal/effective traffic');
});

test('TEST 7 - changing SHV/LHV updates EHV and nominal traffic', () => {
  const r1 = calc(form({ initialAadt: 400, growthRate: 0, laneSplit: 100, shvPct: 10, lhvPct: 20 }));
  const r2 = calc(form({ initialAadt: 400, growthRate: 0, laneSplit: 100, shvPct: 30, lhvPct: 25 }));
  assert.notStrictEqual(r1.ehvPct, r2.ehvPct, 'EHV must change when SHV/LHV change');
  assert.notStrictEqual(r1.effectiveDesignTraffic, r2.effectiveDesignTraffic, 'effective traffic must change when SHV/LHV change');
});

test('TEST 8 - EHV>65% then back to EHV<=65% returns cleanly to normal logic', () => {
  const high = calc(form({ initialAadt: 400, growthRate: 0, laneSplit: 100, shvPct: 40, lhvPct: 20 }));
  assert.ok(high.ehvPct > 65 && high.vt === 0 && high.effectiveDesignTraffic !== high.normalDesignTraffic);
  const back = calc(form({ initialAadt: 400, growthRate: 0, laneSplit: 100, shvPct: 5, lhvPct: 5 }));
  assert.ok(back.ehvPct <= 65, 'sanity: second case must be back under 65%');
  assert.strictEqual(back.effectiveDesignTraffic, back.normalDesignTraffic, 'effective traffic must revert to normalDesignTraffic');
  assert.notStrictEqual(back.vt, 0, 'Vt must revert to normal (non-zero) traffic-effects logic');
});

test('TEST 9 - single seal: conversion happens once, matches the direct formula exactly', () => {
  const r = calc(form({ initialAadt: 300, growthRate: 0, laneSplit: 100, sealType: 'Single Seal', shvPct: 40, lhvPct: 20 }));
  assert.strictEqual(r.second, undefined, 'a single seal must not produce a second coat result');
  const expectedNominal = 300 * (r.lvPct + 10 * (r.shvPct + 3 * r.lhvPct)) / 100;
  approx(r.effectiveDesignTraffic, expectedNominal, 1e-6, 'effective traffic must equal the nominal formula applied exactly once to normalDesignTraffic');
});

test('TEST 10 - double seal: first and second coat share the same effective traffic, not converted twice', () => {
  const r = calc(form({ initialAadt: 300, growthRate: 0, laneSplit: 100, sealType: 'Double Seal', shvPct: 40, lhvPct: 20 }));
  assert.ok(r.second, 'double seal must produce a second coat result');
  assert.ok(r.ehvPct > 65);
  assert.strictEqual(r.effectiveDesignTraffic, r.second.effectiveDesignTraffic, 'first and second coat must use the identical effective traffic');
  assert.strictEqual(r.normalDesignTraffic, r.second.normalDesignTraffic, 'first and second coat must share the same normalDesignTraffic');
  const expectedNominal = 300 * (r.lvPct + 10 * (r.shvPct + 3 * r.lhvPct)) / 100;
  approx(r.effectiveDesignTraffic, expectedNominal, 1e-6, 'effective traffic must equal one application of the nominal formula (not squared/doubled)');
  assert.strictEqual(r.vt, 0, 'first coat Vt must be 0');
  assert.strictEqual(r.second.vt, 0, 'second coat Vt must be 0');
});

test('TEST 11 - repeated recalculation never compounds the conversion', () => {
  const vector = form({ initialAadt: 300, growthRate: 0, laneSplit: 100, shvPct: 40, lhvPct: 20 });
  const r1 = calc(vector);
  const r2 = calc(vector);
  const r3 = calc(vector);
  assert.strictEqual(r1.effectiveDesignTraffic, r2.effectiveDesignTraffic, 'recalculating with the same inputs must not change the effective traffic');
  assert.strictEqual(r2.effectiveDesignTraffic, r3.effectiveDesignTraffic, 'recalculating a third time must still not change the effective traffic');
  // Explicitly rule out feeding the already-converted value back in as a new "normal" traffic.
  const wouldDoubleConvert = getEffectiveDesignTraffic(r1.effectiveDesignTraffic, r1.ehvPct, r1.lvPct, r1.shvPct, r1.lhvPct).effectiveDesignTraffic;
  assert.notStrictEqual(wouldDoubleConvert, r1.effectiveDesignTraffic, 'sanity check: re-feeding the converted value WOULD change it (proves double-conversion is a real risk the app must avoid)');
  assert.strictEqual(r1.effectiveDesignTraffic, r1.normalDesignTraffic * (r1.lvPct + 10 * (r1.shvPct + 3 * r1.lhvPct)) / 100, 'the app must always derive effectiveDesignTraffic from normalDesignTraffic, never from a previously converted value');
});

test('boundary - 64.99% uses normal logic, 65.00% uses normal logic, 65.01% uses nominal logic', () => {
  const below = getEffectiveDesignTraffic(500, 64.99, 40, 64.99, 0);
  const at = getEffectiveDesignTraffic(500, 65.00, 40, 65.00, 0);
  const above = getEffectiveDesignTraffic(500, 65.01, 34.99, 65.01, 0);
  assert.strictEqual(below.effectiveDesignTraffic, 500, '64.99% must use normal traffic');
  assert.strictEqual(at.effectiveDesignTraffic, 500, '65.00% must use normal traffic (trigger is > 65, not >= 65)');
  assert.notStrictEqual(above.effectiveDesignTraffic, 500, '65.01% must use nominal traffic');
});

test('SAMI/waterproofing treatments remain fixed regardless of EHV (unrelated logic untouched)', () => {
  const r = calc(form({ initialAadt: 300, growthRate: 0, laneSplit: 100, treatment: 'SAMI', shvPct: 40, lhvPct: 20 }));
  assert.ok(r.ehvPct > 65);
  assert.strictEqual(r.vf, 0, 'SAMI must keep vf fixed at 0 (designVf fixed at 0.17) regardless of EHV/traffic');
  assert.strictEqual(r.vt, 0, 'SAMI must keep vt fixed at 0 regardless of EHV/traffic');
  approx(r.designVf, 0.17, 1e-9, 'SAMI designVf must remain fixed at 0.17');
});

test('embedment allowance is unaffected: it still uses normalDesignTraffic, not the nominal traffic', () => {
  const r = calc(form({ initialAadt: 3000, growthRate: 0, laneSplit: 100, shvPct: 40, lhvPct: 20, ballpin: 1 }));
  assert.ok(r.ehvPct > 65);
  assert.ok(r.effectiveDesignTraffic > r.normalDesignTraffic * 5, 'sanity: effective traffic must be much larger than normal traffic here');
  // ballpin=1, normalDesignTraffic=3000 falls in the >2600 & <=9500 band => Ae = -0.2
  // (see embedmentAllowance()). If embedment had been switched to the nominal traffic
  // (tens of thousands of v/l/d), it would fall into a different / out-of-range band.
  approx(r.ae.numeric, -0.2, 1e-9, 'embedment allowance must be computed from normalDesignTraffic, unaffected by the >65% EHV traffic conversion');
});

// --- Run ---
let passed = 0, failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`PASS - ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL - ${t.name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed (of ${tests.length})`);
process.exit(failed ? 1 : 0);
