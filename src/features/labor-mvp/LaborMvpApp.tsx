import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { initializeTakaiLaborPreview } from '../../data';
import { tokens } from '../../theme/tokens';
import { AppShell, FieldCard, PrimaryButton, SectionHeader, StatusChip, TopBar, type BottomTabKey } from '../../ui';
import type { LaborCalendarDaySummary, LaborHistory, LaborJobDetail, LaborMvpReadModel, LaborPersonDetail, LaborProjectionEvent, LaborProjectionEventType, LaborTodaySummary } from './types';
import type { LaborPreviewAdapter } from './preview';

type MainScreen = 'today' | 'work' | 'record' | 'people' | 'more';
type Screen = { kind: 'main'; tab: MainScreen } | { kind: 'job'; id: string } | { kind: 'person'; id: string };
type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; adapter: LaborPreviewAdapter; model: LaborMvpReadModel; today: LaborTodaySummary; calendar: LaborCalendarDaySummary[]; history: LaborHistory };

const PREVIEW_DATE = '2026-08-02';
const MONTH_START = '2026-08-01';
const MONTH_END = '2026-08-31';
const tabTitles: Record<MainScreen, string> = { today: 'วันนี้', work: 'งาน', record: 'บันทึกงาน', people: 'คน', more: 'เมนู' };
const eventLabels: Record<LaborProjectionEventType, string> = {
  work: 'งาน', contract_start: 'เริ่มงานเหมา', contract_progress: 'ความคืบหน้า', contract_completion: 'จบงานเหมา', contract_deadline: 'ครบกำหนด',
  individual_payment: 'จ่ายค่าแรง', group_receipt: 'รับเงินชุดงาน', advance: 'เงินเบิก', advance_recovery: 'หักคืนเงินเบิก',
};

const thaiDate = (date: string, includeYear = false): string => new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' } : {}),
}).format(new Date(`${date}T12:00:00`));
const money = (satang: number): string => `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(satang / 100)} บาท`;
const shortMoney = (satang: number): string => `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(satang / 100)} บ.`;
const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

export function LaborMvpApp() {
  const [screen, setScreen] = useState<Screen>({ kind: 'main', tab: 'today' });
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });
  const [selectedDate, setSelectedDate] = useState(PREVIEW_DATE);
  const [workMode, setWorkMode] = useState<'calendar' | 'history'>('calendar');
  const [recordDate, setRecordDate] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const adapter = await initializeTakaiLaborPreview();
        const [model, today, range, history] = await Promise.all([
          adapter.getReadModel(), adapter.getTodaySummary(PREVIEW_DATE), adapter.getCalendarRange({ startDate: MONTH_START, endDate: MONTH_END }), adapter.getHistory({ startDate: MONTH_START, endDate: MONTH_END }),
        ]);
        if (mounted) setPreview({ status: 'ready', adapter, model, today, calendar: range.days, history });
      } catch (error) {
        if (mounted) setPreview({ status: 'error', message: error instanceof Error ? error.message : 'เปิดข้อมูล Labor Preview ไม่สำเร็จ' });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const activeTab: BottomTabKey = screen.kind === 'main' ? screen.tab : 'work';
  const openTab = (tab: BottomTabKey) => setScreen({ kind: 'main', tab });
  const openJob = (id: string) => setScreen({ kind: 'job', id });
  const openPerson = (id: string) => setScreen({ kind: 'person', id });
  const startRecord = (date: string) => { setRecordDate(date); setScreen({ kind: 'main', tab: 'record' }); };
  const changeMonth = (delta: number) => {
    if (preview.status !== 'ready') return;
    const current = new Date(`${preview.calendar[0]?.date ?? MONTH_START}T12:00:00`);
    const first = new Date(current.getFullYear(), current.getMonth() + delta, 1, 12);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
    const startDate = first.toISOString().slice(0, 10);
    const endDate = last.toISOString().slice(0, 10);
    void Promise.all([preview.adapter.getCalendarRange({ startDate, endDate }), preview.adapter.getHistory({ startDate, endDate })]).then(([range, history]) => {
      setSelectedDate(startDate);
      setPreview({ ...preview, calendar: range.days, history });
    });
  };

  return (
    <AppShell activeTab={activeTab} onTabPress={openTab} showTabs={screen.kind === 'main'} variant={screen.kind === 'main' ? 'tabbed' : 'detail'}>
      <TopBar
        title={screen.kind === 'main' ? tabTitles[screen.tab] : screen.kind === 'job' ? 'รายละเอียดงาน' : 'ข้อมูลคนทำงาน'}
        actionLabel={screen.kind === 'main' ? 'Labor MVP' : undefined}
        variant={screen.kind === 'main' ? 'default' : 'back'}
        onBackPress={() => setScreen({ kind: 'main', tab: screen.kind === 'job' ? 'work' : 'people' })}
      />
      {preview.status === 'loading' ? <Loading /> : null}
      {preview.status === 'error' ? <FieldCard variant="alert"><Text style={styles.title}>เปิดข้อมูลไม่สำเร็จ</Text><Text style={styles.muted}>{preview.message}</Text></FieldCard> : null}
      {preview.status === 'ready' ? (
        <>
          <StatusChip label={preview.adapter.label} variant="offline" />
          {screen.kind === 'main' && screen.tab === 'today' ? <TodayScreen today={preview.today} onJob={openJob} onPerson={openPerson} onRecord={() => startRecord(preview.today.date)} /> : null}
          {screen.kind === 'main' && screen.tab === 'work' ? (
            <WorkScreen calendar={preview.calendar} history={preview.history} mode={workMode} onChangeMode={setWorkMode} onJob={openJob} onPerson={openPerson} onRecord={startRecord} selectedDate={selectedDate} onSelectDate={setSelectedDate} onMonth={changeMonth} />
          ) : null}
          {screen.kind === 'main' && screen.tab === 'record' ? <RecordPlaceholder date={recordDate ?? preview.today.date} onBack={() => setScreen({ kind: 'main', tab: 'work' })} /> : null}
          {screen.kind === 'main' && screen.tab === 'people' ? <PeopleScreen model={preview.model} onPerson={openPerson} /> : null}
          {screen.kind === 'main' && screen.tab === 'more' ? <MoreScreen /> : null}
          {screen.kind === 'job' ? <JobScreen adapter={preview.adapter} jobId={screen.id} onPerson={openPerson} /> : null}
          {screen.kind === 'person' ? <PersonScreen adapter={preview.adapter} personId={screen.id} onJob={openJob} /> : null}
        </>
      ) : null}
    </AppShell>
  );
}

