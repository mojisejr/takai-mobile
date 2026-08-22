# TAKAI Warm Garden Notebook — Expo Go Android Operator Card

Status: `pending_operator` · `Expo Go Device Eye Pending`

This card covers only the visual and ergonomic changes introduced by the Warm
Garden Notebook redesign. It does not retroactively accept prior V2 data or
payment behavior, and it does not close Native Eye.

## Start safely

1. From this repository run `npm run start`, then open the QR in Expo Go on a
   real Android phone on the same reachable network.
2. Record the phone, Android version, Expo Go version, cold-open result, and
   any compatibility message in `operator-evidence.json`.
3. TAKAI stores local notebook data in `takai-local-v1.db`. Use a disposable
   notebook. If a reset is truly required, clear Expo Go app storage only for
   that disposable test after recording the decision; never reset a real
   garden notebook.

## Visual and ergonomic scenarios

| ID | Operator action | Expected observation |
|---|---|---|
| `record-person-team-first` | Open `บันทึกงาน`, choose a person for one set and a team for another set. | Person/team pickers are easy to find; Thai labels, selected names, and remove actions remain legible. |
| `record-wage-method-sheet` | Tap `คิดค่าแรงแบบ`; inspect `ค่าแรงรายวัน`, `ค่าแรงรายชั่วโมง`, and `งานเหมา`, then cancel and choose one. | The choice opens a full-screen-safe picker sheet, not a cramped segmented pill; cancel makes no write. |
| `record-daily-full-half-picker` | With `ค่าแรงรายวัน`, tap `ช่วงเวลาทำงาน` and choose full day then half day. | The compact picker is reachable, clearly describes full/half only, and the explicit `ไม่มีค่าแรงสำหรับชุดงานนี้` control remains understandable. |
| `record-hourly-vertical-fields` | With `ค่าแรงรายชั่วโมง`, add two jobs and fill job name, hours, minutes, then remove one. | Each hourly job reads top-to-bottom: job, hours/minutes, remove; at 320px no control overlaps or causes horizontal scrolling. |
| `record-long-form-keyboard` | Open the Thai keyboard in the last hourly/rate field, then scroll, open/close a picker, add/remove work, and reach `บันทึกงาน`. | Active input, sheet, sticky save action, and all five tabs behave without hidden controls or accidental navigation. |
| `read-money-notebook-consistency` | Return to Today, Work, Payment, and People after cancelling and after one disposable successful save. | Header/subtitle, icon tabs, warm cards, trailing amounts/states, and Thai text stay readable; work, compensation, and cash remain understandable as separate facts. |

## Observation boundary

For each scenario record `passed`, `repair_needed`, `blocked`, or `not_run`, a
real note, and screenshot paths when available. Also record cold open, touch,
scroll, keyboard, safe area/Thai layout, and persistence observations. Do not
mark the card passed from RN Web, static tests, or a guessed result.

## Acceptance decision

Only the Android operator may change this from `Expo Go Device Eye Pending` to
`Expo Go Device Eye Closed`. If a scenario fails, retain the exact screen,
viewport/device detail, and reproduction in `operator-evidence.json`. Native
Eye remains Pending; this card does not create an internal build or publication.
