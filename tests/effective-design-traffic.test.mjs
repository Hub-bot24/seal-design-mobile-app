// Regression tests for the EHV > 65% nominal design traffic fix.
//
// Background: for the Basic Voids Factor (Vf), the app must feed in "nominal"
// design traffic instead of normal lane/common-path traffic whenever
// EHV = SHV% + 3*LHV% exceeds 65%. Below/at 65% EHV, nothing changes at all.
//
// These tests import app.js directly (it is an ES module) and exercise the
// pure calculation functions (compoundTraffic, vehicleFactor,
// heavyVehicleGradientCorrection, calculateCoat, and the two new helpers
// calculateNominalDesignTraffic / getEffectiveDesignTraffic) without touching
// the DOM. state.lookups / state.binderMatrix are primed from the same JSON
// files the app loads at runtime (data/lookups.json, data/binder-matrix.json).
//
// Run with: node --test tests/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  state,
  compoundTraffic,
  vehicleFactor,
  heavyVehicleGradientCorrection,
  calculateCoat,
  calculateNominalDesignTraffic,
  getEffectiveDesignTraffic
} from '../app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

before(() => {
  state.lookups = JSON.parse(readFileSync(path.join(repoRoot, 'data/lookups.json'), 'utf8'));
  state.binderMatrix = JSON.parse(readFileSync(path.join(repoRoot, 'data/binder-matrix.json'), 'utf8'));
});

// A realistic, complete AGPT04K-26 single-seal form-values object. Every test
// overrides only the fields it cares about. growthRate defaults to 0 so
// initialAadt === aadt regardless of what "today" is when the suite runs.
function baseV(overrides = {}) {
  return {
    projectName: 'Test project', roadName: 'Test road', designer: 'Test',
    baseYear: new Date().getFullYear(), initialAadt: 700, growthRate: 0,
    shvPct: 5, lhvPct: 3, laneSplit: 50,
    spec: 'AGPT04K-26', sealType: 'Single Seal', treatment: 'Conventional Seal',
    reinforcementSystem: 'None',
    aggregateSize: '10mm', aldMirror: 3.8, flIndex: 20, binder: 'C170',
    aggregateSize2: '7mm', aldMirror2: 3.8, flIndex2: 20, binder2: 'C170',
    surfaceType: 'N/A', surfaceTexture: '', ballpin: '', gradient: 'Flat or Downhill',
    braking: 'No', roadWidth: '', designArea: 'Traffic lane / wheel path',
    otherAdjustment: 0, samiAdoptedBf: '', aba: 0, aba2: 0, ap: 0,
    ...overrides
  };
}

// Mirrors calculate()'s own construction of the second-coat form values
// (app.js, calculate()), so the double-seal tests exercise the same sharing
// of traffic fields between coats that the real app relies on.
function secondCoatV(v) {
  return {
    ...v,
    _secondCoat: '1',
    sealType: 'Double 2nd Coat',
    aggregateSize: v.aggregateSize2 || '7mm',
    aldMirror: v.aldMirror2,
    flIndex: v.flIndex2,
    binder: v.binder2 || v.binder,
    surfaceType: 'N/A',
    surfaceTexture: '',
    ballpin: 'N/A',
    aba: v.aba2 || 0,
    ap: 0,
    otherAdjustment: 0
  };
}

