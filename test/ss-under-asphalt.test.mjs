// Regression tests for TN175 Table Q5.5.4 "S/S Under Asphalt" treatment.
// Runs the real app.js in a minimal VM sandbox (same approach as ehv-nominal-traffic.test.mjs).
// Run with: node test/ss-under-asphalt.test.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js'), 'utf8');
const cut = src.indexOf("\nwindow.addEventListener('beforeinstallprompt'");
assert.notEqual(cut, -1, 'app.js end-of-declarations marker not found');
let current = {};
class FakeFormData { constructor(f) { this._e = Object.entries((f && f.__values) || {}); } entries() { return this._e[Symbol.iterator](); } }
const ctx = vm.createContext({
  console, window: {}, navigator: {}, FormData: FakeFormData,
  document: { querySelector: s => (s === '#designForm' ? { __values: current } : null), getElementById: () => null, body: { classList: { toggle() {} } } },
});
vm.runInContext(src.slice(0, cut), ctx, { filename: 'app.js' });
vm.runInContext('state.lookups = EMBEDDED_LOOKUPS; state.binderMatrix = EMBEDDED_BINDER_MATRIX;', ctx);

const BASE = {
  baseYear: 2026, initialAadt: 100, growthRate: 2, laneSplit: 50, shvPct: 0, lhvPct: 0,
  spec: 'TN175', sealType: 'Single Seal', treatment: 'S/S Under Asphalt', reinforcementSystem: 'None',
  aggregateSize: '7mm', aldMirror: 4.1, flIndex: 20, binder: 'C170',
  surfaceType: 'N/A', surfaceTexture: '', ballpin: 'N/A', gradient: 'Flat or Downhill', braking: 'No',
  roadWidth: 0.6, designArea: 'Traffic lane / wheel path', otherAdjustment: 0, aba: 0, ap: 0, aba2: 0, samiAdoptedBf: '',
};
function calc(o) { current = { ...BASE, ...o }; return vm.runInContext('calculate()', ctx); }

const tests = [
  ['7 mm C170 S/S under asphalt: calculated rate kept, recommended-rate note shown, spread 220 m²/m³', () => {
    const r = calc({});
    assert.ok(r.finalBinder < 1.0, 'calculated rate must not be forced up to the TN175 typical rate');
    assert.equal(r.finalBinder, r.calculatedBinder);
    assert.equal(r.ssBelowRecommended, true);
    assert.equal(r.agg.m2m3, 220);
    assert.ok(r.notes.some(n => n.field === 'TN175 S/S under asphalt recommended spray rate' && n.level === 'CHECK'));
  }],
  ['Conventional Seal 7 mm is unchanged (normal Table Q6.8 spread, no minimum)', () => {
    const r = calc({ treatment: 'Conventional Seal' });
    assert.equal(r.ssBelowRecommended, false);
    assert.ok(r.finalBinder < 1.0);
    assert.equal(r.agg.source, 'TN175 Table Q6.8');
  }],
  ['10 mm S/S under asphalt uses 1000–1100/ALD; no note when calc meets 1.2 L/m²', () => {
    const r = calc({ aggregateSize: '10mm', aldMirror: 5.7 });
    assert.ok(r.finalBinder >= 1.2);
    assert.equal(r.ssBelowRecommended, false);
    assert.equal(r.agg.baseMin, 1000); assert.equal(r.agg.baseMax, 1100);
  }],
  ['14 mm S/S under asphalt below 1.5 L/m²: rate kept, note shown', () => {
    const r = calc({ aggregateSize: '14mm', aldMirror: 5.0 });
    assert.ok(r.finalBinder < 1.5);
    assert.equal(r.ssBelowRecommended, true);
  }],
  ['AMC cutback is not offered for S/S Under Asphalt', () => {
    const rows = vm.runInContext("EMBEDDED_BINDER_MATRIX.rows.filter(r => r.spec === 'TN175' && r.treatment === 'S/S Under Asphalt').map(r => r.binder)", ctx);
    assert.deepEqual([...rows], ['C170', 'C240', 'C320', 'M500', 'C170 + 5 parts crumb rubber']);
  }],
  ['JSON matrix and embedded matrix stay in sync', () => {
    const json = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'binder-matrix.json'), 'utf8'));
    const emb = vm.runInContext('JSON.stringify(EMBEDDED_BINDER_MATRIX.rows)', ctx);
    assert.equal(JSON.stringify(json.rows), emb);
  }],
];
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n  ', e.message); }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed (of ${tests.length})`);
process.exit(failed ? 1 : 0);
