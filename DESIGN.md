---
design_md_version: 1
project: takai-mobile
token_source: src/theme/tokens.ts
verify_tokens:
  - name: color.primary.green
    expect: "#2E7D32"
    probe: "rn-static token color.primary.green in src/theme/tokens.ts"
  - name: color.surface.sand
    expect: "#F4E9D8"
    probe: "rn-static token color.surface.sand in src/theme/tokens.ts"
  - name: color.text.primary
    expect: "#1F2D1F"
    probe: "rn-static token color.text.primary in src/theme/tokens.ts"
  - name: radius.card
    expect: "12"
    probe: "rn-static token radius.card in src/theme/tokens.ts"
  - name: typography.body.size
    expect: "16"
    probe: "rn-static token typography.body.size in src/theme/tokens.ts"
verify_eyes:
  - kind: rn-static-eye
    gate: required
    sees:
      - authored token constants and primitive exports exist
      - TypeScript can import the theme contract
      - component names match this DESIGN.md
    does_not_see:
      - real Android touch feel
      - safe-area behavior on physical device
      - outdoor readability
      - native image picker behavior
    artifact_sink: projects/takai-mobile/.oracle-eye/rn-static
    commands:
      - bun run validate
      - bun run test:design-contract
    claim_label: RN Static Token Gate Closed
  - kind: expo-go-device-eye
    gate: pending
    sees:
      - Android Expo Go tap targets, density, safe-area, and navigation feel
      - field-capture ergonomics for Today, Activity, Plot, Case, Labor, and Materials screens
    does_not_see:
      - production native build packaging
      - iOS rendering
    artifact_sink: projects/takai-mobile/.oracle-eye/expo-go
    commands:
      - operator opens Expo Go on Android and records screenshots/notes
    claim_label: Expo Go Device Eye Closed
primitives:
  - name: AppShell
    file: src/ui/AppShell.tsx
    variants: [tabbed, modal, detail]
  - name: TopBar
    file: src/ui/TopBar.tsx
    variants: [default, back, action, plot]
  - name: BottomTabBar
    file: src/ui/BottomTabBar.tsx
    variants: [today, plots, activity, cases, menu]
  - name: SectionHeader
    file: src/ui/SectionHeader.tsx
    variants: [default, compact, withAction]
  - name: StatusChip
    file: src/ui/StatusChip.tsx
    variants: [today, dueSoon, overdue, active, paid, unpaid, closed, archived, offline]
  - name: TrackerCard
    file: src/ui/TrackerCard.tsx
    variants: [spray, fertilizer, pruning, custom, overdue]
  - name: RecordListItem
    file: src/ui/RecordListItem.tsx
    variants: [activity, case, labor, material, hole]
  - name: EvidenceTimeline
    file: src/ui/EvidenceTimeline.tsx
    variants: [case, hole, activity]
  - name: FieldCard
    file: src/ui/FieldCard.tsx
    variants: [flat, raised, alert, summary]
  - name: PrimaryButton
    file: src/ui/PrimaryButton.tsx
    variants: [primary, secondary, tertiary, destructive]
patterns:
  - mobile-field-dashboard
  - evidence-timeline
  - activity-centered-domain
---

# TAKAI Mobile — DESIGN.md

## 1. Visual Theme & Atmosphere
TAKAI (`ตาไก๊ - เพื่อนชาวสวน`) is a local-first Android app for real garden work. The visual language should feel like a practical Thai orchard notebook assisted by an experienced gardener who remembers everything. It is calm, field-ready, evidence-first, and warm without becoming cute or decorative.

The design philosophy is: **record the field truth quickly, then make elapsed time, follow-ups, payments, materials, and evidence easy to read later.**

Use the ChatGPT visual seed at `/Users/non/Downloads/ChatGPT Image Jul 16, 2026, 02_01_58 PM.png` as the starting visual reference. The mockup shows the target direction: green primary actions, warm sand surfaces, dense mobile dashboards, tracker cards, vertical case timelines, bottom navigation, and bottle/photo evidence.

TAKAI is not:
- a marketing landing page;
- generic SaaS admin UI;
- an HR/payroll app;
- inventory software;
- a futuristic AI dashboard.

It is four connected field books:
- `สมุดสวน`: plots, holes, crops, activities, trackers;
- `สมุดเคส`: disease/problem timelines, photos, follow-ups, outcomes;
- `สมุดค่าแรง`: people, payable/non-payable work, unpaid/paid history, contract jobs;
- `สมุดวัสดุที่ใช้`: pesticide/fertilizer/material catalog, label photos, actual usage per activity.