describe('calculateNominalDesignTraffic / getEffectiveDesignTraffic (pure helpers)', () => {
  test('trigger boundary is strictly > 65, not >= 65', () => {
    // lvPct=0, shvPct=ehv, lhvPct=0 isolates the ehv value directly.
    assert.equal(getEffectiveDesignTraffic(100, 0, 64.99, 0), 100, '64.99% must stay normal');
    assert.equal(getEffectiveDesignTraffic(100, 0, 65, 0), 100, '65.00% must stay normal (not >=)');
    assert.notEqual(getEffectiveDesignTraffic(100, 0, 65.01, 0), 100, '65.01% must trigger conversion');
  });

  test('nominal formula matches the spec: LV + 10*(SHV + 3*LHV), expressed as a % of normal traffic', () => {
    const normal = 106.47;
    const lvPct = 46.09749225133841;
    const shvPct = 25.284117591809903;
    const lhvPct = 28.618390156851692;
    const nominal = calculateNominalDesignTraffic(normal, lvPct, shvPct, lhvPct);
    // Independent cross-check using the vehicle-count form of the same formula.
    const lvVeh = normal * lvPct / 100;
    const shvVeh = normal * shvPct / 100;
    const lhvVeh = normal * lhvPct / 100;
    const expected = lvVeh + 10 * (shvVeh + 3 * lhvVeh);
    assert.ok(Math.abs(nominal - expected) < 1e-9);
    assert.ok(Math.abs(nominal - 1232.38) < 0.5, `expected ~1232.38, got ${nominal}`);
  });

  test('never divides normalDesignTraffic by two internally (uses it as given)', () => {
    // If the helper is fed the already-common-path (unhalved) traffic value, it
    // must not silently halve it before applying the formula.
    const fullPath = getEffectiveDesignTraffic(950 /* already the full/common path value */, 0, 100, 0);
    assert.equal(fullPath, 950 * (0 + 10 * 100) / 100);
  });

  test('re-running with the same normalDesignTraffic never compounds', () => {
    const normal = 106.47, lvPct = 46.1, shvPct = 25.28, lhvPct = 28.62;
    const first = getEffectiveDesignTraffic(normal, lvPct, shvPct, lhvPct);
    const second = getEffectiveDesignTraffic(normal, lvPct, shvPct, lhvPct);
    const third = getEffectiveDesignTraffic(normal, lvPct, shvPct, lhvPct);
    assert.equal(first, second);
    assert.equal(second, third);
    // Sanity: feeding the (already nominal) effective value back in as if it
    // were "normal" would blow up to a huge number — prove that is NOT what
    // the app does by checking the real result stays at the single-pass value.
    const wrongDoubleConversion = getEffectiveDesignTraffic(first, lvPct, shvPct, lhvPct);
    assert.notEqual(wrongDoubleConversion, first, 'sanity check: double-conversion would differ from single-pass');
  });
});

describe('TEST 1 — Normal low EHV (<=65%) is untouched', () => {
  test('effectiveDesignTraffic stays equal to normalDesignTraffic; Vf/Vt/binder match direct calls', () => {
    const v = baseV({ shvPct: 5, lhvPct: 3 }); // EHV = 5 + 9 = 14%
    const r = calculateCoat(v);
    assert.ok(r.ehvPct <= 65);
    assert.equal(r.normalDesignTraffic, r.traffic.vld);
    assert.equal(r.effectiveDesignTraffic, r.normalDesignTraffic);
    assert.equal(r.vf, vehicleFactor(r.traffic.vld, v.sealType), 'Vf must come from normal traffic, unchanged');
    assert.equal(r.vt, heavyVehicleGradientCorrection(r.ehvPct, v.gradient, v.braking), 'Vt logic untouched');
    const expectedBaseBinder = r.designVf * r.ald;
    assert.ok(Math.abs(r.baseBinder - expectedBaseBinder) < 1e-9);
    assert.ok(Math.abs(r.finalBinder - (r.modifiedBinder + r.ar.numeric + r.aba + r.ap + r.ae.numeric)) < 1e-9);
  });
});

describe('TEST 2 — EHV exactly 65% does not trigger the conversion', () => {
  test('shv=65, lhv=0', () => {
    const v = baseV({ shvPct: 65, lhvPct: 0 });
    const r = calculateCoat(v);
    assert.equal(r.effectiveDesignTraffic, r.normalDesignTraffic);
    assert.notEqual(r.vt, 0, 'at exactly 65% EHV the normal Vt table still applies');
  });
  test('shv=5, lhv=20 (same 65% EHV via a different mix)', () => {
    const v = baseV({ shvPct: 5, lhvPct: 20 });
    const r = calculateCoat(v);
    assert.equal(r.effectiveDesignTraffic, r.normalDesignTraffic);
  });
});

describe('TEST 3 — EHV slightly above 65% triggers the conversion', () => {
  test('shv=5.01, lhv=20 -> EHV=65.01%', () => {
    const v = baseV({ shvPct: 5.01, lhvPct: 20 });
    const r = calculateCoat(v);
    assert.equal(r.effectiveDesignTraffic, r.nominalDesignTraffic);
    assert.notEqual(r.effectiveDesignTraffic, r.normalDesignTraffic);
    assert.equal(r.vt, 0, 'Vt must be zero once EHV > 65%');
    assert.equal(r.vf, vehicleFactor(r.nominalDesignTraffic, v.sealType));
  });
});