function Loading() { return <View style={styles.loading}><ActivityIndicator color={tokens.color.primary.green} /><Text style={styles.muted}>กำลังเตรียมสมุดงานค่าแรง…</Text></View>; }

function TodayScreen({ today, onJob, onPerson, onRecord }: { today: LaborTodaySummary; onJob: (id: string) => void; onPerson: (id: string) => void; onRecord: () => void }) {
  return <>
    <FieldCard variant="raised"><Text style={styles.eyebrow}>{thaiDate(today.date, true)} · ภาพรวมงานและเงิน</Text><Text style={styles.title}>วันนี้มีงาน {today.day.workCount} รายการ</Text><Text style={styles.muted}>ยอดงาน {money(today.day.workDueSatang)} · เงินออก/รับวันนี้ {money(today.day.individualPaymentSatang + today.day.groupReceiptSatang)}</Text></FieldCard>
    <AmountStrip items={[['งานวันนี้', today.day.workDueSatang], ['จ่ายค่าแรง', today.day.individualPaymentSatang], ['รับชุดงาน', today.day.groupReceiptSatang]]} />
    <SectionHeader title="งานและเหตุการณ์วันนี้" />
    {today.day.events.length ? today.day.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />) : <Empty label="ยังไม่มีงานหรือรายการเงินในวันนี้" />}
    <Attention title="ค้างค่าแรง" people={today.unpaidPeople.filter((person) => person.wageRemainingSatang > 0)} amount={(person) => person.wageRemainingSatang} onPerson={onPerson} empty="วันนี้ไม่มีค่าแรงค้างในตัวอย่าง" />
    <Attention title="เงินเบิกคงเหลือ" people={today.advanceAttentionPeople} amount={(person) => person.advanceRemainingSatang} onPerson={onPerson} empty="ไม่มีเงินเบิกคงเหลือ" />
    <PrimaryButton label="+ บันทึกงานวันนี้" onPress={onRecord} />
  </>;
}