## 2. Color Palette & Roles
The palette is green-led with warm sand surfaces and soil neutrals. Keep this direction first; tune contrast after real device checks.

| Token | Value | Role |
|-------|-------|------|
| `color.primary.green` | `#2E7D32` | Primary CTA, active tab, confirmed action, crop/plot identity |
| `color.primary.greenDark` | `#1B5E20` | Pressed primary state, high-emphasis headers |
| `color.primary.leaf` | `#66BB6A` | Progress bars, positive accents, secondary garden signal |
| `color.surface.sand` | `#F4E9D8` | App background, warm notebook base |
| `color.surface.card` | `#FFFDF7` | Cards, form groups, repeated records |
| `color.surface.muted` | `#F7F3EA` | Section bands, disabled low-emphasis areas |
| `color.soil.brown` | `#8D6E63` | Soil/plot metadata, neutral natural accent |
| `color.text.primary` | `#1F2D1F` | Main text |
| `color.text.muted` | `#607060` | Metadata, timestamps, secondary labels |
| `color.border.soft` | `#E6DED0` | Card borders, dividers |
| `color.state.success` | `#2E7D32` | Paid, closed successfully, active healthy state |
| `color.state.warning` | `#E5A935` | Due soon, waiting, attention |
| `color.state.danger` | `#D8432E` | Overdue, unpaid urgent, disease escalation |
| `color.state.info` | `#1976D2` | Archived, synced/exported informational state |
| `color.state.offline` | `#8D6E63` | Local/offline-only indicator |

Rules:
- Green is action and life, not decoration.
- Red is reserved for urgent/overdue/unpaid-danger states; do not use it for normal emphasis.
- Warm sand should be present but not wash out readability.
- Tracker progress bars use category color but keep labels textual so color is never the only signal.
- Avoid purple/blue gradient systems, glassmorphism, and decorative bokeh/orbs.

## 3. Typography
Target font:
- Thai/body: `Sarabun` or system fallback if unavailable.
- Numbers: tabular figures for dates, counts, amounts, doses, and elapsed days.
- Mono is not needed in the main UI.

Scale:
- H1 screen title: 28 / bold;
- H2 section title: 20 / bold;
- H3 card title: 17 / semibold;
- Body: 16 / regular;
- Metadata: 14 / regular or medium;
- Caption: 13 / regular;
- Minimum tappable label text: 13, only inside compact chips.

Rules:
- Do not scale font size with viewport width.
- Letter spacing is 0.
- Dates, amounts, and occurrence numbers must be easy to scan.
- Long Thai labels wrap instead of shrinking below readable size.
- Use bold sparingly for current value, amount, and screen title.

## 4. Component Stylings
Surfaces:
- App background is warm sand.
- Cards are white/warm white with 1px soft border and subtle shadow.
- Cards have 12px radius in this authored contract, even though future components may lower repeated-list radius if density requires it.
- Do not nest decorative cards inside cards. If grouping is needed inside a card, use dividers or section rows.

Buttons:
- Primary buttons are full-width green with white text and 44-48px minimum height.
- Secondary buttons are white cards with green or text-dark labels.
- Tertiary buttons are text/icon actions with minimal chrome.
- Destructive actions use danger border/text first; filled danger is only for irreversible confirmation.

Chips and status:
- Status chips are small rounded capsules with icon or strong text label.
- Required states: `วันนี้`, `ใกล้ครบกำหนด`, `เกินกำหนด`, `ติดตามอยู่`, `ปิดเคส`, `เก็บเข้าแฟ้ม`, `จ่ายแล้ว`, `ค้างจ่าย`, `ออฟไลน์`.
- Chips must include text; do not rely on color-only semantics.

Tracker cards:
- Show title, occurrence number, elapsed days, next due date when available, and progress bar.
- Keep stable height so different trackers do not jitter.
- Include both time language and count: `ครั้งที่ 5`, `ผ่านมา 4 วัน`, `ถัดไป 20 ก.ค.`.

Timeline:
- Case and hole history use a vertical line with date/day markers.
- Timeline entries show title, short note, optional thumbnail, and relative day.
- Visual evidence is part of the record, not decoration.

Materials:
- Material rows show bottle/label thumbnail, product name, group/category, default dosage, and last-used date.
- Activity material usage rows show actual amount and water/dilution for that activity.

Labor:
- Labor rows distinguish payable and non-payable work.
- Unpaid values are prominent but not alarmist unless overdue.
- Contract jobs are containers with status `กำลังทำ`, `รอคิดเงิน`, `จ่ายแล้ว`, or `ยกเลิก`.