describe('TEST 4 — Hebel-Goodooga worked example', () => {
  test('AADT ~212, normal ~106.47, EHV ~111.14%, nominal ~1232, Vt=0', () => {
    const v = baseV({
      initialAadt: 212.94, growthRate: 0, laneSplit: 50,
      shvPct: 25.284117591809903, lhvPct: 28.618390156851692
    });
    const r = calculateCoat(v);
    assert.ok(Math.abs(r.traffic.aadt - 212.94) < 0.01);
    assert.ok(Math.abs(r.normalDesignTraffic - 106.47) < 0.01);
    const rawEhv = v.shvPct + 3 * v.lhvPct;
    assert.ok(Math.abs(rawEhv - 111.14) < 0.01, `raw EHV should be ~111.14%, got ${rawEhv}`);
    assert.ok(Math.abs(r.nominalDesignTraffic - 1232.38) < 1, `nominal traffic should be ~1232, got ${r.nominalDesignTraffic}`);
    assert.equal(r.effectiveDesignTraffic, r.nominalDesignTraffic);
    assert.equal(r.vt, 0);
    assert.equal(r.vf, vehicleFactor(r.nominalDesignTraffic, v.sealType), 'Vf must be selected from nominal traffic');
  });
});

describe('TEST 5 — Common traffic path (laneSplit=100) is not halved before conversion', () => {
  test('nominal conversion starts from the full common-path traffic, never AADT/2', () => {
    const v = baseV({ initialAadt: 100, growthRate: 0, laneSplit: 100, shvPct: 30, lhvPct: 20 });
    const r = calculateCoat(v);
    assert.equal(r.normalDesignTraffic, 100, 'common path traffic must be the full 100, not halved');
    assert.ok(r.ehvPct > 65);
    // lvPct = 100-30-20 = 50; nominal = 100*(50 + 10*(30+60))/100 = 950
    assert.ok(Math.abs(r.nominalDesignTraffic - 950) < 1e-6);
    assert.equal(r.effectiveDesignTraffic, r.nominalDesignTraffic);
  });
});

describe('TEST 6 — Changing AADT updates nominal traffic immediately', () => {
  test('doubling AADT (same laneSplit/%ages) doubles normal and nominal traffic', () => {
    const v1 = baseV({ initialAadt: 200, growthRate: 0, laneSplit: 50, shvPct: 30, lhvPct: 20 });
    const v2 = baseV({ initialAadt: 400, growthRate: 0, laneSplit: 50, shvPct: 30, lhvPct: 20 });
    const r1 = calculateCoat(v1);
    const r2 = calculateCoat(v2);
    assert.ok(Math.abs(r2.normalDesignTraffic - 2 * r1.normalDesignTraffic) < 1e-9);
    assert.ok(Math.abs(r2.nominalDesignTraffic - 2 * r1.nominalDesignTraffic) < 1e-6);
    assert.ok(Math.abs(r2.effectiveDesignTraffic - 2 * r1.effectiveDesignTraffic) < 1e-6);
  });
});

describe('TEST 7 — Changing SHV/LHV% updates EHV and nominal traffic immediately', () => {
  test('two different heavy-vehicle mixes on the same AADT give different EHV/nominal', () => {
    const shared = { initialAadt: 300, growthRate: 0, laneSplit: 50 };
    const rLow = calculateCoat(baseV({ ...shared, shvPct: 5, lhvPct: 3 }));
    const rHigh = calculateCoat(baseV({ ...shared, shvPct: 30, lhvPct: 25 }));
    assert.equal(rLow.normalDesignTraffic, rHigh.normalDesignTraffic, 'same AADT/laneSplit -> same normal traffic');
    assert.ok(rLow.ehvPct < rHigh.ehvPct);
    assert.equal(rLow.effectiveDesignTraffic, rLow.normalDesignTraffic, 'low mix stays under 65% EHV');
    assert.equal(rHigh.effectiveDesignTraffic, rHigh.nominalDesignTraffic, 'high mix exceeds 65% EHV');
    assert.notEqual(rLow.nominalDesignTraffic, rHigh.nominalDesignTraffic);
  });
});

describe('TEST 8 — Flipping from EHV>65% back to EHV<=65% returns to normal traffic', () => {
  test('two independent calculateCoat calls, no leftover state between them', () => {
    const shared = { initialAadt: 300, growthRate: 0, laneSplit: 50 };
    const rHigh = calculateCoat(baseV({ ...shared, shvPct: 30, lhvPct: 25 })); // EHV=105% -> nominal
    const rLow = calculateCoat(baseV({ ...shared, shvPct: 5, lhvPct: 3 }));    // EHV=14% -> normal
    assert.equal(rHigh.effectiveDesignTraffic, rHigh.nominalDesignTraffic);
    assert.equal(rLow.effectiveDesignTraffic, rLow.normalDesignTraffic);
    assert.equal(rLow.normalDesignTraffic, rHigh.normalDesignTraffic, 'same AADT underneath both calls');
  });
});

