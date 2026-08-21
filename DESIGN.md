---
design_md_version: 3
project: takai-mobile
token_source: src/theme/tokens.ts
verify_tokens:
  - name: color.primary.green
    expect: "#2E7D32"
  - name: color.surface.sand
    expect: "#F7F1E5"
  - name: color.text.primary
    expect: "#1F2D1F"
  - name: radius.card
    expect: "24"
  - name: typography.body.size
    expect: "17"
verify_eyes:
  - kind: rn-static-eye
    gate: required
    sees: [Labor navigation, source-level responsive guards, projection adapter wiring]
    does_not_see: [Rendered browser layout, Android touch, native safe areas]
    artifact_sink: .oracle-eye/rn-static/takai-warm-notebook-ui-redesign/
    commands: [npm run test:design-contract, npm run test:labor-navigation-ui, npm run test:labor-read-ui, npm run test:labor-v2-read-navigation-ui, npm run test:labor-notebook-boundary]
    claim_label: RN Static Token Gate Closed
  - kind: rn-web-eye
    gate: required
    sees: [Rendered Expo Web layout, browser console, failed requests, narrow viewport overflow]
    does_not_see: [Expo Go touch, physical safe areas, native packaging]
    artifact_sink: .oracle-eye/rn-web/takai-warm-notebook-ui-redesign/
    commands: [npm run eye:rn-web, browser capture at 390x844 and 320x844]
    claim_label: RN Web Eye Closed
  - kind: expo-go-device-eye
    gate: manual
    sees: [Android touch, scrolling, keyboard, safe area, operator comprehension]
    does_not_see: [Native build packaging]
    artifact_sink: .oracle-eye/expo-go/takai-warm-notebook-ui-redesign/
    commands: [Operator runs the prepared V2 Expo Go Android scenarios in Phase 4]
    claim_label: Expo Go Device Eye Closed
labor_mvp_navigation: [วันนี้, งาน, บันทึกงาน, จ่ายเงิน, คน]
proof_lanes: [deterministic, rn-static, rn-web, expo-go-device]
---

# TAKAI Mobile — Labor Notebook Design Contract

## Product frame

TAKAI is a warm, local-first work-and-payment notebook for a garden owner. Its primary fact is `งานที่ทำวันนี้`; `ค่าแรง` and payment are separate facts. A calendar/history derives from work, while money views derive from wage and payment; neither is a second source of truth.

The MVP does not expose the prior garden Activity, plot, hole, case, tracker, or material flows in its primary navigation. Those modules remain preserved in source only. Labor jobs can be general work with no plot.

## Navigation and information architecture

Bottom navigation is exactly:

1. `วันนี้` — งานที่ทำวันนี้ล่าสุดไม่เกิน 5 รายการ และค่าแรงค้างจ่ายไม่เกิน 5 รายการ พร้อมทางไป `ดูทั้งหมด`.
2. `งาน` — ปฏิทิน 7 คอลัมน์, เลือกวัน, รายการงานทั้งหมดแบบกรองได้, และรายละเอียดงาน.
3. `บันทึกงาน` — task capture plus daily/hourly/open-contract compensation units.
4. `จ่ายเงิน` — obligation payment, bonus, person-only advance recovery, and reasoned correction entry.
5. `คน` — people, wage balance, advance balance, and person history.

Payment is also contextual from Today, Job Detail, Person Detail, or history; every route opens the same payment entry state. `เมนู` and its hamburger affordance are retired from the Labor MVP.

The header always carries the TAKAI mascot and brand with the current screen as its subtitle. Detail screens provide a back action; the `i` action opens an in-app help sheet. Meaningful choices use picker/search sheets, including work kind, settlement route, people, and history filters. Compact chips are reserved for short states such as `ค้างจ่าย`, `จ่ายแล้ว`, and `ครึ่งวัน`. `ประวัติเดิม (V1, อ่านอย่างเดียว)` appears only in history/detail context and never contributes to V2 totals.

## Ledger meaning that UI must preserve

- A task has a work date; it does not itself create money. Payments, advances, recoveries, contract progress, completion, and deadline retain their own effective dates.
- Calendar groups typed events by effective business date. It must never use audit `occurredAt` as the effective date.
- Daily work is only full day or half day. Other duration is hourly minutes. A person may have multiple jobs in one date.
- Daily work creates one person-scoped unit per worker/date; hourly work creates person/shift units. An early payment is wage payment, never an advance.
- Contract work owns one batch and later one lump group obligation. Participant names evidence the work; UI must not invent personal shares or show group cash as a member wage payment.
- Advances and recoveries are person-scoped. A person view separates gross wage, cash paid, wage remaining, advance recovered, and advance remaining.

## Visual theme

Use the **Warm Garden Notebook** grammar: light cream canvas, warm-white elevated surfaces, TAKAI green actions, quiet sage/gold support colours, and sparse low-contrast borders. Hero surfaces use a 28px radius, primary cards 24px, rows/forms 18px, and only state chips are pill-shaped. Noto Sans Thai 400/600/700/800 is the product typeface: editorial page hierarchy (34px title, 24px section), 17px readable body, and tabular money. The mascot stays the single identity character; garden accents are abstract/native, never generated art. No gradients, glass, decorative nested cards, icon-only state, or generic payroll-SaaS treatment.

Use Thai labels that describe the actual garden accounting model: `คนทำงาน`, `ชุดรับเงิน`, `ผู้รับเงินสดแทน`, `ค้างค่าแรง`, and `เงินเบิกคงเหลือ`.

## Component inventory

Reuse `AppShell`, `TopBar`, `BottomTabBar`, `FieldCard`, `SectionHeader`, `PrimaryButton`, `StatusChip`, `SearchPickerSheet`, `DatePickerField`, and `StickySaveBar`.

Adapt/create `LaborMvpApp`, labor-specific status chips, compact calendar event markers, `LaborRecordRow`, `CalendarDaySheet`, `LedgerTimeline`, filter sheet, and an amount-summary strip. Do not retrofit `OperationalSliceScreen`.

## Layout and responsive rules

- Android phone portrait is primary. Web preview is constrained to a mobile column.
- At both 320px and 390px, the five icon-plus-Thai-label tabs remain visible/tappable; Thai text must wrap or truncate inside a `minWidth: 0` slot rather than overflow.
- Page padding is 16px; sections gap 16px; rows are at least 48px; touch targets are 44–48px.
- Thai title/body rows with a trailing amount or state use `minWidth: 0`, explicit wrapping/truncation, and a stable trailing slot.
- Calendar keeps seven columns at 320px and 390px. It uses low-density typed markers; the selected-day sheet carries detail.
- No nested decorative cards, gradients, glass effects, tiny outdoor-only metadata, or color-only state.

## Notebook and proof lanes

Normal app boot opens the real local notebook and never creates proof records. Proof fixtures remain explicit test-only data; when they are intentionally shown, the UI uses only the Thai marker `ข้อมูลทดสอบ`. Web must never fabricate a writable local notebook.

| Lane | Required phase | What it proves |
|---|---:|---|
| Deterministic | every phase | ledger, adapter, and projection correctness |
| RN Static | phase 3 | V2 contract, tokens, imports, primitive/route presence |
| RN Web | phase 3 | rendered layout, browser console/network issues |
| Expo Go device | phase 4 | Android touch, scrolling, safe area, keyboard, comprehension |

RN Web and static proof do not claim native device usability. Expo Go operator acceptance remains the gate of record.
