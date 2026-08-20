# TAKAI Labor MVP — Expo Go Operator Acceptance

Status: `pending_operator`

This is the Phase 5 operator scenario card for the focused Labor MVP. It is an
instruction and evidence destination, not device proof. Leave the lane as
`Expo Go Device Eye Pending` until a real operator has recorded the device,
Expo Go client compatibility, open result, and observations in
`operator-evidence.json`.

## Truth boundaries

- **Gate of record:** `expo-go-device-eye` observes Android touch, scrolling,
  keyboard, safe area, and whether the garden owner understands the work-first
  and payment-later model.
- **It does not prove:** an APK/internal build, native packaging, store
  installation, or release readiness. Those remain `Native Eye Pending` unless
  separately authorized and observed.
- The earlier deterministic, RN Static, and RN Web evidence is supporting
  context only. It does not close this operator lane.

## Before the run

1. Record the tested Git SHA, Android device/model/version, Expo Go version,
   expected SDK/runtime compatibility, launch method, and local-data safety
   choice in the evidence file. Do not overwrite an existing real notebook;
   use a disposable test notebook or a known backup.
2. Cold-launch the app from the same Metro QR/URL that will be used during the
   trial. Record whether it opened, crashed, or showed an incompatible-client
   message before attempting any scenario.
3. In `คน`, prepare clearly labelled test people only when they do not collide
   with real data: `พี่สุ`, `พี่พวง`, `น้าชล`, and `น้าไก่`.
4. Do not turn a group job into individual wage rows merely to make a test
   easier. A group is one lump `ชุดรับเงิน`; advance and recovery are always
   person-scoped.

## Real garden scenarios

Complete the cards in order. After every save, note whether the operator could
find the next action without being told where to go. Record screenshots only
when they aid a named acceptance or repair item.

| ID | Scenario | Operator action | Expected result |
|---|---|---|---|
| `two-jobs-same-day` | Two jobs on one date | In `บันทึกงาน`, select one work date and add two individual work rows for `พี่สุ` (for example `ตัดหญ้า` and `เก็บกิ่งไม้`). Save once. | The jobs are distinct rows, not a title blob; both appear for that effective date in Today, Work calendar/day, and the person history. No payment controls appear in the work form. |
| `unequal-hourly-workers` | Unequal hourly work | Record one individual work row with `น้าชล` working 09:00–16:00 and another with `พี่สุ` working 12:00–16:00. Use the applicable whole-minute duration/rate for each. | Each person has an independent due amount and the owner can see that the different hours did not become an equal split. |
| `group-piecework` | Group piecework | Record `พี่สุ` + `พี่พวง` filling 4,125 bags at 1 baht/bag as `ชุดรับเงินรวม`; set the intended cash collector. | One group lump of 4,125 baht is shown. Participant names evidence the work, but neither person receives an invented personal wage payable. |
| `partial-advance-recovery` | Partial advance recovery | Create or use a real test advance of 1,000 baht for `น้าไก่`, then record individual wage due. In person-first payment, recover only 50 baht from a wage payment. | Wage, advance remaining, recovery, and cash handed over are visibly separate. The recovery does not exceed the advance or wage, and does not affect a group settlement. |
| `bonus-separate-from-wage` | Bonus | In the same person-first payment flow, add a non-zero `เงินแถม`. | The confirmation makes wage, bonus, recovery (if any), and cash paid understandable. Bonus does not reduce wage remaining or advance remaining. |
| `pay-by-work` | Pay from selected work | Open `จ่ายเงิน`, choose `เลือกจากงาน`, select an unpaid individual job, review its unpaid wage, and confirm a payment. | The payment is tied to the selected work; the payment confirmation shows the calculated cash and Today/Work/history update after saving. |
| `pay-by-person` | Pay from selected person | Open `จ่ายเงิน`, choose `เลือกจากคน`, select a person with one or more individual unpaid jobs, then review/confirm payment. | The same payment command works from the person route. The operator can tell whose wage is being paid and what remains unpaid. |
| `calendar-filter-review` | Calendar and history review | In `งาน`, choose the dates used above, inspect the selected-day list, then use the filter sheet for date range, person, payment state, and work kind. Clear/reset the filter. | Calendar remains a work-derived view; the owner can answer what happened last week and who is unpaid without mistaking it for a second ledger. |

## Observation checklist

For each scenario, record `passed`, `repair_needed`, `blocked`, or `not_run` in
the evidence file. Also record these cross-flow observations:

- Touch targets: tabs, picker rows, add/remove work items, confirm/cancel.
- Scrolling: long record form, filter sheet, payment confirmation, and person
  history retain a reachable primary action.
- Keyboard: numeric and Thai text entry do not obscure the active field or
  save/confirm action.
- Safe area and Thai layout: header, modal/sheet, bottom tabs, amounts, and
  long Thai labels do not overlap, clip, or require accidental horizontal scroll.
- Comprehension: the operator can distinguish **recording work** from
  **settling money**, and can identify group cash versus personal wage.
- Persistence: after a force-close/reopen, the saved test work and its payment
  results remain readable. If the test uses disposable data, record that fact.

## Acceptance decision

Close `Expo Go Device Eye` only when a real operator marks every required
scenario and observation as understandable/passed, with actual device/client
and open-result evidence. If anything is confusing, failing, or blocked, keep
the lane pending and add a named repair item with its scenario, severity, and
reproduction note. Never replace a repair item with a vague “UI issue”.

An internal Android build is **not** part of this card. It requires explicit
authorization, a final Git SHA, build ID, install/open result, and separate
Native Eye evidence.
