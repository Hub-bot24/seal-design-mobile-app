[tn175-implementation-log.md](https://github.com/user-attachments/files/29531420/tn175-implementation-log.md)
# TN175 Implementation Log — v32

Source: TN175 Selection and Design of Sprayed Bituminous Treatments, Transport and Main Roads, December 2025.

## Implemented as TN175 override layer
TN175 is treated as an amendment layer to AGPT04K / Part 4K. Where TN175 has a rule/table, TN175 overrides 4K. Where TN175 is silent, 4K logic remains the fallback.

## v32 additions
- Full TN175 aggregate spread-rate engine display now uses ranges where TN175 gives ranges instead of a fake single number:
  - Q6.8 single/single seals: 14/16/20, 10, 7/5, and 7/5 no-ALD guidance.
  - Q6.9 scatter coat rate range noted for future treatment wiring.
  - Q6.10 SAMI/WP-A 1000–1100/ALD.
  - Q6.11 double/double first application: 950/ALD or 850/ALD depending binder class.
  - Q6.12 double/double second application: 10 mm, 7 mm, and 7/5 no-ALD ranges.
- TN175 Table Q5.5.4 spray-rate checks added for S/S under asphalt, WP-A and SAMI.
- SAMI / WP-A remains fixed VF = 0.17 using TN175/Part 4K Equation 4 style binder calculation.
- Emulsion note added: residual binder rate is converted to approximate emulsion spray rate using detected binder content (60%, 67% or explicit % in product text). Supplier/MRTS12 product binder content must still be confirmed.
- TN175 variable-rate spray review note added for high EHV/AADT conditions, including ≥0.3 L/m² texture allowance trigger and <10°C seasonal warning.
- Notes now state calculated spread-rate ranges in m²/m³ where the table gives ranges.

## Already implemented before v32
- TN175 Q6.3 surface texture table and Note 1/2/3/4 handling.
- TN175 ball penetration/embedment limit checks: 3.0 mm for >2000 v/l/d, 4.0 mm for ≤2000 v/l/d.
- TN175 Q4.3.2 double seal ALD/interlock review.
- TN175 Q6.4/Q6.5 binder factor fallback rules.
- TN175 initial seal AMC7/cutback notes.

## Still deliberately not certified
- Every TN175 rule still needs validation against known Excel outputs before real design use.
- Scatter coat is included as a rule source but not fully exposed as a dedicated treatment screen yet.
- Variable-rate seal design is currently a note/check engine only; it does not yet calculate separate wheelpath/non-wheelpath spray rates.


## v35 stable hotfix
- Rebuilt from stable v32 to restore the missing calculateCoat function.
- Re-applied hard TN175 Table Q6.8/Q6.11/Q6.12 spread-rate override.
- Fixes v34 start failure/zero outputs.

## v36 TN175 binder factors + embedment notes
- TN175 binder factor logic is now a hard override from Table Q6.4/Q6.5 when SPEC = TN175, before workbook/4K fallback.
- Table Q6.4 single/single binder factors added/confirmed:
  - Conventional C170/C240/C320/C170+crumb rubber = 1.0; M500 = 1.1.
  - Conventional 60% emulsion = 1.0; HBCE / ≥67% = 1.1.
  - HSS1 PMB factors, SAM factors, SAMI factor range and WP-A factor added.
- Table Q6.5 double/double binder factors added/confirmed:
  - Conventional C170/C240/C320/C170+crumb rubber = 1.0; M500 = 1.1.
  - Emulsion and HBCE factors added.
  - HSS2, XSS and SAM factors added.
- Notes now show when a TN175 binder factor has been applied.
- TN175 high traffic / high heavy vehicle binder-factor reduction note added as a CHECK only; no automatic reduction is applied.
- WP-A C170 approval note and WP-A/SAMI limited-experience PMB notes added.
- TN175 embedment / ball penetration note expanded from Section 6.2.3. If the TN175 limit is exceeded, the app now flags that it is not a simple numeric allowance and recommends dry-back/retest, re-preparation, strengthening/stabilising, or armour-coat consideration.
