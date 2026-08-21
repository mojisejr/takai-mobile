# TAKAI Compensation Unit V2 — Expo Go Operator Acceptance

Status: `pending_operator` · `Expo Go Device Eye Pending`

This is the Phase 4 V2 operator card. It replaces the old
`takai-payment-ia` card for future acceptance; that V1 card remains historical
evidence and is not retroactively passed. This card prepares the run only.
`Expo Go Device Eye` stays **Pending** until a person completes the evidence
file on a real Android device.

## Truth boundary

- Gate of record: `expo-go-device-eye` observes real Android open, touch,
  scroll, keyboard, safe area, comprehension, and SQLite persistence.
- It does not prove an APK, internal build, Play readiness, or Native Eye.
- Do not replace a missing path with a database edit, web proof fixture, or a
  guessed result. Mark that scenario `repair_needed` with the exact screen and
  reproduction instead.

## Start and local-data safety

1. From this repository, run `npm run start`. On the Android phone, open the
   Expo Go Android client and scan the Metro QR code on the same reachable
   network. Record the actual QR/URL launch method and cold-open result.
2. The expected client baseline is Expo SDK `54.0.0` / runtime
   `exposdk:54.0.0`. Record an incompatible-client message or crash before
   trying any work flow.
3. TAKAI's local notebook is SQLite database `takai-local-v1.db`. Use a
   disposable test notebook or make a known backup decision before testing.
   If a reset is truly required, only on disposable data clear **Expo Go** app
   storage in Android Settings (or reinstall Expo Go), then reopen the QR and
   confirm the notebook is blank. This erases local Expo Go experience data;
   never use it for a real garden notebook.
4. In `คน`, create only disposable workers as needed: `พี่สุ`, `พี่พวง`,
   `น้าชล`, and `น้าไก่`. Note the actual names/IDs in the evidence file. A
   person archive remains historical and must not be used as a new-work choice.

## Required V2 scenarios

Complete in order. After every save, record whether the next action was found
without coaching and whether the result matches the stated V2 boundary.

| ID | Operator script | Expected acceptance |
|---|---|---|
| `daily-three-tasks-one-wage` | In `บันทึกงาน`, choose one date. Add three task rows for `พี่สุ` (for example `ตัดหญ้า`, `ใส่ปุ๋ย`, `พ่นยา`). Keep one `รายวัน` compensation unit for `พี่สุ`, then save. | Work shows three task rows, while unpaid money shows exactly one person daily obligation; no payment inputs are in the work form. |
| `daily-plus-open-two-member-contract` | On the same date, record `พี่สุ` daily work and add one `งานเหมา` unit named `กรอกถุงเพาะชำ` with members `พี่สุ` + `พี่พวง`. Leave its price and quantity absent, then save. | The daily obligation exists once. The contract is open/unpriced, has both named members, and creates no group due or inferred member shares. |
| `one-person-contract-batch` | Record an open `งานเหมา` with only `น้าชล` as its member; do not enter price/quantity. | One named member is still shown as a contract batch/lump, not converted to a daily or hourly personal wage. |
| `contract-finalization-group-payout` | In `งาน`, open the two-member batch, enter an optional progress note, then enter one final lump total and tap `ปิดงานเหมาสร้างก้อนรับเงิน`. From `จ่ายเงิน`, select the resulting contract obligation and confirm payout. | Finalization yields exactly one `ชุดรับเงิน` group obligation and one group cash payout. It never invents personal member shares or permits a person advance recovery. |
| `unequal-hourly-workers` | Record hourly task-time for `น้าชล` and `พี่สุ` on one date with different minute totals. Use a separate hourly unit/person entry for each worker. | Each worker has an independent hourly obligation matching their own minutes; the result is not an equal split. Do not imply hourly-shift continuation across a second command. |
| `partial-wage-bonus-person-advance-recovery` | Select `น้าไก่`'s person obligation in `จ่ายเงิน`, use `บันทึกเงินเบิก` to issue a disposable advance, select it from `เลือกเงินเบิกของคนนี้`, then enter a partial wage, non-zero bonus, and smaller recovery; review then confirm. | The receipt/history separates wage allocation, bonus, recovery, cash paid, and remaining advance. Recovery cannot exceed the wage/advance and is unavailable for a group obligation. |
| `calendar-person-payment-history` | Inspect `วันนี้`, `งาน`, `คน`, and `จ่ายเงิน` after the earlier entries. Find the work date, a person task history, remaining unpaid compensation, and the completed payment history; force-close/reopen afterward. | Calendar/history counts tasks rather than money records; people show person-scoped work/money; payment history is distinct; saved data remains readable after reopen. |

## Cross-flow observations

For every item below, enter `passed`, `repair_needed`, `blocked`, or `not_run`
and a real note in `operator-evidence.json`.

- Cold open: QR/URL opens without crash or Expo compatibility error.
- Touch: all five tabs, date picker, task add/remove, person sheets,
  compensation-unit add/remove, obligation picker, confirm, and cancel.
- Scroll: long Record form, sheets, Payment review, and person/history lists
  keep the action reachable.
- Keyboard: Thai text and numeric entries do not hide the active field,
  `บันทึกงาน`, or `ยืนยันจ่าย`.
- Safe area/Thai layout: header, sheets, monetary trailing slots, and all five
  bottom tabs remain visible without overlap or horizontal scrolling.
- Persistence: force-close/reopen retains the disposable V2 tasks and payment
  facts, or records the exact persistence failure.
- Comprehension: operator can explain task versus compensation versus cash,
  and group payout versus person-only advance recovery.

## Acceptance decision

Only a real operator may change this card's evidence from Pending to
`Expo Go Device Eye Closed`. Every required scenario and observation needs a
device/client/open result and an explicit acceptance or named repair. Until
then, the exact action is: run the card in Expo Go Android and fill
`operator-evidence.json`. Native Eye remains Pending.