## 5. Layout Principles
TAKAI is mobile-first and Android-first.

Navigation:
- Bottom nav has five primary entries:
  - `วันนี้`
  - `แปลง`
  - `บันทึก`
  - `เคส`
  - `เมนู`
- `ค่าแรง` and `วัสดุ` can be direct top-level menu items under `เมนู`, but may surface on Today when urgent/recent.
- The central `บันทึก` tab/action should be visually strong because Activity is the domain center.

Screen structure:
- Top bar: title, back/menu, optional action/avatar.
- Content: vertical sections with concise headers and action links.
- Primary action near top for daily capture.
- Repeated records use rows/cards with stable heights.
- Forms use numbered or sectioned chunks so long capture stays understandable.

Spacing:
- Page horizontal padding: 16.
- Section gap: 16.
- Card padding: 12-16.
- Row min height: 48.
- Touch target min height: 44.
- Bottom nav height: 64 plus safe area.

Dashboards:
- Today Dashboard prioritizes due/follow-up, overdue, tracker-near-due, unpaid, and recent cases.
- Plot Dashboard prioritizes crop context, plot counts, pinned trackers, active cases, and quick actions.
- Avoid huge hero panels; the first viewport must show operational data.

Forms:
- Activity Capture is broken into sections:
  1. category;
  2. target;
  3. detail/date/time;
  4. materials used;
  5. participants/labor;
  6. follow-up and photos.
- Inline add is allowed for materials and people but must stay lightweight.

## 6. Depth & Elevation
Use quiet depth:
- Base background: warm sand, flat.
- Cards: soft border + light shadow.
- Top bars: solid green for plot/detail emphasis, otherwise white/sand with border.
- Modals/sheets: raised with scrim; use for add material, add participant, mark paid, and close crop/case.
- Bottom nav: raised white tray with subtle shadow.

Avoid:
- heavy drop shadows;
- glass panes;
- decorative gradients;
- floating hero cards;
- 3D effects.

## 7. Do's & Don'ts
Do:
- Design around Activity as the shared center.
- Keep `หลุม` as the primary UI term.
- Always show dates and elapsed time where relevant.
- Show due/overdue/follow-up state with text plus color.
- Keep self-work visible in history but excluded from unpaid totals.
- Let contract jobs own final amount; do not force daily money for งานเหมา.
- Let materials be selected from catalog or added inline from a bottle photo.
- Preserve evidence and archive instead of deleting.
- Make local/offline state feel normal and reliable.

Don't:
- Do not make the app feel like generic SaaS or HR/payroll.
- Do not require login/cloud in v1.
- Do not turn materials into inventory or stock balance.
- Do not force all cases to close before crop close.
- Do not allow overlapping crop ranges in the same plot.
- Do not hide important operational state behind decorative pages.
- Do not use tiny metadata that cannot be read outdoors.
- Do not make color the only state signal.
- Do not use nested card layouts.

## 8. Responsive Behavior
Primary target:
- Android phone portrait.

Safe area:
- Top bars and bottom nav must respect safe-area and status/navigation bars.
- No button should sit under system UI.

Touch:
- Minimum touch target is 44px.
- Primary actions and row affordances should target 48px where possible.
- Outdoor use favors larger controls over dense tiny tap areas.

Scrolling:
- Dashboards scroll vertically.
- Forms scroll with sticky/save affordance if long.
- Bottom nav remains available except inside focused modal/form flows.

Images:
- Photo thumbnails use stable aspect ratios.
- Case evidence thumbnails should not shift timeline row height after load.
- Material label photos should crop predictably and open full-screen detail.

Device truth:
- `rn-static-eye` can check tokens and primitives.
- `expo-go-device-eye` is required before claiming Android field usability.

## 9. Agent Prompt Guide
> Build TAKAI as a local-first Android garden companion, not a SaaS dashboard. Start every UI decision from real field use: today, plot, activity, case, labor, materials, and hole history. Use green action states, warm sand surfaces, readable Thai typography, stable tracker cards, status chips with text, and evidence timelines. Preserve history, support archive/close over delete, and keep Activity as the center that connects crops, cases, labor, and materials. Do not introduce login, cloud, inventory, payroll, or decorative marketing UI in v1.

## Primitives (reuse-first)
These primitives are authored targets for Phase 1 scaffold. They do not exist yet in Phase 0A and must be created before `/design-verify` can close `rn-static-eye`.

