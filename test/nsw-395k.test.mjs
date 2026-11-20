// Tests for the TfNSW Form 395K spec option (v68).
// Reproduces the Paddy's Flat Rd D/D design (Rev 0, Form 395K) through the real
// app.js calculate(), then checks individual 395K table rules.
// Run with:  node test/nsw-395k.test.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cut = src.indexOf("\nwindow.addEventListener('beforeinstallprompt'");
assert.notEqual(cut, -1);
let current = {};
class FakeFormData { constructor(f) { this._e = Object.entries((f && f.__values) || {}); } entries() { return this._e[Symbol.iterator](); } }
const ctx = vm.createContext({
  console, window: {}, navigator: {}, FormData: FakeFormData,
  document: { querySelector: (s) => s === '#designForm' ? { __values: current } : null, getElementById: () => null, body: { classList: { toggle() {} } } },
});
vm.runInContext(src.slice(0, cut), ctx, { filename: 'app.js' });
vm.runInContext('state.lookups = EMBEDDED_LOOKUPS; state.binderMatrix = EMBEDDED_BINDER_MATRIX;', ctx);
const calc = (f) => { current = f; return vm.runInContext('calculate()', ctx); };
const run = (c) => vm.runInContext(c, ctx);
const year = new Date().getFullYear();

// Paddy's Flat Rd: D/D 14/10 C170, 85 v/l/d, 30% EHV, unsealed road base.
const PADDYS = {
  baseYear: year, initialAadt: 170, growthRate: 0, laneSplit: 50, shvPct: 30, lhvPct: 0,
  spec: '395K', sealDesign: 'DD', sealType: 'Double Seal', treatment: 'Conventional Seal', treatment2: 'Conventional Seal',
  reinforcementSystem: 'None', hueskerBondMode: 'Auto from texture',
  aggregateSize: '14mm and Greater', aldMirror: 8.3, flIndex: 20, binder: 'C170',
  aggregateSize2: '10mm', aldMirror2: 6.6, flIndex2: 20, binder2: 'C170',
  surfaceType: 'N/A', surfaceTexture: '', ballpin: '',
  gradient: 'Flat or Downhill', braking: 'No', roadWidth: 7, designArea: 'Traffic lane / wheel path',
  otherAdjustment: 0, aba: 0.05, ap: 0.05, aba2: 0.1, samiAdoptedBf: '',
  nsw395Surface: 'Unsealed granular base (designer AT)', nsw395SealOrReseal: 'Seal', nsw395UnsealedAt: 0.1,
  nsw395Shape: 'Crushed – Angular', nsw395Shape2: 'Crushed – Angular', nsw395Abs: '', nsw395Abs2: '',
  nsw395Limit: 'Lower', nsw395Limit2: 'Upper', nsw395VfRead: 0.21,
};
const tests = [];
const test = (n, f) => tests.push([n, f]);