function WorkScreen({ calendar, history, mode, onChangeMode, selectedDate, onSelectDate, onJob, onPerson, onRecord, onMonth }: { calendar: LaborCalendarDaySummary[]; history: LaborHistory; mode: 'calendar' | 'history'; onChangeMode: (mode: 'calendar' | 'history') => void; selectedDate: string; onSelectDate: (date: string) => void; onJob: (id: string) => void; onPerson: (id: string) => void; onRecord: (date: string) => void; onMonth: (delta: number) => void }) {
  const selectedDay = calendar.find((day) => day.date === selectedDate) ?? { date: selectedDate, events: [], workCount: 0, workDueSatang: 0, individualPaymentSatang: 0, groupReceiptSatang: 0, advanceIssuedSatang: 0, advanceRecoveredSatang: 0, contractProgressCount: 0, contractCompletionCount: 0, contractDeadlineCount: 0 };
  return <>
    <View style={styles.segment}><Segment label="ปฏิทิน" active={mode === 'calendar'} onPress={() => onChangeMode('calendar')} /><Segment label="ประวัติ" active={mode === 'history'} onPress={() => onChangeMode('history')} /></View>
    {mode === 'calendar' ? <CalendarScreen days={calendar} selected={selectedDate} onSelect={onSelectDate} day={selectedDay} onJob={onJob} onPerson={onPerson} onRecord={onRecord} onMonth={onMonth} /> : <HistoryScreen history={history} onJob={onJob} onPerson={onPerson} />}
  </>;
}

function CalendarScreen({ days, selected, onSelect, day, onJob, onPerson, onRecord, onMonth }: { days: LaborCalendarDaySummary[]; selected: string; onSelect: (date: string) => void; day: LaborCalendarDaySummary; onJob: (id: string) => void; onPerson: (id: string) => void; onRecord: (date: string) => void; onMonth: (delta: number) => void }) {
  const firstDate = days[0]?.date ?? selected;
  const padding = Array.from({ length: new Date(`${firstDate}T12:00:00`).getDay() }, (_, index) => `pad-${index}`);
  return <>
    <FieldCard variant="raised"><View style={styles.monthHeader}><Pressable accessibilityLabel="เดือนก่อน" onPress={() => onMonth(-1)} style={styles.monthNav}><Text style={styles.monthNavText}>‹</Text></Pressable><View style={styles.monthTitle}><Text style={styles.title}>{new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(new Date(`${firstDate}T12:00:00`))}</Text><Text style={styles.caption}>ปฏิทินงาน</Text></View><Pressable accessibilityLabel="เดือนถัดไป" onPress={() => onMonth(1)} style={styles.monthNav}><Text style={styles.monthNavText}>›</Text></Pressable></View><View style={styles.week}>{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((label) => <Text key={label} style={styles.weekday}>{label}</Text>)}</View><View style={styles.grid}>{padding.map((key) => <View key={key} style={styles.blankCell} />)}{days.map((item) => <CalendarCell key={item.date} day={item} selected={item.date === selected} onPress={() => onSelect(item.date)} />)}</View></FieldCard>
    <Text style={styles.caption}>จุดเขียว = งาน · จุดน้ำตาล = เงิน · กดวันที่เพื่อดูรายละเอียด</Text>
    <SectionHeader title={`${thaiDate(day.date, true)} · รายการวันนั้น`} />
    <AmountStrip items={[['งาน', day.workDueSatang], ['จ่ายค่าแรง', day.individualPaymentSatang], ['รับชุดงาน', day.groupReceiptSatang]]} />
    {day.events.length ? day.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />) : <Empty label="ยังไม่มีรายการในวันที่เลือก" />}
    <PrimaryButton label={`+ บันทึกงานวันที่ ${thaiDate(day.date)}`} onPress={() => onRecord(day.date)} />
  </>;
}

function CalendarCell({ day, selected, onPress }: { day: LaborCalendarDaySummary; selected: boolean; onPress: () => void }) {
  const work = day.workCount > 0; const finance = day.individualPaymentSatang + day.groupReceiptSatang + day.advanceIssuedSatang + day.advanceRecoveredSatang > 0;
  return <Pressable accessibilityLabel={`${thaiDate(day.date)}${work ? ` มีงาน ${day.workCount} รายการ` : ''}`} onPress={onPress} style={[styles.calendarCell, selected && styles.calendarSelected]}><Text style={[styles.dayNumber, selected && styles.selectedText]}>{Number(day.date.slice(-2))}</Text><View style={styles.markerLine}>{work ? <View style={styles.workMarker} /> : null}{finance ? <View style={styles.moneyMarker} /> : null}</View>{(work || finance) ? <Text numberOfLines={1} style={[styles.markerText, selected && styles.selectedText]}>{work ? `งาน${day.workCount}` : 'เงิน'}</Text> : null}</Pressable>;
}