| Primitive | File | Variants |
|-----------|------|----------|
| AppShell | `src/ui/AppShell.tsx` | `tabbed`, `modal`, `detail` |
| TopBar | `src/ui/TopBar.tsx` | `default`, `back`, `action`, `plot` |
| BottomTabBar | `src/ui/BottomTabBar.tsx` | `today`, `plots`, `activity`, `cases`, `menu` |
| SectionHeader | `src/ui/SectionHeader.tsx` | `default`, `compact`, `withAction` |
| StatusChip | `src/ui/StatusChip.tsx` | `today`, `dueSoon`, `overdue`, `active`, `paid`, `unpaid`, `closed`, `archived`, `offline` |
| TrackerCard | `src/ui/TrackerCard.tsx` | `spray`, `fertilizer`, `pruning`, `custom`, `overdue` |
| RecordListItem | `src/ui/RecordListItem.tsx` | `activity`, `case`, `labor`, `material`, `hole` |
| EvidenceTimeline | `src/ui/EvidenceTimeline.tsx` | `case`, `hole`, `activity` |
| FieldCard | `src/ui/FieldCard.tsx` | `flat`, `raised`, `alert`, `summary` |
| PrimaryButton | `src/ui/PrimaryButton.tsx` | `primary`, `secondary`, `tertiary`, `destructive` |

## Design Brain Links
- [[mobile-field-dashboard]]
- [[evidence-timeline]]
- [[activity-centered-domain]]

## Screen Inventory
Required first-class screens:
- Today Dashboard;
- Plot List;
- Plot Dashboard;
- Crop Detail and Close Crop flow;
- Hole Detail;
- Activity Capture;
- Activity Detail;
- Case List;
- Case Timeline;
- Labor Ledger;
- Unpaid Payment Flow;
- Contract Job Detail;
- Materials Library;
- Material Detail;
- Menu/Settings.

## State Grammar
Use the same state names in code and UI:
- `today`: due today;
- `dueSoon`: due within configured near window;
- `overdue`: past due;
- `active`: current crop/case/tracker state;
- `closed`: completed case/crop;
- `archived`: preserved but hidden from active views;
- `paid`: labor/payment settled;
- `unpaid`: payable and not settled;
- `void`: not counted/cancelled;
- `offline`: local-only or waiting for future sync;
- `draft`: incomplete form or local pending record.

## Mockup-Derived Screen Notes
Today Dashboard:
- Top primary `+ บันทึกวันนี้`.
- Due today, overdue, near due, unpaid, and recent cases are stacked in that order.
- Keep compact cards; each row should show target, state, and due/elapsed label.

Plot Dashboard:
- Crop card shows active crop, start date, area, holes, active/dead/empty counts.
- Pinned trackers show occurrence, elapsed days, next due, and progress.
- Active cases list appears below trackers.

Activity Capture:
- Step sections mirror the mockup: category, target, details/date/time, materials, participants/labor, follow-up/photos.
- Save/check action in top-right is acceptable only if form validation is visible.

Case Timeline:
- Use vertical timeline with day labels and evidence thumbnails.
- Close/archive actions stay near bottom after outcome summary.

Labor Ledger:
- Today, unpaid, and history tabs.
- Unpaid grouped by person.
- Payment amount and status are right-aligned.

Materials Library:
- Search and category chips.
- Rows show thumbnail, name, default dose, and last-used date.
- Add material CTA mentions photo/label capture.

Hole Detail:
- Header shows hole marker, current planting, planted date, age, and image.
- Timeline includes activities/cases/material usage attached to this hole.

## Mascot and Assets
คุณนนท์ will provide the TAKAI mascot assets later.

Expected placement after scaffold:
- `assets/brand/takai-mascot.png` for app/about/header use;
- `assets/brand/takai-icon.png` if a square app icon variant is provided;
- `assets/brand/takai-adaptive-foreground.png` for Android adaptive icon foreground if available.

Use mascot sparingly:
- app onboarding/about;
- small header avatar;
- empty states.

Do not make the mascot consume primary operational space on dashboards.

## Known Drift
- This is an authored DESIGN.md from a mockup/brief. No React Native code, tokens, or primitives exist yet.
- `verify_tokens` are target values to build in Phase 1, not extracted code truth.
- `rn-static-eye` is pending until `src/theme/tokens.ts` and primitive files exist.
- `expo-go-device-eye` is pending until an Android Expo Go/device proof is collected.
- Palette is intentionally green/warm-sand from the mockup; contrast may be tuned after Android device review.
