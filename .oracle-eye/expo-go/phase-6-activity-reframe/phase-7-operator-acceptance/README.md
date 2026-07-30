# TAKAI Phase 7 — Operator acceptance checklist

Status: `pending_operator`

This is the human/device gate for the complete local garden journey. It is an instruction and evidence destination, not proof that the journey has passed.

## Truth boundaries

- `Expo Go Device Eye` can prove field comprehension, tap targets, Thai text, keyboard, scrolling, safe area, persistence, and the date picker on the chosen device.
- `Native Eye` is still required separately for `expo-notifications`: Android permission prompt, channel, scheduling, cancellation, and delivery need a fresh internal/dev build. Opening this project in Expo Go must not be reported as native notification proof.
- Automated tests and RN Web exports prove contracts/bundle readiness only; they do not replace either observation above.

## Before starting

1. Use the current branch/build and record the device, Android version, Expo Go or internal-build version, and app build version in `operator-evidence.json`.
2. Start from a fresh app launch. Use demo data only unless a local backup decision has been made.
3. For the reminder sub-flow, use a future date. Do not rely on an Expo Go result to close the Native Eye lane.

## One complete garden-day journey

1. Open `แปลง`; add a new plot, then a hole, then a tree with an optional variety. Tap `ไปบันทึกกิจกรรมของหลุมนี้` and confirm the newly created plot/hole is selected.
2. In `บันทึก`, backdate three separate activities and check each record before saving:
   - `ทำทั้งวัน`: no invented start/end time;
   - `ระบุช่วงเวลา`: start and end are correct;
   - `ระบุระยะเวลา`: minutes are saved without becoming worker pay.
3. Add two workers. Give each a different pay type and amount (for example hourly 240 and piece 350). After save, inspect `ค่าแรง` and confirm both rows remain independent.
4. Add a chemical. Use reference `20 cc / 200 L`, tank `100 L`, and confirm calculated dose `10 cc`; enter a manual amount `12 cc` and confirm that the manual value is clearly marked rather than silently changing the reference.
5. Create one follow-up by choosing a calendar date and another by N days that resolves to the same date. Before save, confirm the resolved Thai date and remaining-day text. Open `วันนี้` and `แปลง` to check the due/overdue wording comes from that date, not a guessed interval.
6. If intentionally using reminders, press `เปิดการแจ้งเตือนวันติดตาม` only after choosing a future follow-up. Record grant/deny behavior. In an internal/dev build, verify one scheduled reminder, then change or clear its date and verify the prior reminder is cancelled.
7. Force-close and reopen the app. Confirm plot, hole/tree, Activity, workers/pay, material evidence, follow-up state, and Today/Tracker summaries remain readable.

## Operator decision

Set `expoGoDeviceEye` to `closed` only after the operator marks every core flow understandable and records screenshots/notes. Set `nativeEye` to `closed` only after the internal/dev-build reminder checks are observed. Otherwise leave the exact repair item and both truth lanes pending.
