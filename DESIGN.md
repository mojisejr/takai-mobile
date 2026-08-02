---
design_md_version: 2
project: takai-mobile
token_source: src/theme/tokens.ts
verify_tokens:
  - name: color.primary.green
    expect: "#2E7D32"
  - name: color.surface.sand
    expect: "#F4E9D8"
  - name: color.text.primary
    expect: "#1F2D1F"
  - name: radius.card
    expect: "12"
  - name: typography.body.size
    expect: "16"
verify_eyes:
  - kind: rn-static-eye
    gate: required
    sees: [Labor navigation, source-level responsive guards, projection adapter wiring]
    does_not_see: [Rendered browser layout, Android touch, native safe areas]
    artifact_sink: .oracle-eye/rn-static/labor-brand-product-polish/
    commands: [npm run test:design-contract, npm run test:labor-read-ui, npm run test:labor-notebook-boundary]
    claim_label: RN Static Token Gate Closed
  - kind: rn-web-eye
    gate: required
    sees: [Rendered Expo Web layout, browser console, failed requests, narrow viewport overflow]
    does_not_see: [Expo Go touch, physical safe areas, native packaging]
    artifact_sink: .oracle-eye/rn-web/labor-brand-product-polish/
    commands: [npm run eye:rn-web, browser capture at 390x844 and 320px]
    claim_label: RN Web Eye Closed
  - kind: expo-go-device-eye
    gate: manual
    sees: [Android touch, scrolling, keyboard, safe area, operator comprehension]
    does_not_see: [Native build packaging]
    artifact_sink: .oracle-eye/expo-go/labor-brand-product-polish/
    commands: [Operator runs Expo Go Android scenarios in Phase 5]
    claim_label: Expo Go Device Eye Closed
labor_mvp_navigation: [วันนี้, งาน, บันทึกงาน, คน, เมนู]
proof_lanes: [deterministic, rn-static, rn-web, expo-go-device]
---

# TAKAI Mobile — Labor Notebook Design Contract

## Product frame

TAKAI is a warm, local-first work-and-payment notebook for a garden owner. Its primary record is a **job**. A calendar and history are derived views over work and money events; neither is a second source of truth.

The MVP does not expose the prior garden Activity, plot, hole, case, tracker, or material flows in its primary navigation. Those modules remain preserved in source only. Labor jobs can be general work with no plot.

## Navigation and information architecture

Bottom navigation is exactly:

1. `วันนี้` — operational work and money attention.
2. `งาน` — calendar, selected-day ledger, and history.
3. `บันทึกงาน` — focused job capture.
4. `คน` — people, wage balance, advance balance, and person history.
5. `เมนู` — secondary settings and records.

Payment is contextual from Today, Job Detail, Person Detail, or history. It is not a bottom tab.

## Ledger meaning that UI must preserve

- A job has a work date. Payments, group receipts, advances, recoveries, contract progress, completion, and deadline each retain their own effective dates.
- Calendar groups typed events by effective business date. It must never use audit `occurredAt` as the effective date.
- Daily work is only full day or half day. Other duration is hourly minutes. A person may have multiple jobs in one date.
- Individual work creates person-scoped wage payables. An early payment is wage payment, never an advance.
- Group work owns one settlement group and one lump receipt route. Participant names evidence the work; UI must not invent personal shares or show group cash as a member wage payment.
- Advances and recoveries are person-scoped. A person view separates gross wage, cash paid, wage remaining, advance recovered, and advance remaining.

## Visual theme

Keep the warm field-notebook theme: sand canvas, warm-white cards, green confirmed actions, quiet borders, 12px card radius, readable 16px Thai body text, tabular money, and text-plus-color state. TAKAI is not generic SaaS, a payroll package, or inventory software.

Use Thai labels that describe the actual garden accounting model: `คนทำงาน`, `ชุดรับเงิน`, `ผู้รับเงินสดแทน`, `ค้างค่าแรง`, and `เงินเบิกคงเหลือ`.

## Component inventory

Reuse `AppShell`, `TopBar`, `BottomTabBar`, `FieldCard`, `SectionHeader`, `PrimaryButton`, `StatusChip`, `SearchPickerSheet`, `DatePickerField`, and `StickySaveBar`.

Adapt/create `LaborMvpApp`, labor-specific status chips, compact calendar event markers, `LaborRecordRow`, `CalendarDaySheet`, `LedgerTimeline`, filter sheet, and an amount-summary strip. Do not retrofit `OperationalSliceScreen`.

## Layout and responsive rules

- Android phone portrait is primary. Web preview is constrained to a mobile column.
- Page padding is 16px; sections gap 16px; rows are at least 48px; touch targets are 44–48px.
- Thai title/body rows with a trailing amount or state use `minWidth: 0`, explicit wrapping/truncation, and a stable trailing slot.
- Calendar keeps seven columns at 320px and 390px. It uses low-density typed markers; the selected-day sheet carries detail.
- No nested decorative cards, gradients, glass effects, tiny outdoor-only metadata, or color-only state.

## Notebook and proof lanes

Normal app boot opens the real local notebook and never creates proof records. Proof fixtures remain explicit test-only data; when they are intentionally shown, the UI uses only the Thai marker `ข้อมูลทดสอบ`. Web must never fabricate a writable local notebook.

| Lane | Required phase | What it proves |
|---|---:|---|
| Deterministic | every phase | ledger, adapter, and projection correctness |
| RN Static | phases 1–4 | contract, tokens, imports, primitive/route presence |
| RN Web | phases 3–4 | rendered layout, browser console/network issues |
| Expo Go device | phase 5 | Android touch, scrolling, safe area, keyboard, comprehension |

RN Web and static proof do not claim native device usability. Expo Go operator acceptance remains the gate of record.