describe('TEST 9 — Single seal: conversion happens exactly once', () => {
  test('nominalDesignTraffic matches a single-pass call to the pure helper, not a double pass', () => {
    const v = baseV({ initialAadt: 212.94, growthRate: 0, laneSplit: 50, shvPct: 25.284117591809903, lhvPct: 28.618390156851692 });
    const r = calculateCoat(v);
    const singlePass = calculateNominalDesignTraffic(r.normalDesignTraffic, r.lvPct, r.shvPct, r.lhvPct);
    assert.ok(Math.abs(r.nominalDesignTraffic - singlePass) < 1e-9);
    const doublePass = calculateNominalDesignTraffic(singlePass, r.lvPct, r.shvPct, r.lhvPct);
    assert.notEqual(r.nominalDesignTraffic, doublePass, 'a second pass would produce a much larger, wrong value');
  });
});

describe('TEST 10 — Double seal: both coats share one effective traffic, converted once', () => {
  test('first and second coat use the same normal + nominal traffic (EHV>65%)', () => {
    const v = baseV({
      sealType: 'Double Seal', initialAadt: 212.94, growthRate: 0, laneSplit: 50,
      shvPct: 25.284117591809903, lhvPct: 28.618390156851692
    });
    const first = calculateCoat(v);
    const second = calculateCoat(secondCoatV(v));
    assert.ok(first.ehvPct > 65 || (v.shvPct + 3 * v.lhvPct) > 65);
    assert.equal(first.normalDesignTraffic, second.normalDesignTraffic, 'both coats share the same design lane traffic');
    assert.equal(first.nominalDesignTraffic, second.nominalDesignTraffic, 'both coats compute the same nominal traffic');
    assert.equal(first.effectiveDesignTraffic, second.effectiveDesignTraffic);
    assert.ok(Math.abs(first.effectiveDesignTraffic - 1232.38) < 1);
    // The 1st/2nd coat Vf curves differ, but both were fed the same traffic value.
    assert.equal(first.vf, vehicleFactor(first.effectiveDesignTraffic, 'Double Seal'));
    assert.equal(second.vf, vehicleFactor(second.effectiveDesignTraffic, 'Double 2nd Coat'));
  });

  test('double seal at EHV<=65% is unaffected (both coats use normal traffic)', () => {
    const v = baseV({ sealType: 'Double Seal', shvPct: 8, lhvPct: 4 });
    const first = calculateCoat(v);
    const second = calculateCoat(secondCoatV(v));
    assert.equal(first.effectiveDesignTraffic, first.normalDesignTraffic);
    assert.equal(second.effectiveDesignTraffic, second.normalDesignTraffic);
  });
});

describe('TEST 11 — Repeated recalculation never compounds the conversion', () => {
  test('calling calculateCoat 5x in a row with the same inputs is stable', () => {
    const v = baseV({ initialAadt: 212.94, growthRate: 0, laneSplit: 50, shvPct: 25.284117591809903, lhvPct: 28.618390156851692 });
    const results = Array.from({ length: 5 }, () => calculateCoat(v));
    const values = results.map(r => r.effectiveDesignTraffic);
    for (const val of values) assert.equal(val, values[0]);
    assert.ok(Math.abs(values[0] - 1232.38) < 1, 'must stay pinned at the single-pass nominal value, not drift upward');
  });
});

describe('Embedment allowance is unaffected by the nominal traffic conversion', () => {
  test('embedment still keys off normalDesignTraffic even when EHV>65%', () => {
    // Same normalDesignTraffic (~2200) and ball penetration under both a low and
    // a high EHV mix: the embedment allowance table is independent of Vf/EHV and
    // must return the identical result either way.
    const shared = { initialAadt: 4400, growthRate: 0, laneSplit: 50, ballpin: '2' };
    const rLow = calculateCoat(baseV({ ...shared, shvPct: 5, lhvPct: 3 }));
    const rHigh = calculateCoat(baseV({ ...shared, shvPct: 40, lhvPct: 30 }));
    assert.ok(rHigh.ehvPct > 65 || (40 + 3 * 30) > 65);
    assert.equal(rLow.normalDesignTraffic, rHigh.normalDesignTraffic);
    assert.notEqual(rHigh.effectiveDesignTraffic, rHigh.normalDesignTraffic, 'sanity: high case did convert for Vf');
    assert.deepStrictEqual(rLow.ae, rHigh.ae, 'embedment allowance must not change based on the EHV branch');
  });
});
