# Part 4K note engine rules added in v11

This version starts converting AGPT04K-26 guidance into contextual design notes.

## Added rules

- Cutback binder selected: show a check note for AMC/cutback binders.
- AMC/cutback with Ap and Aba both zero: show a check note asking whether absorption allowance is required.
- Pavement absorption Ap:
  - +0.1 to +0.2 L/m² may be appropriate for initial seals directly on granular/unbound pavement.
  - Values above +0.2 L/m² trigger a warning to consider an alternative treatment.
- Aggregate absorption Aba:
  - If required, usually should not exceed +0.1 L/m².
- Embedment Ae:
  - Any non-zero value triggers a designer check note.

## Important distinction

AGPT04K-26 does not say “add 0.1 automatically whenever AMC7 is used.” It says cutback grades may require adjustment to cutter oil content depending on surface porosity/bond, and binder absorption allowances are considered separately under Section 6.2.4.

So the app now prompts the designer at the right time instead of silently adding 0.1 and hiding the judgement.
