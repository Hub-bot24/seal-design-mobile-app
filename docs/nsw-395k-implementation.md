# TfNSW Form 395K spec option (v68)

The SPEC dropdown now has three options: **AGPT04K-26**, **TN175** (TMR) and **395K** (TfNSW Form 395K, 01/2014).

395K is a separate method, not an amendment to Part 4K. When SPEC = 395K, `calculateCoat()` hands the whole coat to `calculateCoat395k()`, and the design notes come only from `build395kNotes()`. The 4K and TN175 paths are unchanged.

## What 395K changes compared with 4K / TN175

| Item | 395K rule | App behaviour |
|---|---|---|
| Aggregate shape (Va) | Table 4, by shape class: crushed flaky/angular/cubic, partly crushed rounded, not crushed rounded | **Flakiness Index is not used** and is hidden. A "Shape (395K T4)" select drives Va |
| Basic voids factor (Vf) | Figures 1A/1B mid-line. The 395K chart is **not** flat below 100 v/l/d | Fitted mid-line, or the designer's chart reading ("Vf chart reading" row) |
| Traffic effects (Vt) | Table 3B | Gradient + channelised inputs |
| Voids modifier (Vm) | Table 5, D/D 1st layer only (0.75 / 0.80 / 0.85 / 0.90) | New Vm row |
| Design VF | (Vf + Va + Vt) × Vm, rounded to 0.01 | As per the Rev 0 sheet practice |
| Binder factors | Table 6 (EF) and Tables 7A–7D (PF) | Conventional = no factor; emulsion uses A × EF × PF; PMB uses A × PF. Binders not in Table 7 fall back to the 4K factor with a CHECK note |
| Surface texture (AT) | Table 8 (existing seal size × T240 texture × proposed size) and Tables 11A–11E | "SURFACE (395K)" select. Unsealed base uses a designer AT (no 395K table) |
| ABA | Table 9 from absorption % | "Absorption %" per coat; blank = Aba input |
| ABB | Table 12 | Uses the "Binder Abs. by Pav." input, with warnings outside 0.0 (sealed/primed) or 0.1–0.4 (unsealed) |
| Embedment (AE) | Figure 2, seals only | Digitised chart, interpolated; 0 for reseals |
| Spread rate | Table 1A (limit/ALD), Table 1B (5/7 mm), × Table 2 seal type factor | "Table 1A limit" select: Auto (guide note: ALD ≥ 0.6 × nominal → lower; shoulder or > 750 v/l/d → 800/ALD), Lower or Upper. F is rounded down, as on the Rev 0 sheet |

## Validation

`test/nsw-395k.test.mjs` reproduces the Paddy's Flat Rd D/D 14/10 C170 design (Rev 0) value for value, and the ALD₂ 6.6 → 6.5 update (BD2 1.35 → 1.34, H2 128 → 130).

Run: `node test/nsw-395k.test.mjs`
