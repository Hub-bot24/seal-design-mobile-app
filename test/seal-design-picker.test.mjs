// Tests for the v63 seal design picker (design → type/treatment/binder/aggregate).
// Harness copied from ehv-nominal-traffic.test.mjs.
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
const run = (code) => vm.runInContext(code, ctx, { filename: 'test-call.js' });
const J = (v) => JSON.stringify(v);
function binders(spec, type, treatment, designId, coat = 1) {
  return JSON.parse(run(`JSON.stringify(bindersFor(binderRowsForSpec(${J(spec)}), ${J(type)}, ${J(treatment)}, designBinderFilter(sealDesignById(${J(designId)}), ${J(treatment)}, ${coat})))`));
}
function treatments(spec, type, designId, coat = 1) {
  return JSON.parse(run(`JSON.stringify(treatmentsWithBinders(binderRowsForSpec(${J(spec)}), ${J(type)}, designTreatments(sealDesignById(${J(designId)}), ${coat})))`));
}

test('every design has at least one treatment with binders, for both specs and both coats', () => {
  const ids = run('SEAL_DESIGNS.map(d => d.id)');
  assert.ok(ids.length >= 14);
  for (const spec of ['TN175', 'AGPT04K-26']) {
    for (const id of ids) {
      const d = run(`sealDesignById(${J(id)})`);
      const t1 = treatments(spec, d.type === 'Double' ? 'Double 1st Coat' : 'Single', id, 1);
      assert.ok(t1.length > 0, `${spec} ${id}: no first-coat treatment`);
      for (const t of t1) assert.ok(binders(spec, d.type === 'Double' ? 'Double 1st Coat' : 'Single', t, id, 1).length > 0, `${spec} ${id} ${t}: no binders`);
      if (d.type === 'Double') {
        const t2 = treatments(spec, 'Double 2nd Coat', id, 2);
        assert.ok(t2.length > 0, `${spec} ${id}: no second-coat treatment`);
        for (const t of t2) assert.ok(binders(spec, 'Double 2nd Coat', t, id, 2).length > 0, `${spec} ${id} ${t}: no second-coat binders`);
      }
    }
  }
});

test('wearing course S/S and D/D exclude cutbacks; initial seals offer them', () => {
  assert.ok(!binders('TN175', 'Single', 'Conventional Seal', 'SS').includes('AMC7'));
  assert.ok(!binders('TN175', 'Double 1st Coat', 'Conventional Seal', 'DD').includes('AMC7'));
  assert.ok(binders('TN175', 'Single', 'Conventional Seal', 'INIT_SS').includes('AMC6'));
  assert.deepEqual(binders('TN175', 'Double 1st Coat', 'Conventional Seal', 'INIT_DD'), ['AMC5', 'AMC6', 'AMC7']);
});

test('XSS: PMB both coats, BF 1.1 (Table 6.5 / Q6.5)', () => {
  assert.deepEqual(binders('AGPT04K-26', 'Double 1st Coat', 'XSS', 'XSS'), ['S20E', 'S15R', 'S15RF']);
  assert.ok(binders('TN175', 'Double 2nd Coat', 'XSS', 'XSS').includes('S15E'));
  for (const spec of ['TN175', 'AGPT04K-26']) {
    const r = calc(form({ spec, sealDesign: 'XSS', sealType: 'Double Seal', treatment: 'XSS', binder: 'S20E', treatment2: 'XSS', binder2: 'S15R', aggregateSize: '14mm and Greater', aldMirror: 8.4 }));
    assert.strictEqual(r.bf, 1.1, `${spec} XSS first coat BF`);
    assert.strictEqual(r.second.bf, 1.1, `${spec} XSS second coat BF`);
  }
});

test('S/S under asphalt is a conventional S/S (no fixed VF) with TN175 Q5.5.4 spread rates', () => {
  const r = calc(form({ spec: 'TN175', sealDesign: 'SS_UA', treatment: 'S/S Under Asphalt', binder: 'C170', aggregateSize: '7mm', aldMirror: 3.8 }));
  assert.strictEqual(r.samiMode, false);
  assert.strictEqual(r.bf, 1.0);
  assert.strictEqual(r.agg.displayM2M3, '220');
  const m = calc(form({ spec: 'AGPT04K-26', sealDesign: 'SS_UA', treatment: 'S/S Under Asphalt', binder: 'M500' }));
  assert.strictEqual(m.bf, 1.1);
});