function HistoryScreen({ history, onJob, onPerson }: { history: LaborHistory; onJob: (id: string) => void; onPerson: (id: string) => void }) {
  const [range, setRange] = useState<'today' | 'two' | 'seven' | 'month'>('month');
  const [person, setPerson] = useState<string>('ทั้งหมด');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'group'>('all');
  const [type, setType] = useState<'all' | 'work' | 'finance'>('all');
  const [keyword, setKeyword] = useState('');
  const rangeStart = range === 'today' ? PREVIEW_DATE : range === 'two' ? addDays(PREVIEW_DATE, -2) : range === 'seven' ? addDays(PREVIEW_DATE, -6) : MONTH_START;
  const events = history.events.filter((event) => event.effectiveDate >= rangeStart && (person === 'ทั้งหมด' || event.personIds.includes(person) || event.personId === person) && (filter !== 'group' || event.settlementRoute === 'group') && (filter !== 'unpaid' || event.paymentState === 'unpaid' || event.paymentState === 'partial') && (type === 'all' || (type === 'work' ? ['work', 'contract_start', 'contract_progress', 'contract_completion'].includes(event.eventType) : ['individual_payment', 'group_receipt', 'advance', 'advance_recovery'].includes(event.eventType))) && (!keyword.trim() || `${event.label} ${event.detail}`.toLocaleLowerCase('th-TH').includes(keyword.trim().toLocaleLowerCase('th-TH'))));
  const byDate = events.reduce<Record<string, LaborProjectionEvent[]>>((groups, event) => ({ ...groups, [event.effectiveDate]: [...(groups[event.effectiveDate] ?? []), event] }), {});
  return <>
    <FieldCard><Text style={styles.formLabel}>ค้นหารายการ</Text><TextInput accessibilityLabel="ค้นหารายการ" placeholder="ชื่องาน หรือ ชื่อคนงาน" placeholderTextColor={tokens.color.text.muted} style={styles.search} value={keyword} onChangeText={setKeyword} /></FieldCard>
    <ChipRow>{([['today', 'วันนี้'], ['two', '2 วันก่อน'], ['seven', '7 วัน'], ['month', 'เดือนนี้']] as const).map(([key, label]) => <FilterChip key={key} label={label} active={range === key} onPress={() => setRange(key)} />)}</ChipRow>
    <ChipRow><FilterChip label="ทั้งหมด" active={person === 'ทั้งหมด'} onPress={() => setPerson('ทั้งหมด')} /><FilterChip label="พี่สุ" active={person === 'labor-preview-suda'} onPress={() => setPerson('labor-preview-suda')} /><FilterChip label="พี่พวง" active={person === 'labor-preview-phuang'} onPress={() => setPerson('labor-preview-phuang')} /><FilterChip label="น้าชล" active={person === 'labor-preview-chon'} onPress={() => setPerson('labor-preview-chon')} /></ChipRow>
    <ChipRow><FilterChip label="ทุกสถานะ" active={filter === 'all'} onPress={() => setFilter('all')} /><FilterChip label="ค้างจ่าย" active={filter === 'unpaid'} onPress={() => setFilter('unpaid')} /><FilterChip label="ชุดรับเงิน" active={filter === 'group'} onPress={() => setFilter('group')} /></ChipRow>
    <ChipRow><FilterChip label="ทุกประเภท" active={type === 'all'} onPress={() => setType('all')} /><FilterChip label="งาน" active={type === 'work'} onPress={() => setType('work')} /><FilterChip label="การเงิน" active={type === 'finance'} onPress={() => setType('finance')} /></ChipRow>
    <SectionHeader title={`ประวัติ ${events.length} รายการ`} />
    {events.length ? Object.entries(byDate).sort(([left], [right]) => right.localeCompare(left)).map(([date, grouped]) => <View key={date} style={styles.historyGroup}><Text style={styles.groupDate}>{thaiDate(date, true)}</Text>{grouped.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />)}</View>) : <Empty label="ไม่พบรายการตามตัวกรองนี้" />}
  </>;
}

