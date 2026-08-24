# TAKAI V2 Plot Context — Expo Go Operator Acceptance

Status: `pending_operator` · `Expo Go Device Eye Pending`

This card prepares the physical Android check for the V2 plot-context slice.
It contains no device observation. Only the operator may replace the pending
values in `operator-evidence.json` after observing Expo Go on a real device.

## Start and data safety

1. From this repository run `npm run start`, then open the Metro QR with Expo
   Go Android on the same reachable network. Record the launch method, client
   version, device identity, and cold-open result.
2. The expected baseline is Expo SDK `54.0.0` / runtime `exposdk:54.0.0`.
   Stop and record an incompatibility message or crash before testing flows.
3. TAKAI stores the notebook in `takai-local-v1.db`. Use a disposable notebook
   or record a backup decision first. Never reset a real garden notebook for
   this card.

## Required operator scenarios

| ID | Operator script | Expected acceptance |
| --- | --- | --- |
| `capture-empty-general-work` | In `บันทึกงาน`, choose a worker, enter one task, and leave `พื้นที่ที่ทำงาน` untouched. | General work saves without requiring a plot or creating a location-specific money fact. |
| `capture-multi-plot-target` | Add one task, open `พื้นที่ที่ทำงาน`, search and select two active plots, then return to the task. | Both target rows are clear, removable, and do not create a sixth tab or another wage unit. |
| `quick-add-plot` | From the plot picker enter a new plot name in `เพิ่มแปลงเล็ก ๆ แล้วเลือกทันที`, add it, and return to capture. | The new plot is selected for the originating task and the keyboard never conceals the active field or add action. |
| `tree-add-remove` | Under a selected plot add two `ต้นที่เกี่ยวข้อง` labels, remove one, and save. | Tree labels only exist beneath their chosen plot, long Thai text stays readable, and remove affects only that row. |
| `archive-history-read-only` | In `จัดการแปลง`, archive a disposable plot with a reason; open an old task that used it. | Archived plot disappears from new selection but historical task context remains readable; no hard delete is implied. |
| `rename-detail-history` | Rename a disposable plot with a reason; open a prior task detail and the plot detail timeline. | Task detail shows current name plus `ชื่อเดิมเมื่อบันทึก`; the timeline explains the rename. |

## Cross-flow observations

Record `passed`, `repair_needed`, `blocked`, or `not_run` with an observed note:

- Cold open: Expo Go opens without crash or compatibility error.
- Touch: five tabs, plot multi-picker, quick add, tree add/remove, archive and restore actions work.
- Picker search: Thai plot names filter clearly; archived plots do not appear for new capture.
- Keyboard and scroll: quick-add/tree input, long record form, and route-local detail remain reachable.
- Safe area/Thai layout: title, long Thai plot/tree names, bottom tabs, sheets, and sticky actions do not overlap or scroll horizontally.
- Comprehension: operator understands that plots describe `พื้นที่ที่ทำงาน`, not wage/payment meaning.

## Acceptance decision

`Expo Go Device Eye` remains **Pending** until every required scenario has a
real device/client/open result and explicit operator acceptance or repair item.
RN Web evidence cannot close touch, keyboard, safe-area, or device-comprehension
truth. Native Eye remains Pending.