test('old saved inputs map to a design', () => {
  assert.strictEqual(run(`inferSealDesign('Double Seal', 'HSS2-H').id`), 'HSS2');
  assert.strictEqual(run(`inferSealDesign('Single Seal', 'SAMI').id`), 'SAMI');
  assert.strictEqual(run(`inferSealDesign('Double Seal', 'Conventional Seal').id`), 'DD');
  assert.strictEqual(run(`inferSealDesign(undefined, undefined).id`), 'SS');
});

test('design notes: SAM minimum rate, initial 14 mm, second coat ALD rule', () => {
  const sam = calc(form({ spec: 'TN175', sealDesign: 'SAM_SS', initialAadt: 6000, treatment: 'SAM-S', binder: 'S10E', aggregateSize: '10mm', aldMirror: 5.7 }));
  assert.ok(sam.finalBinder < 1.5 && sam.notes.some(n => n.level === 'WARNING' && /minimum binder rate of 1.5/.test(n.message)));
  const init = calc(form({ spec: 'TN175', sealDesign: 'INIT_SS', binder: 'AMC7', aggregateSize: '14mm and Greater', aldMirror: 8.4 }));
  assert.ok(init.notes.some(n => n.level === 'WARNING' && /14 mm aggregate is not recommended/.test(n.message)));
  const dd = calc(form({ spec: 'TN175', sealDesign: 'DD', sealType: 'Double Seal', aggregateSize: '14mm and Greater', aldMirror: 8.4, aldMirror2: 4.9 }));
  assert.ok(dd.notes.some(n => n.field === 'Second coat ALD'));
  const ddOk = calc(form({ spec: 'TN175', sealDesign: 'DD', sealType: 'Double Seal', aggregateSize: '14mm and Greater', aldMirror: 8.4, aldMirror2: 3.8 }));
  assert.ok(!ddOk.notes.some(n => n.field === 'Second coat ALD'));
});

test('design rows do not double-count binder factors already in the workbook matrix', () => {
  const r = calc(form({ spec: 'AGPT04K-26', sealDesign: 'SS', treatment: 'Conventional Seal', binder: 'M500' }));
  assert.strictEqual(r.bf, 1.1);
});

test('notes display: titles, coat split, topics', () => {
  const d = JSON.parse(run(`JSON.stringify([
    describeNote({ level: 'WARNING', field: 'HUESKER BOND COAT OUT OF RANGE', message: 'x' }, 0),
    describeNote({ level: 'APPLIED', field: 'Second coat – TN175 binder factor', message: 'x' }, 1),
    describeNote({ level: 'CHECK', field: 'SAM minimum binder rate', message: 'x' }, 2),
    describeNote({ level: 'CHECK', field: 'TN175 Vt – median', message: 'x' }, 3),
    describeNote({ level: 'WARNING', field: 'GLASGRID RESIDUAL OUT OF RANGE', message: 'x' }, 4)
  ])`));
  assert.strictEqual(d[0].title, 'HUESKER bond coat out of range');
  assert.strictEqual(d[0].topic.key, 'reinforcement');
  assert.strictEqual(d[1].coat, 2);
  assert.strictEqual(d[1].title, 'TN175 binder factor');
  assert.strictEqual(d[1].topic.key, 'binder');
  assert.strictEqual(d[2].topic.key, 'binder');
  assert.strictEqual(d[3].topic.key, 'traffic');
  assert.strictEqual(d[4].title, 'GlasGrid residual out of range');
});

test('every note produced across all designs gets a topic other than Other', () => {
  const ids = JSON.parse(run('JSON.stringify(SEAL_DESIGNS.map(d => d.id))'));
  const misses = new Set();
  for (const spec of ['TN175', 'AGPT04K-26']) for (const id of ids) {
    const d = JSON.parse(run(`JSON.stringify(sealDesignById(${J(id)}))`));
    const t1 = treatments(spec, d.type === 'Double' ? 'Double 1st Coat' : 'Single', id, 1)[0];
    const b1 = binders(spec, d.type === 'Double' ? 'Double 1st Coat' : 'Single', t1, id, 1)[0];
    const r = calc(form({ spec, sealDesign: id, sealType: d.type === 'Double' ? 'Double Seal' : 'Single Seal', treatment: t1, binder: b1, treatment2: t1, binder2: b1, initialAadt: 9000, shvPct: 30 }));
    for (const n of r.notes) {
      const dn = JSON.parse(run(`JSON.stringify(describeNote(${J(n)}, 0))`));
      if (dn.topic.key === 'other') misses.add(n.field);
    }
  }
  assert.deepEqual([...misses], [], `notes without a topic: ${[...misses].join(', ')}`);
});

let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`PASS - ${t.name}`); passed++; }
  catch (err) { console.log(`FAIL - ${t.name}\n       ${err.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed (of ${tests.length})`);
process.exit(failed ? 1 : 0);