test("Paddy's Flat Rev 0 (ALD2 6.6) reproduces the form values", () => {
  const r = calc(PADDYS);
  assert.equal(r.vt, -0.02); assert.equal(r.nsw.vm, 0.75); assert.equal(r.designVf, 0.14);
  assert.equal(r.baseBinder, 1.16); assert.equal(r.ar.numeric, 0.1); assert.equal(r.ae.numeric, 0);
  assert.equal(r.finalBinder, 1.36);            // Rev 0 printed 1.35 (rounded to 0.05)
  assert.equal(r.agg.F, 102); assert.equal(r.agg.m2m3, 112);
  assert.equal(r.second.designVf, 0.19); assert.equal(r.second.baseBinder, 1.25);
  assert.equal(r.second.finalBinder, 1.35);
  assert.equal(r.second.agg.F, 128); assert.equal(r.second.agg.m2m3, 128);
});
test('ALD2 6.5 (Lot 2441): BD2 1.34, spread 130', () => {
  const r = calc({ ...PADDYS, aldMirror2: 6.5 });
  assert.equal(r.second.baseBinder, 1.24); assert.equal(r.second.finalBinder, 1.34); assert.equal(r.second.agg.m2m3, 130);
});
test('Auto Table 1A limit follows the guide note (ALD >= 0.6 x nominal -> lower)', () => {
  const r = calc({ ...PADDYS, aldMirror2: 6.5, nsw395Limit: 'Auto', nsw395Limit2: 'Auto' });
  assert.equal(r.agg.limit, 900); assert.equal(r.agg.m2m3, 119);   // 8.3/14 = 0.59 -> upper
  assert.equal(r.second.agg.limit, 800); assert.equal(r.second.agg.m2m3, 123); // 6.5/10 = 0.65 -> lower
});
test('traffic > 750 v/l/d uses 800/ALD (Table 1A note 2) and Vm from Table 5', () => {
  const r = calc({ ...PADDYS, initialAadt: 2000, nsw395Limit: 'Auto' });
  assert.equal(r.agg.limit, 800); assert.equal(r.nsw.vm, 0.80);
});
test('blank Vf reading uses the Figure 1A mid-line (not flat below 100)', () => {
  const r = calc({ ...PADDYS, nsw395VfRead: '' });
  assert.equal(r.vf, 0.217);
  assert.equal(run('nsw395BasicVf(10)'), 0.287);
});
test('flakiness index is ignored in 395K; Table 4 shape drives Va', () => {
  const a = calc({ ...PADDYS, flIndex: 5 }), b = calc({ ...PADDYS, flIndex: 40 });
  assert.equal(a.finalBinder, b.finalBinder);
  const c = calc({ ...PADDYS, nsw395Shape: 'Not Crushed – Rounded' });
  assert.equal(c.shape.va, 0.01);
});
test('Table 9 ABA from absorption %, Table 8 AT from texture', () => {
  assert.equal(calc({ ...PADDYS, nsw395Abs2: 0.9 }).second.aba, 0);
  assert.equal(calc({ ...PADDYS, nsw395Abs: 2 }).aba, 0.2);
  const r = calc({ ...PADDYS, nsw395Surface: 'Existing seal / primerseal – 10 mm', surfaceTexture: 1.5, nsw395SealOrReseal: 'Reseal' });
  assert.equal(r.ar.numeric, 0.4); assert.equal(r.ar.level, 'WARNING');   // 14 mm on matt 10 mm -> +0.4 (A)
});
test('Figure 2 embedment: seals only', () => {
  const seal = calc({ ...PADDYS, initialAadt: 6000, ballpin: 2 });
  assert.equal(seal.ae.numeric, -0.2);   // 3000 v/l/d at 2 mm
  const reseal = calc({ ...PADDYS, initialAadt: 6000, ballpin: 2, nsw395SealOrReseal: 'Reseal' });
  assert.equal(reseal.ae.numeric, 0);
});
test('PMB factor from Table 7A for HSS; notes are 395K only', () => {
  const r = calc({ ...PADDYS, sealDesign: 'HSS1', sealType: 'Single Seal', treatment: 'HSS1-M', binder: 'S35E' });
  assert.equal(r.nsw.factors.pf, 1.05);
  assert.ok(r.notes.some(n => /Form 395K/.test(n.source || '')));
  assert.ok(!r.notes.some(n => /^TN175/.test(n.field || '')));
});
test('4K and TN175 results are unchanged by the 395K option', () => {
  const k = calc({ ...PADDYS, spec: 'AGPT04K-26' }), t = calc({ ...PADDYS, spec: 'TN175' });
  assert.equal(k.nsw, undefined); assert.equal(t.nsw, undefined);
});

let failed = 0;
for (const [n, f] of tests) { try { f(); console.log('ok  -', n); } catch (e) { failed++; console.log('FAIL-', n, '\n   ', e.message); } }
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
