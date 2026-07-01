[tn175-implementation-log.md](https://github.com/user-attachments/files/29532440/tn175-implementation-log.md)
# TN175 Implementation Log

## v39 Design Area / Vt notes

Added a ROAD Design Area selector so TN175 Section 6.1.2 Vt notes are driven by designer intent rather than guessed from road width or traffic.

Design Area options:
- Traffic lane / wheel path
- Wide shoulder
- Narrow shoulder
- Centreline / between lanes
- Median / painted or physical median
- Rest area / parking area
- Heavy vehicle rest area
- Gore / painted island / non-trafficked sealed area

TN175 Vt note behaviour:
- Traffic lane / wheel path: normal trafficked-lane Vt logic.
- Wide shoulder: check Vt = 0.00 where traffic is <100 v/l/d.
- Narrow shoulder: check whether through-lane traffic counts are being used; Vt = +0.02 may be used.
- Centreline / between lanes: check whether through-lane traffic counts are being used; Vt = +0.02 may be used.
- Median: confirm genuinely non-trafficked vs through-lane traffic design assumption.
- Rest area / parking area: check turning, braking, stopping, heavy vehicle percentage and final binder rate.
- Heavy vehicle rest area: check high HV, stress, vehicle wander and hot climate.
- Gore / painted island / non-trafficked sealed area: confirm actual traffic exposure and Vt basis.
