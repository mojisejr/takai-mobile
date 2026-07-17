# TAKAI Phase 5: Local v1 Review

Phase 5 is the local-first acceptance review before any Supabase or cloud sync decision.
It proves whether TAKAI can record one real garden workday on Android without a cloud dependency.

## Gate Of Record

- Gate: `expo-go-device-eye`
- Close label: `Expo Go Device Eye Closed`
- Current status: `operator_pending`
- Artifact: `.oracle-eye/expo-go/phase-5-local-v1-review-manifest.json`

RN Web and automated tests can support this phase, but they cannot close the real-device gate.

## Real Workday Trial

Run this on Android Expo Go while doing or replaying one real garden day.

- Open Today Dashboard and confirm urgent/recent work is understandable at a glance.
- Record one activity for a plot or hole.
- Include a material usage amount when the activity is spray/fertilizer-related.
- Include self-work for work done by the owner, and confirm it does not create an unpaid labor amount.
- Include one worker or payable labor row when relevant.
- Set a follow-up day count or due date when the work needs tracking.
- Open the related Plot Dashboard and confirm tracker latest date, elapsed days, and occurrence count are understandable.
- Open Case Timeline if the work belongs to a disease/case follow-up.
- Open Labor Ledger and confirm unpaid/paid states are understandable.
- Open Materials Library and confirm the material can be found again.
- Open Hole Detail and confirm history reads as a useful record, not just a technical log.

## Acceptance Notes To Capture

Record these notes during the trial:

- Device model and Expo Go SDK.
- Whether the app opens cleanly from Metro QR.
- Whether status bar, header, and bottom navigation avoid overlap.
- Whether Thai text fits important cards, chips, and list rows.
- Whether Activity Capture feels too long or confusing.
- Whether keyboard behavior blocks the field being edited.
- Whether scroll performance is acceptable on dense screens.
- Whether the user can answer: "ทำอะไรไปล่าสุด", "ทำไปกี่วันแล้ว", and "ต้องติดตามอีกวันไหน".
- Any repair item that blocks using the app for another real day.

## Known Gaps List

Use these buckets after the trial:

### Must Fix Before Serious Local Use

- Any crash, save failure, or data not appearing after reload.
- Any screen where Android safe area or keyboard makes controls hard to use.
- Any Activity Capture path that creates misleading labor, material, tracker, or case records.
- Any missing local backup/export safety that makes real data too risky to keep only on device.

### Polish After First Use

- Density, copy, icon, or spacing improvements that do not block recording.
- Faster shortcuts for repeated activities.
- Better filtering in history-heavy screens.
- More useful empty states.

### Future Feature

- Supabase sync.
- Login and worker accounts.
- Native camera/image picker.
- Full case study export.
- AI/Oracle analysis.
- Inventory quantity tracking.

## Local Backup And Export Decision

Before long-running real use, choose one of these:

1. Continue local-only trial with seeded/demo data only.
2. Add a simple local JSON export before recording serious real data.
3. Start Supabase sync planning only after the capture UX is accepted.

Recommended Phase 5 decision: do not start Supabase sync until the Activity Capture flow passes one real workday trial.

## Supabase Sync Seam Review

Current local model is already shaped around syncable records:

- `gardens`
- `plots`
- `crop_cycles`
- `holes`
- `plantings`
- `activities`
- `activity_targets`
- `activity_materials`
- `activity_participants`
- `labor_entries`
- `contract_jobs`
- `cases`
- `materials`
- `media_assets`

Before implementation, Supabase planning must answer:

- Which local IDs become stable remote IDs.
- Whether sync is owner-only first or multi-account from the start.
- How conflict handling works when the same activity is edited offline.
- Whether media assets sync now or remain local placeholders.
- Whether backup/export should ship before bidirectional sync.

## Next Release Decision

After the Android trial:

- If device proof fails, repair Phase 4/5 UX first.
- If device proof passes but local data safety feels risky, implement local export next.
- If device proof passes and local safety is acceptable, create the Supabase sync plan.
- If the app still feels too prototype-like, continue local-first polish before cloud work.