function PeopleScreen({ model, onPerson }: { model: LaborMvpReadModel; onPerson: (id: string) => void }) { return <>
  <FieldCard variant="raised"><Text style={styles.eyebrow}>คนทำงาน</Text><Text style={styles.title}>{model.people.length} คนในสมุดงาน</Text><Text style={styles.muted}>ยอดค่าแรงและเงินเบิกแยกกันเสมอ</Text></FieldCard>
  <SectionHeader title="รายชื่อคนทำงาน" />
  {model.people.map((person) => <Pressable key={person.id} onPress={() => onPerson(person.id)} style={styles.personRow}><View style={styles.avatar}><Text style={styles.avatarText}>{person.displayName.slice(0, 1)}</Text></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{person.displayName}</Text><Text numberOfLines={1} style={styles.rowMeta}>{person.specialty || 'ยังไม่ได้ระบุงานที่ถนัด'}</Text></View><View style={styles.trailing}><Text style={styles.money}>{person.wageRemainingSatang ? `ค้าง ${shortMoney(person.wageRemainingSatang)}` : 'ค่าแรงครบ'}</Text><Text style={styles.rowMeta}>{person.advanceRemainingSatang ? `เบิกคงเหลือ ${shortMoney(person.advanceRemainingSatang)}` : 'ไม่มีเงินเบิกคงเหลือ'}</Text></View></Pressable>)}
  </>; }

function JobScreen({ adapter, jobId, onPerson }: { adapter: LaborPreviewAdapter; jobId: string; onPerson: (id: string) => void }) { const [detail, setDetail] = useState<LaborJobDetail | null | undefined>(undefined); useEffect(() => { void adapter.getJobDetail(jobId).then(setDetail); }, [adapter, jobId]); if (detail === undefined) return <Loading />; if (!detail) return <Empty label="ไม่พบงานนี้" />; return <>
  <FieldCard variant="raised"><StatusChip label={detail.settlementRoute === 'group' ? 'ชุดรับเงิน' : 'จ่ายรายคน'} variant="active" /><Text style={styles.title}>{detail.title}</Text><Text style={styles.muted}>วันที่ทำงาน {thaiDate(detail.workDate, true)}</Text>{detail.note ? <Text style={styles.caption}>{detail.note}</Text> : null}</FieldCard>
  <AmountStrip items={[['ยอดงาน', detail.dueSatang], ['เงินสดจ่าย/รับ', detail.cashPaidSatang], ['คงเหลือ', detail.remainingSatang]]} />
  <SectionHeader title="คนทำงาน" />{detail.participants.map((person) => <Pressable key={person.personId} style={styles.personCompact} onPress={() => onPerson(person.personId)}><Text style={styles.rowTitle}>{person.displayName}</Text><Text style={styles.rowMeta}>{basisLabel(person.payType)}</Text></Pressable>)}
  {detail.settlementGroup ? <FieldCard><Text style={styles.formLabel}>ชุดรับเงิน</Text><Text style={styles.rowTitle}>{detail.settlementGroup.collectorLabel || 'ยังไม่ได้ระบุผู้รับเงินสดแทน'}</Text><Text style={styles.muted}>รับแล้ว {money(detail.settlementGroup.paidSatang)} · คงเหลือ {money(detail.settlementGroup.remainingSatang)}</Text></FieldCard> : null}
  {detail.contract ? <FieldCard><Text style={styles.formLabel}>งานเหมา</Text><Text style={styles.muted}>เริ่ม {detail.contract.startsOn ? thaiDate(detail.contract.startsOn) : '—'} · กำหนด {detail.contract.deadlineOn ? thaiDate(detail.contract.deadlineOn) : 'ไม่จำกัด'}</Text></FieldCard> : null}
  <SectionHeader title="ประวัติของงาน" />{detail.events.map((event) => <LaborRow key={event.id} event={event} onJob={() => undefined} onPerson={onPerson} />)}
  <PrimaryButton label="การจ่ายเงินจะเปิดในขั้นถัดไป" disabled />
  </>; }

