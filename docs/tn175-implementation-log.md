# TN175 implementation log

## Phase 1 — lookup start

This build starts TN175 from the workbook **Lookups** tab only. It uses the extracted TN175 matrix for:

- treatment options
- binder dropdowns
- binder factor (BF)

The uploaded TN175 PDF says it outlines amendments to Part 4K for departmental projects and that aligned section/table references are to be read with Part 4K. That means TN175 cannot be treated as a completely separate calculator; it is a TMR layer over 4K.

## Important guardrail

Where a TN175-specific rule has not yet been coded, the app still falls back to the current AGPT04K-26 engine and displays a TN175 validation note. Do not call those rows certified until they are checked page by page.

## TN175 lookup combinations included

- **Double 1st Coat / Conventional Seal**: C170 (BF 1.0), C240 (BF 1.0), C320 (BF 1.0), M500 (BF 1.1), AMC5 (BF 1.0), AMC6 (BF 1.0), AMC7 (BF 1.0)
- **Double 1st Coat / HSS2-H**: S15E (BF 1.0), S20E (BF 1.1), S15R (BF 1.1), S15RF (BF 1.1)
- **Double 1st Coat / HSS2-M**: S10E (BF 1.0), S35E (BF 1.0), S15R (BF 1.1), S15RF (BF 1.1)
- **Double 1st Coat / SAM-R**: S15E (BF 1.2), S20E (BF 1.3), S15R (BF 1.3), S15RF (BF 1.3)
- **Double 1st Coat / SAM-S**: S10E (BF 1.2), S15E (BF 1.2), S35E (BF 1.2), S15R (BF 1.3), S15RF (BF 1.3)
- **Double 2nd Coat / Conventional Seal**: C170 (BF 1.0), C240 (BF 1.0), C320 (BF 1.0), M500 (BF 1.1), AMC5 (BF 1.0), AMC6 (BF 1.0), AMC7 (BF 1.0)
- **Double 2nd Coat / HSS2-H**: S15E (BF 1.0), S20E (BF 1.1), S15R (BF 1.1), S15RF (BF 1.1)
- **Double 2nd Coat / HSS2-M**: S10E (BF 1.0), S35E (BF 1.0), S15R (BF 1.1), S15RF (BF 1.1)
- **Double 2nd Coat / SAM-R**: S15E (BF 1.2), S20E (BF 1.3), S15R (BF 1.3), S15RF (BF 1.3)
- **Double 2nd Coat / SAM-S**: S10E (BF 1.2), S15E (BF 1.2), S35E (BF 1.2), S15R (BF 1.3), S15RF (BF 1.3)
- **Single / Aggregate retention(AR)**: S35E (BF 1.0), S10E (BF 1.1)
- **Single / Bridge Deck Waterproofing**: S25E (BF 1.3)
- **Single / Conventional Seal**: C170 (BF 1.0), C240 (BF 1.0), C320 (BF 1.0), M500 (BF 1.1), AMC5 (BF 1.0), AMC6 (BF 1.0), AMC7 (BF 1.0)
- **Single / HSS1-H**: S15E (BF 1.11), S15R (BF 1.11), S20E (BF 1.11), S15RF (BF 1.11)
- **Single / HSS1-M**: S10E (BF 1.0), S35E (BF 1.0), S15R (BF 1.1), S15RF (BF 1.1), S9R (BF 1.0), S9RF (BF 1.0)
- **Single / Interlayer Bond Waterproofing**: S25E (BF 1.3), C170 (BF 1.3)
- **Single / SAM-R**: S15R (BF 1.31), S15E (BF 1.31), S20E (BF 1.31), S15RF (BF 1.31)
- **Single / SAM-S**: S10E (BF 1.2), S35E (BF 1.2)
- **Single / SAMI**: S25E (BF 1.3), S18RF (BF 1.5)
- **Single / Unmodified Emulsion Seal**: Emulsion(≥67%) (BF 1.1), Emulsion(60%) (BF 1.0), Emulsion(≥67%)-Under Asphalt (BF 1.1), Emulsion(60%)-Under Asphalt (BF 1.0)
