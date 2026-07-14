TN175 Implementation Log
v39 Design Area / Vt notes
Added a ROAD Design Area selector so TN175 Section 6.1.2 Vt notes are driven by designer intent rather than guessed from road width or traffic.
Design Area options:
Traffic lane / wheel path
Wide shoulder
Narrow shoulder
Centreline / between lanes
Median / painted or physical median
Rest area / parking area
Heavy vehicle rest area
Gore / painted island / non-trafficked sealed area
TN175 Vt note behaviour:
Traffic lane / wheel path: normal trafficked-lane Vt logic.
Wide shoulder: check Vt = 0.00 where traffic is <100 v/l/d.
Narrow shoulder: check whether through-lane traffic counts are being used; Vt = +0.02 may be used.
Centreline / between lanes: check whether through-lane traffic counts are being used; Vt = +0.02 may be used.
Median: confirm genuinely non-trafficked vs through-lane traffic design assumption.
Rest area / parking area: check turning, braking, stopping, heavy vehicle percentage and final binder rate.
Heavy vehicle rest area: check high HV, stress, vehicle wander and hot climate.
Gore / painted island / non-trafficked sealed area: confirm actual traffic exposure and Vt basis.

v44 — TN175 Binder Factor Audit
Confirmed and hard-coded TN175 December 2025 Table Q6.4 and Q6.5 binder factors:
Table Q6.4 — Single / single seals
Conventional seal: C170, C240, C320, or C170 + 5 parts crumb rubber = BF 1.0
Conventional seal: M500 = BF 1.1
Unmodified emulsion: conventional emulsion 60% = BF 1.0
Unmodified emulsion: high binder content emulsion ≥67% = BF 1.1
Modified emulsion: use the relevant PMB factor below
HSS1: S10E, S35E, S9R, S9RF = BF 1.0
HSS1: S15E, S15R, S15RF, S20E = BF 1.1
SAM: S10E, S35E, S9R, S9RF = BF 1.2
SAM: S15E, S15R, S15RF, S20E = BF 1.31
SAMI: S25E, S18RF = BF 1.3–1.52; app uses 1.3 and raises a designer confirmation note
WP-A: S20E, S25E, S15R, S15RF, S18RF, or C170 as approved by Administrator = BF 1.3
Table Q6.5 — Double / double seals
Conventional seal: C170, C240, C320, or C170 + 5 parts crumb rubber = BF 1.0
Conventional seal: M500 = BF 1.1
Unmodified emulsion: conventional emulsion 60% = BF 1.0
Unmodified emulsion: high binder content emulsion ≥67% = BF 1.1
Modified emulsion: use the relevant PMB factor below
HSS2: S10E, S35E, S9R, S9RF = BF 1.0
HSS2: S15E, S15R, S15RF, S20E = BF 1.1
XSS: S15E, S15R, S15RF, S20E = BF 1.1
SAM: S10E, S35E, S9R, S9RF, S15E, S15R, S15RF, S20E = BF 1.1
Notes implemented:
High stress / very heavy traffic / high heavy vehicle conditions can justify designer review for reducing BF by 0.1, but not below 1.0. This is not applied automatically.
S18RF for SAMI is flagged as limited TMR experience / small-scale trial until more experience is gained.
S15R/S15RF/S18RF for WP-A is flagged as limited TMR experience and bleeding-through-asphalt risk.
C170 in WP-A is flagged as Administrator approval required.