function PersonScreen({ adapter, personId, onJob }: { adapter: LaborPreviewAdapter; personId: string; onJob: (id: string) => void }) { const [detail, setDetail] = useState<LaborPersonDetail | null | undefined>(undefined); useEffect(() => { void adapter.getPersonDetail(personId).then(setDetail); }, [adapter, personId]); if (detail === undefined) return <Loading />; if (!detail) return <Empty label="ไม่พบคนทำงานนี้" />; const { person } = detail; return <>
  <FieldCard variant="raised"><Text style={styles.eyebrow}>คนทำงาน</Text><Text style={styles.title}>{person.displayName}</Text><Text style={styles.muted}>{person.specialty || 'ยังไม่ได้ระบุงานที่ถนัด'}</Text></FieldCard>
  <SectionHeader title="ค่าแรง" /><AmountStrip items={[['ค่าแรงรวม', person.grossEarnedSatang], ['จ่ายแล้ว', person.cashPaidSatang], ['ค้างค่าแรง', person.wageRemainingSatang]]} />
  <SectionHeader title="เงินเบิก" /><AmountStrip items={[['เบิกแล้ว', person.advanceIssuedSatang], ['หักคืนแล้ว', person.advanceRecoveredSatang], ['เบิกคงเหลือ', person.advanceRemainingSatang]]} />
  <SectionHeader title="ประวัติ" />{detail.events.length ? detail.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={() => undefined} />) : <Empty label="ยังไม่มีประวัติ" />}
  <PrimaryButton label="จ่ายเงิน / เงินเบิก จะเปิดในขั้นถัดไป" disabled />
  </>; }

function RecordPlaceholder({ date, onBack }: { date: string; onBack: () => void }) { return <FieldCard variant="raised"><Text style={styles.eyebrow}>PREFILL INTENT</Text><Text style={styles.title}>บันทึกงานวันที่ {thaiDate(date, true)}</Text><Text style={styles.muted}>เลือกวันจากปฏิทินแล้ว วันที่ทำงานจะถูกส่งต่อมาที่ฟอร์มนี้ โดยยังไม่สร้าง record ใด ๆ จนกว่าจะถึง Phase 4</Text><PrimaryButton label="กลับไปดูปฏิทิน" variant="secondary" onPress={onBack} /></FieldCard>; }
function MoreScreen() { return <><FieldCard variant="raised"><Text style={styles.eyebrow}>LABOR MVP</Text><Text style={styles.title}>เมนูรอง</Text><Text style={styles.muted}>การตั้งค่าและรายการเพิ่มเติมจะกลับมาโดยไม่พาไปหน้า Activity หรือแปลงเดิม</Text></FieldCard><FieldCard><Text style={styles.rowTitle}>ข้อมูลตัวอย่าง Labor Preview</Text><Text style={styles.muted}>ข้อมูลนี้สร้างผ่าน Labor ledger และใช้เพื่อทดสอบการอ่านบน web เท่านั้น</Text></FieldCard></>; }
function Attention({ title, people, amount, onPerson, empty }: { title: string; people: LaborMvpReadModel['people']; amount: (person: LaborMvpReadModel['people'][number]) => number; onPerson: (id: string) => void; empty: string }) { return <><SectionHeader title={title} />{people.length ? people.map((person) => <Pressable key={person.id} onPress={() => onPerson(person.id)} style={styles.attention}><Text style={styles.rowTitle}>{person.displayName}</Text><Text style={styles.money}>{money(amount(person))}</Text></Pressable>) : <Text style={styles.caption}>{empty}</Text>}</>; }
function LaborRow({ event, onJob, onPerson }: { event: LaborProjectionEvent; onJob: (id: string) => void; onPerson: (id: string) => void }) { const press = event.jobId ? () => onJob(event.jobId!) : event.personId ? () => onPerson(event.personId!) : undefined; const amount = event.amountSatang || event.dueSatang; return <Pressable disabled={!press} onPress={press} style={styles.laborRow}><View style={[styles.eventDot, event.eventType === 'work' ? styles.workMarker : styles.moneyMarker]} /><View style={styles.rowMain}><Text numberOfLines={1} style={styles.rowTitle}>{event.label}</Text><Text numberOfLines={2} style={styles.rowMeta}>{[thaiDate(event.effectiveDate), event.detail, event.eventType === 'group_receipt' ? 'ไม่ใช่ค่าแรงรายคน' : ''].filter(Boolean).join(' · ')}</Text></View><View style={styles.trailing}><StatusChip label={eventLabels[event.eventType]} variant={event.paymentState === 'unpaid' ? 'unpaid' : event.eventType === 'advance' ? 'dueSoon' : 'paid'} />{amount ? <Text style={styles.money}>{money(amount)}</Text> : null}</View></Pressable>; }
function AmountStrip({ items }: { items: Array<[string, number]> }) { return <View style={styles.amountStrip}>{items.map(([label, value]) => <FieldCard key={label} variant="summary" style={styles.amountCard}><Text numberOfLines={1} style={styles.caption}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>{shortMoney(value)}</Text></FieldCard>)}</View>; }
function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.segmentItem, active && styles.segmentActive]}><Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text></Pressable>; }
function ChipRow({ children }: { children: React.ReactNode }) { return <View style={styles.chipRow}>{children}</View>; }
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text></Pressable>; }
function Empty({ label }: { label: string }) { return <FieldCard><Text style={styles.muted}>{label}</Text></FieldCard>; }
function basisLabel(payType: string): string { return ({ daily: 'รายวัน', hourly: 'รายชั่วโมง', piece: 'รายชิ้น', contract: 'งานเหมา' } as Record<string, string>)[payType] ?? 'ผู้ร่วมงาน'; }

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 48 }, eyebrow: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontWeight: '700' }, title: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '700', marginTop: 6 }, muted: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23, marginTop: 8 }, caption: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 18 },
  amountStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', width: '100%' }, amountCard: { flexGrow: 0, flexShrink: 1, minWidth: 0, padding: 10, width: '31.8%' }, amount: { color: tokens.color.text.primary, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 5 },
  segment: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, flexDirection: 'row', padding: 4 }, segmentItem: { alignItems: 'center', borderRadius: tokens.radius.button, flex: 1, minHeight: 42, justifyContent: 'center' }, segmentActive: { backgroundColor: '#EAF4EA' }, segmentLabel: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, fontWeight: '700' }, segmentLabelActive: { color: tokens.color.primary.green },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, monthTitle: { alignItems: 'center', flex: 1 }, monthNav: { alignItems: 'center', justifyContent: 'center', minHeight: 44, width: 44 }, monthNavText: { color: tokens.color.primary.green, fontSize: 30, lineHeight: 32 }, week: { flexDirection: 'row' }, weekday: { color: tokens.color.text.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: '14.2857%' }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, blankCell: { height: 60, width: '14.2857%' }, calendarCell: { borderColor: tokens.color.border.soft, borderRadius: 8, borderWidth: 1, height: 60, padding: 4, width: '14.2857%' }, calendarSelected: { backgroundColor: tokens.color.primary.green, borderColor: tokens.color.primary.green }, dayNumber: { color: tokens.color.text.primary, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' }, selectedText: { color: tokens.color.text.inverse }, markerLine: { flexDirection: 'row', gap: 3, marginTop: 4 }, workMarker: { backgroundColor: tokens.color.primary.green, borderRadius: 3, height: 6, width: 6 }, moneyMarker: { backgroundColor: tokens.color.soil.brown, borderRadius: 3, height: 6, width: 6 }, markerText: { color: tokens.color.text.muted, fontSize: 9, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterChip: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.chip, borderWidth: 1, minHeight: 38, paddingHorizontal: 12, justifyContent: 'center' }, filterChipActive: { backgroundColor: '#EAF4EA', borderColor: tokens.color.primary.green }, filterLabel: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, fontWeight: '700' }, filterLabelActive: { color: tokens.color.primary.green }, formLabel: { color: tokens.color.text.primary, fontSize: tokens.typography.caption.size, fontWeight: '700' }, search: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, marginTop: 6, minHeight: 40, paddingVertical: 6 },
  laborRow: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 64, paddingVertical: 8 }, eventDot: { borderRadius: 5, height: 10, marginLeft: 4, width: 10 }, rowMain: { flex: 1, minWidth: 0 }, rowTitle: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, fontWeight: '700' }, rowMeta: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 17, marginTop: 2 }, trailing: { alignItems: 'flex-end', flexShrink: 0, gap: 4, maxWidth: 112 }, money: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontVariant: ['tabular-nums'], fontWeight: '700', textAlign: 'right' },
  historyGroup: { gap: 2 }, groupDate: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, fontWeight: '700', paddingTop: 6 }, attention: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 12 }, personRow: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 70, paddingVertical: 8 }, avatar: { alignItems: 'center', backgroundColor: '#EAF4EA', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, avatarText: { color: tokens.color.primary.green, fontSize: tokens.typography.body.size, fontWeight: '700' }, personCompact: { backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, minHeight: 52, padding: 10 },
});
