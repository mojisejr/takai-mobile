import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { initializeTakaiLaborNotebook } from '../../data';
import { tokens } from '../../theme/tokens';
import { ActionEmptyState, AppShell, ConfirmActionSheet, DatePickerField, FeedbackToast, FieldCard, FormFeedback, LedgerListCard, LedgerListRow, LedgerRowText, LedgerTrailing, PickerField, PrimaryButton, ScreenSkeleton, SearchPickerSheet, SectionHeader, StatusChip, TakaiMascot, TopBar, type BottomTabKey } from '../../ui';
import type { LaborCalendarDaySummary, LaborHistory, LaborJobDetail, LaborMvpReadModel, LaborPersonDetail, LaborProjectionEvent, LaborProjectionEventType, LaborTodaySummary, LaborWorker } from './types';
import type { LaborPreviewAdapter } from './preview';
import { createSingleCommitCoordinator, eligibleCorrectionTargets, requireCorrectionTarget, workerDraftError, type CorrectionTarget } from './peopleMoneyFlow';
import { selectLaborWebProofVisual } from './webProofVisual';

type MainScreen = 'today' | 'work' | 'record' | 'people' | 'more';
type Screen = { kind: 'main'; tab: MainScreen } | { kind: 'job'; id: string } | { kind: 'person'; id: string } | { kind: 'worker'; id: string | null };
type RecordAction = 'job' | 'payment' | 'receipt' | 'advance' | 'recovery' | 'correction';
type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; adapter: LaborPreviewAdapter; model: LaborMvpReadModel; today: LaborTodaySummary; calendar: LaborCalendarDaySummary[]; history: LaborHistory };

const localDate = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const PREVIEW_DATE = localDate();
const MONTH_START = `${PREVIEW_DATE.slice(0, 8)}01`;
const MONTH_END = new Date(Number(PREVIEW_DATE.slice(0, 4)), Number(PREVIEW_DATE.slice(5, 7)), 0, 12).toISOString().slice(0, 10);
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
  const webProofVisual = selectLaborWebProofVisual();
  const [screen, setScreen] = useState<Screen>({ kind: 'main', tab: 'today' });
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });
  const [loadNonce, setLoadNonce] = useState(0);
  const [monthLoading, setMonthLoading] = useState(false);
  const monthRequest = useRef(0);
  const [selectedDate, setSelectedDate] = useState(PREVIEW_DATE);
  const [workMode, setWorkMode] = useState<'calendar' | 'history'>('calendar');
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const [recordAction, setRecordAction] = useState<RecordAction>('job');
  const [recordPersonId, setRecordPersonId] = useState<string | null>(null);
  const [recordJobId, setRecordJobId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const adapter = await initializeTakaiLaborNotebook();
        const [model, today, range, history] = await Promise.all([
          adapter.getReadModel(), adapter.getTodaySummary(PREVIEW_DATE), adapter.getCalendarRange({ startDate: MONTH_START, endDate: MONTH_END }), adapter.getHistory({ startDate: MONTH_START, endDate: MONTH_END }),
        ]);
        if (mounted) setPreview({ status: 'ready', adapter, model, today, calendar: range.days, history });
      } catch (error) {
        if (mounted) setPreview({ status: 'error', message: error instanceof Error ? error.message : 'เปิดสมุดงานไม่สำเร็จ' });
      }
    })();
    return () => { mounted = false; };
  }, [loadNonce]);

  const activeTab: BottomTabKey = screen.kind === 'main' ? screen.tab : 'work';
  const openTab = (tab: BottomTabKey) => setScreen({ kind: 'main', tab });
  const openJob = (id: string) => setScreen({ kind: 'job', id });
  const openPerson = (id: string) => setScreen({ kind: 'person', id });
  const openWorkerEditor = (id: string | null = null) => setScreen({ kind: 'worker', id });
  const startRecord = (date: string) => { setRecordDate(date); setRecordAction('job'); setRecordPersonId(null); setRecordJobId(null); setScreen({ kind: 'main', tab: 'record' }); };
  const startAction = (action: RecordAction, options: { personId?: string; jobId?: string } = {}) => {
    setRecordDate(preview.status === 'ready' ? preview.today.date : PREVIEW_DATE); setRecordAction(action); setRecordPersonId(options.personId ?? null); setRecordJobId(options.jobId ?? null); setScreen({ kind: 'main', tab: 'record' });
  };
  const refreshPreview = async () => {
    if (preview.status !== 'ready') return;
    const startDate = preview.calendar[0]?.date ?? MONTH_START;
    const endDate = preview.calendar[preview.calendar.length - 1]?.date ?? MONTH_END;
    const [model, today, range, history] = await Promise.all([
      preview.adapter.getReadModel(), preview.adapter.getTodaySummary(PREVIEW_DATE), preview.adapter.getCalendarRange({ startDate, endDate }), preview.adapter.getHistory({ startDate, endDate }),
    ]);
    setPreview({ ...preview, model, today, calendar: range.days, history });
  };
  const changeMonth = (delta: number) => {
    if (preview.status !== 'ready') return;
    const current = new Date(`${preview.calendar[0]?.date ?? MONTH_START}T12:00:00`);
    const first = new Date(current.getFullYear(), current.getMonth() + delta, 1, 12);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
    const startDate = first.toISOString().slice(0, 10);
    const endDate = last.toISOString().slice(0, 10);
    const request = ++monthRequest.current;
    setMonthLoading(true);
    void Promise.all([preview.adapter.getCalendarRange({ startDate, endDate }), preview.adapter.getHistory({ startDate, endDate })]).then(([range, history]) => {
      if (request !== monthRequest.current) return;
      setSelectedDate(startDate);
      setPreview({ ...preview, calendar: range.days, history });
    }).catch(() => undefined).finally(() => { if (request === monthRequest.current) setMonthLoading(false); });
  };

  return (
    <View style={styles.appRoot}>
    <AppShell activeTab={activeTab} onTabPress={openTab} showTabs={screen.kind === 'main'} variant={screen.kind === 'main' ? 'tabbed' : 'detail'}>
      <TopBar
        title={screen.kind === 'main' ? tabTitles[screen.tab] : screen.kind === 'job' ? 'รายละเอียดงาน' : screen.kind === 'person' ? 'ข้อมูลคนทำงาน' : screen.id ? 'แก้ไขคนทำงาน' : 'เพิ่มคนทำงาน'}
        variant={screen.kind === 'main' ? 'default' : 'back'}
        onBackPress={() => setScreen({ kind: 'main', tab: screen.kind === 'job' ? 'work' : 'people' })}
      />
      {preview.status === 'loading' ? <Loading /> : null}
      {preview.status === 'error' ? <FieldCard variant="alert"><Text style={styles.title}>เปิดข้อมูลไม่สำเร็จ</Text><Text style={styles.muted}>{preview.message}</Text><PrimaryButton label="ลองอีกครั้ง" onPress={() => setLoadNonce((value) => value + 1)} /></FieldCard> : null}
      {preview.status === 'ready' ? (
        <>
          {preview.adapter.mode === 'proof' ? <StatusChip label="ข้อมูลทดสอบ" variant="offline" /> : null}
          {screen.kind === 'main' && screen.tab === 'today' ? <TodayScreen today={preview.today} model={preview.model} onJob={openJob} onPerson={openPerson} onRecord={() => startRecord(preview.today.date)} /> : null}
          {screen.kind === 'main' && screen.tab === 'work' ? (
            <WorkScreen calendar={preview.calendar} history={preview.history} people={preview.model.people} mode={workMode} onChangeMode={setWorkMode} onJob={openJob} onPerson={openPerson} onRecord={startRecord} selectedDate={selectedDate} onSelectDate={setSelectedDate} onMonth={changeMonth} monthLoading={monthLoading} />
          ) : null}
          {screen.kind === 'main' && screen.tab === 'record' ? <RecordScreen adapter={preview.adapter} model={preview.model} date={recordDate ?? preview.today.date} action={recordAction} initialPersonId={recordPersonId} initialJobId={recordJobId} onRefresh={refreshPreview} onToast={setToast} /> : null}
          {screen.kind === 'main' && screen.tab === 'people' ? <PeopleScreen model={preview.model} onPerson={openPerson} onAdd={() => openWorkerEditor()} /> : null}
          {screen.kind === 'main' && screen.tab === 'more' ? <MoreScreen /> : null}
          {screen.kind === 'job' ? <JobScreen adapter={preview.adapter} jobId={screen.id} onPerson={openPerson} onAction={startAction} /> : null}
          {screen.kind === 'person' ? <PersonScreen adapter={preview.adapter} personId={screen.id} onJob={openJob} onAction={startAction} onEdit={() => openWorkerEditor(screen.id)} onRefresh={refreshPreview} onToast={setToast} /> : null}
          {screen.kind === 'worker' ? <WorkerEditorScreen adapter={preview.adapter} worker={screen.id ? preview.model.people.find((person) => person.id === screen.id) ?? null : null} onDone={() => setScreen({ kind: 'main', tab: 'people' })} onRefresh={refreshPreview} onToast={setToast} /> : null}
        </>
      ) : null}
    </AppShell>
    <FeedbackToast message={webProofVisual === 'success-toast' ? 'ข้อมูลทดสอบ: บันทึกสำเร็จแล้ว' : toast ?? ''} onDismiss={() => setToast(null)} visible={webProofVisual === 'success-toast' || Boolean(toast)} />
    <ConfirmActionSheet cancelLabel="ปิดตัวอย่าง" confirmLabel="ตัวอย่างเท่านั้น" detail="ข้อมูลทดสอบนี้ใช้ตรวจรูปแบบก่อนบันทึกจริง และจะไม่เปลี่ยนข้อมูลใด" onCancel={() => undefined} onConfirm={() => undefined} title="ข้อมูลทดสอบ · ยืนยันรายการ" visible={webProofVisual === 'confirm-sheet'} />
    </View>
  );
}

function Loading() { return <ScreenSkeleton lines={3} />; }

function TodayScreen({ today, model, onJob, onPerson, onRecord }: { today: LaborTodaySummary; model: LaborMvpReadModel; onJob: (id: string) => void; onPerson: (id: string) => void; onRecord: () => void }) {
  if (!model.people.length) return <NotebookEmptyState onRecord={onRecord} />;
  return <>
    <FieldCard variant="raised"><Text style={styles.eyebrow}>{thaiDate(today.date, true)} · ภาพรวมงานและเงิน</Text><Text style={styles.title}>วันนี้มีงาน {today.day.workCount} รายการ</Text><Text style={styles.muted}>ยอดงาน {money(today.day.workDueSatang)} · เงินออก/รับวันนี้ {money(today.day.individualPaymentSatang + today.day.groupReceiptSatang)}</Text></FieldCard>
    <AmountStrip items={[['งานวันนี้', today.day.workDueSatang], ['จ่ายค่าแรง', today.day.individualPaymentSatang], ['รับชุดงาน', today.day.groupReceiptSatang]]} />
    <SectionHeader title="งานและเหตุการณ์วันนี้" />
    {today.day.events.length ? <LedgerListCard>{today.day.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />)}</LedgerListCard> : <Empty label="ยังไม่มีงานหรือรายการเงินในวันนี้" />}
    <Attention title="ค้างค่าแรง" people={today.unpaidPeople.filter((person) => person.wageRemainingSatang > 0)} amount={(person) => person.wageRemainingSatang} onPerson={onPerson} empty="วันนี้ไม่มีค่าแรงค้างในตัวอย่าง" />
    <Attention title="เงินเบิกคงเหลือ" people={today.advanceAttentionPeople} amount={(person) => person.advanceRemainingSatang} onPerson={onPerson} empty="ไม่มีเงินเบิกคงเหลือ" />
    <PrimaryButton label="+ บันทึกงานวันนี้" onPress={onRecord} />
  </>;
}

function WorkScreen({ calendar, history, people, mode, onChangeMode, selectedDate, onSelectDate, onJob, onPerson, onRecord, onMonth, monthLoading }: { calendar: LaborCalendarDaySummary[]; history: LaborHistory; people: LaborMvpReadModel['people']; mode: 'calendar' | 'history'; onChangeMode: (mode: 'calendar' | 'history') => void; selectedDate: string; onSelectDate: (date: string) => void; onJob: (id: string) => void; onPerson: (id: string) => void; onRecord: (date: string) => void; onMonth: (delta: number) => void; monthLoading: boolean }) {
  const selectedDay = calendar.find((day) => day.date === selectedDate) ?? { date: selectedDate, events: [], workCount: 0, workDueSatang: 0, individualPaymentSatang: 0, groupReceiptSatang: 0, advanceIssuedSatang: 0, advanceRecoveredSatang: 0, contractProgressCount: 0, contractCompletionCount: 0, contractDeadlineCount: 0 };
  return <>
    <View style={styles.segment}><Segment label="ปฏิทิน" active={mode === 'calendar'} onPress={() => onChangeMode('calendar')} /><Segment label="ประวัติ" active={mode === 'history'} onPress={() => onChangeMode('history')} /></View>
    {monthLoading ? <Text style={styles.caption}>กำลังเปลี่ยนเดือน…</Text> : null}
    {mode === 'calendar' ? <CalendarScreen days={calendar} selected={selectedDate} onSelect={onSelectDate} day={selectedDay} onJob={onJob} onPerson={onPerson} onRecord={onRecord} onMonth={onMonth} /> : <HistoryScreen history={history} people={people} onJob={onJob} onPerson={onPerson} />}
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
    {day.events.length ? <LedgerListCard>{day.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />)}</LedgerListCard> : <Empty label="ยังไม่มีรายการในวันที่เลือก" />}
    <PrimaryButton label={`+ บันทึกงานวันที่ ${thaiDate(day.date)}`} onPress={() => onRecord(day.date)} />
  </>;
}

function CalendarCell({ day, selected, onPress }: { day: LaborCalendarDaySummary; selected: boolean; onPress: () => void }) {
  const work = day.workCount > 0; const finance = day.individualPaymentSatang + day.groupReceiptSatang + day.advanceIssuedSatang + day.advanceRecoveredSatang > 0;
  return <Pressable accessibilityLabel={`${thaiDate(day.date)}${work ? ` มีงาน ${day.workCount} รายการ` : ''}`} onPress={onPress} style={[styles.calendarCell, selected && styles.calendarSelected]}><Text style={[styles.dayNumber, selected && styles.selectedText]}>{Number(day.date.slice(-2))}</Text><View style={styles.markerLine}>{work ? <View style={styles.workMarker} /> : null}{finance ? <View style={styles.moneyMarker} /> : null}</View>{(work || finance) ? <Text numberOfLines={1} style={[styles.markerText, selected && styles.selectedText]}>{work ? `งาน${day.workCount}` : 'เงิน'}</Text> : null}</Pressable>;
}

function HistoryScreen({ history, people, onJob, onPerson }: { history: LaborHistory; people: LaborMvpReadModel['people']; onJob: (id: string) => void; onPerson: (id: string) => void }) {
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
    <ChipRow><FilterChip label="ทั้งหมด" active={person === 'ทั้งหมด'} onPress={() => setPerson('ทั้งหมด')} />{people.map((worker) => <FilterChip key={worker.id} label={worker.displayName} active={person === worker.id} onPress={() => setPerson(worker.id)} />)}</ChipRow>
    <ChipRow><FilterChip label="ทุกสถานะ" active={filter === 'all'} onPress={() => setFilter('all')} /><FilterChip label="ค้างจ่าย" active={filter === 'unpaid'} onPress={() => setFilter('unpaid')} /><FilterChip label="ชุดรับเงิน" active={filter === 'group'} onPress={() => setFilter('group')} /></ChipRow>
    <ChipRow><FilterChip label="ทุกประเภท" active={type === 'all'} onPress={() => setType('all')} /><FilterChip label="งาน" active={type === 'work'} onPress={() => setType('work')} /><FilterChip label="การเงิน" active={type === 'finance'} onPress={() => setType('finance')} /></ChipRow>
    <SectionHeader title={`ประวัติ ${events.length} รายการ`} />
    {events.length ? Object.entries(byDate).sort(([left], [right]) => right.localeCompare(left)).map(([date, grouped]) => <View key={date} style={styles.historyGroup}><Text style={styles.groupDate}>{thaiDate(date, true)}</Text><LedgerListCard>{grouped.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={onPerson} />)}</LedgerListCard></View>) : <Empty label="ไม่พบรายการตามตัวกรองนี้" />}
  </>;
}

function PeopleScreen({ model, onPerson, onAdd }: { model: LaborMvpReadModel; onPerson: (id: string) => void; onAdd: () => void }) { const active = model.people.filter((person) => !person.archivedAt); const archived = model.people.filter((person) => person.archivedAt); return <>
  <FieldCard variant="raised"><Text style={styles.eyebrow}>คนทำงาน</Text><Text style={styles.title}>{model.people.length} คนในสมุดงาน</Text><Text style={styles.muted}>ยอดค่าแรงและเงินเบิกแยกกันเสมอ</Text></FieldCard>
  <PrimaryButton label="+ เพิ่มคนทำงาน" onPress={onAdd} />
  <SectionHeader title="รายชื่อคนทำงาน" />
  {active.length ? <LedgerListCard>{active.map((person) => <PersonListRow key={person.id} person={person} onPress={() => onPerson(person.id)} />)}</LedgerListCard> : <Empty label="ยังไม่มีคนทำงานที่ใช้งานอยู่" />}
  {archived.length ? <><SectionHeader title="คนที่เก็บไว้" /><LedgerListCard>{archived.map((person) => <PersonListRow key={person.id} person={person} onPress={() => onPerson(person.id)} archived />)}</LedgerListCard></> : null}
  </>; }

function JobScreen({ adapter, jobId, onPerson, onAction }: { adapter: LaborPreviewAdapter; jobId: string; onPerson: (id: string) => void; onAction: (action: RecordAction, options?: { personId?: string; jobId?: string }) => void }) { const [detail, setDetail] = useState<LaborJobDetail | null | undefined>(undefined); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0); useEffect(() => { let active = true; setDetail(undefined); setError(null); void adapter.getJobDetail(jobId).then((value) => { if (active) setDetail(value); }).catch(() => { if (active) setError('เปิดรายละเอียดงานไม่สำเร็จ'); }); return () => { active = false; }; }, [adapter, jobId, retry]); if (error) return <RetryState label={error} onRetry={() => setRetry((value) => value + 1)} />; if (detail === undefined) return <Loading />; if (!detail) return <Empty label="ไม่พบงานนี้" />; return <>
  <FieldCard variant="raised"><StatusChip label={detail.settlementRoute === 'group' ? 'ชุดรับเงิน' : 'จ่ายรายคน'} variant="active" /><Text style={styles.title}>{detail.title}</Text><Text style={styles.muted}>วันที่ทำงาน {thaiDate(detail.workDate, true)}</Text>{detail.note ? <Text style={styles.caption}>{detail.note}</Text> : null}</FieldCard>
  <AmountStrip items={[['ยอดงาน', detail.dueSatang], ['เงินสดจ่าย/รับ', detail.cashPaidSatang], ['คงเหลือ', detail.remainingSatang]]} />
  <SectionHeader title="คนทำงาน" /><LedgerListCard>{detail.participants.map((person) => <LedgerListRow key={person.personId} onPress={() => onPerson(person.personId)}><LedgerRowText detail={basisLabel(person.payType)} title={person.displayName} /><LedgerTrailing><Text style={styles.rowMeta}>ดูข้อมูล</Text></LedgerTrailing></LedgerListRow>)}</LedgerListCard>
  {detail.settlementGroup ? <FieldCard><Text style={styles.formLabel}>ชุดรับเงิน</Text><Text style={styles.rowTitle}>{detail.settlementGroup.collectorLabel || 'ยังไม่ได้ระบุผู้รับเงินสดแทน'}</Text><Text style={styles.muted}>รับแล้ว {money(detail.settlementGroup.paidSatang)} · คงเหลือ {money(detail.settlementGroup.remainingSatang)}</Text></FieldCard> : null}
  {detail.contract ? <FieldCard><Text style={styles.formLabel}>งานเหมา</Text><Text style={styles.muted}>เริ่ม {detail.contract.startsOn ? thaiDate(detail.contract.startsOn) : '—'} · กำหนด {detail.contract.deadlineOn ? thaiDate(detail.contract.deadlineOn) : 'ไม่จำกัด'}</Text></FieldCard> : null}
  <SectionHeader title="ประวัติของงาน" />{detail.events.length ? <LedgerListCard>{detail.events.map((event) => <LaborRow key={event.id} event={event} onJob={() => undefined} onPerson={onPerson} />)}</LedgerListCard> : <Empty label="ยังไม่มีประวัติของงานนี้" />}
  {detail.kind === 'contract' && detail.contract?.status !== 'completed' ? <PrimaryButton label="บันทึกความคืบหน้า / จบงานเหมา" onPress={() => onAction('job', { jobId })} /> : null}
  <PrimaryButton label={detail.settlementRoute === 'group' ? 'รับเงินชุดงาน' : 'จ่ายค่าแรงรายคน'} onPress={() => onAction(detail.settlementRoute === 'group' ? 'receipt' : 'payment', { jobId })} />
  <PrimaryButton label="แก้ไขรายการการเงิน (ต้องใส่เหตุผล)" onPress={() => onAction('correction', { jobId })} variant="secondary" />
  </>; }

function PersonScreen({ adapter, personId, onJob, onAction, onEdit, onRefresh, onToast }: { adapter: LaborPreviewAdapter; personId: string; onJob: (id: string) => void; onAction: (action: RecordAction, options?: { personId?: string; jobId?: string }) => void; onEdit: () => void; onRefresh: () => Promise<void>; onToast: (message: string) => void }) { const [detail, setDetail] = useState<LaborPersonDetail | null | undefined>(undefined); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0); const [archiveReason, setArchiveReason] = useState(''); const [archiveOpen, setArchiveOpen] = useState(false); const [archiveBusy, setArchiveBusy] = useState(false); const [archiveFeedback, setArchiveFeedback] = useState<string | null>(null); useEffect(() => { let active = true; setDetail(undefined); setError(null); void adapter.getPersonDetail(personId).then((value) => { if (active) setDetail(value); }).catch(() => { if (active) setError('เปิดข้อมูลคนทำงานไม่สำเร็จ'); }); return () => { active = false; }; }, [adapter, personId, retry]); if (error) return <RetryState label={error} onRetry={() => setRetry((value) => value + 1)} />; if (detail === undefined) return <Loading />; if (!detail) return <Empty label="ไม่พบคนทำงานนี้" />; const { person } = detail; const archive = async () => { const message = workerDraftError({ displayName: person.displayName, reason: archiveReason }, 'archive'); if (message) { setArchiveFeedback(message); return; } setArchiveBusy(true); try { await adapter.workers.archive(person.id, archiveReason); try { await onRefresh(); onToast('เก็บรายชื่อแล้ว ประวัติเดิมยังดูได้'); } catch { onToast('เก็บรายชื่อแล้ว แต่รีเฟรชรายการไม่สำเร็จ กดลองรีเฟรชอีกครั้ง'); } setArchiveOpen(false); } catch (cause) { setArchiveFeedback(cause instanceof Error ? cause.message : 'เก็บรายชื่อไม่สำเร็จ'); } finally { setArchiveBusy(false); } }; return <>
  <FieldCard variant="raised"><Text style={styles.eyebrow}>คนทำงาน</Text><Text style={styles.title}>{person.displayName}</Text><Text style={styles.muted}>{person.specialty || 'ยังไม่ได้ระบุงานที่ถนัด'}</Text></FieldCard>
  <SectionHeader title="ค่าแรง" /><AmountStrip items={[['ค่าแรงรวม', person.grossEarnedSatang], ['จ่ายแล้ว', person.cashPaidSatang], ['ค้างค่าแรง', person.wageRemainingSatang]]} />
  <SectionHeader title="เงินเบิก" /><AmountStrip items={[['เบิกแล้ว', person.advanceIssuedSatang], ['หักคืนแล้ว', person.advanceRecoveredSatang], ['เบิกคงเหลือ', person.advanceRemainingSatang]]} />
  <SectionHeader title="ประวัติ" />{detail.events.length ? <LedgerListCard>{detail.events.map((event) => <LaborRow key={event.id} event={event} onJob={onJob} onPerson={() => undefined} />)}</LedgerListCard> : <Empty label="ยังไม่มีประวัติ" />}
  <PrimaryButton label="จ่ายค่าแรงรายคน" onPress={() => onAction('payment', { personId })} />
  <PrimaryButton label="ให้เงินเบิก" onPress={() => onAction('advance', { personId })} variant="secondary" />
  <PrimaryButton label="หักคืนจากค่าแรง" onPress={() => onAction('recovery', { personId })} variant="secondary" />
  {!person.archivedAt ? <><PrimaryButton label="แก้ไขข้อมูลคนทำงาน" onPress={onEdit} variant="secondary" /><TextField label="เหตุผลที่เก็บรายชื่อ" value={archiveReason} onChange={setArchiveReason} placeholder="เช่น เลิกทำงานแล้ว" />{archiveFeedback ? <FormFeedback>{archiveFeedback}</FormFeedback> : null}<PrimaryButton label="เก็บรายชื่อนี้" onPress={() => setArchiveOpen(true)} variant="secondary" /><ConfirmActionSheet cancelLabel="กลับไปแก้ไข" confirmDisabled={archiveBusy} confirmLabel={archiveBusy ? 'กำลังเก็บ…' : 'ยืนยันเก็บรายชื่อ'} detail="รายชื่อนี้จะไม่อยู่ในตัวเลือกบันทึกงานใหม่ แต่ประวัติเดิมยังดูได้" onCancel={() => setArchiveOpen(false)} onConfirm={archive} title="เก็บคนทำงาน" visible={archiveOpen} /></> : <FormFeedback kind="notice">รายชื่อนี้เก็บไว้แล้ว จึงใช้กับงานใหม่ไม่ได้ แต่ประวัติและรายการเงินเดิมยังดูได้</FormFeedback>}
  </>; }

function WorkerEditorScreen({ adapter, worker, onDone, onRefresh, onToast }: { adapter: LaborPreviewAdapter; worker: LaborWorker | null; onDone: () => void; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const [displayName, setDisplayName] = useState(worker?.displayName ?? ''); const [specialty, setSpecialty] = useState(worker?.specialty ?? ''); const [phone, setPhone] = useState(worker?.phone ?? ''); const [note, setNote] = useState(worker?.note ?? ''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => { setDisplayName(worker?.displayName ?? ''); setSpecialty(worker?.specialty ?? ''); setPhone(worker?.phone ?? ''); setNote(worker?.note ?? ''); setReason(''); setFeedback(null); }, [worker?.id]);
  const save = async () => { const message = workerDraftError({ displayName, reason }, worker ? 'edit' : 'create'); if (message) { setFeedback(message); return; } setBusy(true); setFeedback(null); try { if (worker) await adapter.workers.update(worker.id, { displayName, specialty, phone, note, reason }); else await adapter.workers.create({ displayName, specialty, phone, note }); try { await onRefresh(); onToast(worker ? 'แก้ไขข้อมูลคนทำงานแล้ว' : 'เพิ่มคนทำงานแล้ว'); } catch { onToast(worker ? 'แก้ไขข้อมูลแล้ว แต่รีเฟรชรายการไม่สำเร็จ' : 'เพิ่มคนทำงานแล้ว แต่รีเฟรชรายการไม่สำเร็จ'); } onDone(); } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'บันทึกข้อมูลคนทำงานไม่สำเร็จ'); } finally { setBusy(false); } };
  return <><FieldCard variant="raised"><Text style={styles.eyebrow}>คนทำงาน</Text><Text style={styles.title}>{worker ? 'แก้ไขข้อมูลคนทำงาน' : 'เพิ่มคนทำงาน'}</Text><Text style={styles.muted}>ชื่อใช้เลือกบันทึกงานใหม่ได้ทันที ส่วนข้อมูลอื่นใส่เมื่อสะดวก</Text></FieldCard><TextField label="ชื่อคนทำงาน" value={displayName} onChange={setDisplayName} placeholder="เช่น พี่สุ" /><TextField label="งานที่ถนัด (ไม่บังคับ)" value={specialty} onChange={setSpecialty} /><TextField label="เบอร์โทร (ไม่บังคับ)" value={phone} onChange={setPhone} keyboard="number-pad" /><TextField label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={setNote} />{worker ? <TextField label="เหตุผลที่แก้ไข" value={reason} onChange={setReason} placeholder="เช่น เปลี่ยนเบอร์โทร" /> : null}{feedback ? <FormFeedback>{feedback}</FormFeedback> : null}<PrimaryButton disabled={busy} label={busy ? 'กำลังบันทึก…' : worker ? 'บันทึกการแก้ไข' : 'เพิ่มคนทำงาน'} onPress={save} /></>;
}

function RecordScreen({ adapter, model, date: initialDate, action: initialAction, initialPersonId, initialJobId, onRefresh, onToast }: { adapter: LaborPreviewAdapter; model: LaborMvpReadModel; date: string; action: RecordAction; initialPersonId: string | null; initialJobId: string | null; onRefresh: () => Promise<void>; onToast: (message: string) => void }) {
  const activePeople = model.people.filter((person) => !person.archivedAt);
  const [action, setAction] = useState<RecordAction>(initialAction); const [jobKind, setJobKind] = useState<'normal' | 'group' | 'contract'>('normal'); const [date, setDate] = useState(initialDate); const [title, setTitle] = useState(''); const [personId, setPersonId] = useState(initialPersonId ?? activePeople[0]?.id ?? ''); const [members, setMembers] = useState<string[]>(activePeople.slice(0, 2).map((person) => person.id)); const [jobId, setJobId] = useState(initialJobId ?? ''); const [basis, setBasis] = useState<'daily' | 'hourly' | 'piece'>('daily'); const [dayPart, setDayPart] = useState<'500' | '1000'>('1000'); const [rate, setRate] = useState('350'); const [quantity, setQuantity] = useState('1'); const [minutes, setMinutes] = useState('60'); const [unit, setUnit] = useState('ชิ้น'); const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [deadline, setDeadline] = useState(''); const [route, setRoute] = useState<'individual' | 'group'>('group'); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null); const [confirmation, setConfirmation] = useState<{ title: string; detail: string } | null>(null); const [correctionTargetId, setCorrectionTargetId] = useState(''); const [quickAdd, setQuickAdd] = useState(false); const moneyCommit = useRef<ReturnType<typeof createSingleCommitCoordinator> | null>(null);
  useEffect(() => { setAction(initialAction); setDate(initialDate); if (initialPersonId) setPersonId(initialPersonId); if (initialJobId) { setJobId(initialJobId); setJobKind('contract'); } }, [initialAction, initialDate, initialPersonId, initialJobId]);
  const baht = (value: string) => Math.round(Number(value) * 100);
  const selectedPayable = model.payables.find((payable) => payable.personId === personId && payable.remainingSatang > 0);
  const selectedAdvance = model.advances.find((advance) => advance.personId === personId && advance.remainingSatang > 0);
  const selectedGroup = model.settlementGroups.find((group) => group.id === jobId || group.jobId === jobId);
  const contracts = model.contracts.filter((contract) => contract.status !== 'cancelled');
  const correctionTargets = eligibleCorrectionTargets(model, { jobId: initialJobId, personId: initialPersonId });
  const executeCommand = async () => {
      if (action === 'job' && jobKind === 'normal') {
        if (!title.trim()) throw new Error('กรอกชื่องานก่อนบันทึก');
        if (basis === 'daily') await adapter.commands.createNormalWork({ title, workDate: date, note, participants: [{ personId, payType: 'daily', rateSatang: baht(rate), quantityMilli: Number(dayPart), dueSatang: Math.round(baht(rate) * Number(dayPart) / 1000), unitLabel: 'วัน' }] });
        if (basis === 'hourly') await adapter.commands.createNormalWork({ title, workDate: date, note, participants: [{ personId, payType: 'hourly', rateSatang: baht(rate), durationMinutes: Number(minutes), dueSatang: Math.round(baht(rate) * Number(minutes) / 60), unitLabel: 'ชั่วโมง' }] });
        if (basis === 'piece') await adapter.commands.createNormalWork({ title, workDate: date, note, participants: [{ personId, payType: 'piece', rateSatang: baht(rate), quantityMilli: Math.round(Number(quantity) * 1000), dueSatang: Math.round(baht(rate) * Math.round(Number(quantity) * 1000) / 1000), unitLabel: unit.trim() || 'ชิ้น' }] });
      } else if (action === 'job' && jobKind === 'group') {
        if (!title.trim()) throw new Error('กรอกชื่องานก่อนบันทึก');
        await adapter.commands.createGroupPieceWork({ title, workDate: date, note, memberPersonIds: members, quantityMilli: Math.round(Number(quantity) * 1000), rateSatang: baht(rate), unitLabel: unit.trim() || 'ชิ้น', collectorPersonId: members[0], collectorLabel: 'ผู้รับเงินชุดงาน' });
      } else if (action === 'job' && jobKind === 'contract') {
        if (!title.trim()) throw new Error('กรอกชื่องานเหมาก่อนบันทึก');
        if (!jobId) await adapter.commands.createLaborContract({ title, workDate: date, startsOn: date, deadlineOn: deadline || undefined, note, participants: members.map((id) => ({ personId: id })), settlementRoute: route });
        else if (basis === 'piece') await adapter.commands.addLaborContractProgress(jobId, { progressDate: date, note: note || 'บันทึกความคืบหน้า', quantityMilli: Math.round(Number(quantity) * 1000), unitLabel: unit.trim() || 'ชิ้น' });
        else {
          await adapter.commands.completeLaborContractWork(jobId, { completedOn: date, finalTotalSatang: baht(amount), note });
          const contractMembers = model.contracts.find((contract) => contract.id === jobId)?.participants.map((participant) => participant.personId) ?? members;
          if (route === 'group') await adapter.commands.createLaborSettlementGroup({ laborJobId: jobId, originalDueSatang: baht(amount), memberPersonIds: contractMembers, collectorPersonId: contractMembers[0], collectorLabel: 'ผู้รับเงินชุดงาน' });
        }
      } else if (action === 'receipt') {
        if (!selectedGroup) throw new Error('เลือกชุดรับเงินที่ยังค้างอยู่');
        await adapter.commands.postLaborSettlementGroupReceipt({ settlementGroupId: selectedGroup.id, receiptDate: date, amountSatang: baht(amount), method: 'cash', note });
      } else if (action === 'payment') {
        if (!selectedPayable) throw new Error('คนนี้ไม่มีค่าแรงรายคนที่ค้างอยู่');
        await adapter.commands.postLaborPayment({ personId, paymentDate: date, method: 'cash', note, allocations: [{ payableId: selectedPayable.id, amountSatang: baht(amount) }] });
      } else if (action === 'advance') {
        await adapter.commands.createLaborWorkerAdvance({ personId, advanceDate: date, amountSatang: baht(amount), method: 'cash', note });
      } else if (action === 'recovery') {
        if (!selectedAdvance || !selectedPayable) throw new Error('ต้องเลือกคนที่มีทั้งเงินเบิกคงเหลือและค่าแรงรายคนค้างอยู่');
        await adapter.commands.applyLaborAdvanceDeduction({ advanceId: selectedAdvance.id, payableId: selectedPayable.id, recoveryDate: date, amountSatang: baht(amount), note });
      } else if (action === 'correction') {
        if (!reason.trim()) throw new Error('การแก้ไขต้องระบุเหตุผล');
        const target = requireCorrectionTarget(correctionTargets, correctionTargetId);
        const targetId = target.id.slice(target.id.indexOf(':') + 1);
        if (target.kind === 'payment') { const payment = model.payments.find((item) => item.id === targetId)!; await adapter.commands.editLaborPayment(payment.id, { paymentDate: payment.paymentDate, method: payment.method, note: payment.note, allocations: payment.allocations.map((allocation) => ({ payableId: allocation.payableId, amountSatang: allocation.amountSatang })), reason }); }
        if (target.kind === 'receipt') { const receipt = model.settlementGroups.flatMap((group) => group.receipts).find((item) => item.id === targetId)!; await adapter.commands.editLaborSettlementGroupReceipt(receipt.id, { receiptDate: receipt.receiptDate, amountSatang: receipt.amountSatang, method: receipt.method, note: receipt.note, reason }); }
        if (target.kind === 'advance') { const advance = model.advances.find((item) => item.id === targetId)!; await adapter.commands.editLaborWorkerAdvance(advance.id, { advanceDate: advance.advanceDate, amountSatang: advance.amountSatang, method: advance.method, note: advance.note, reason }); }
      }
  };
  const review = () => { if (action === 'job') { void run(true); return; } const numericAmount = baht(amount); const reviewError = action !== 'correction' && (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) ? 'กรอกจำนวนเงินให้มากกว่า 0 ก่อนยืนยัน' : action === 'payment' && !selectedPayable ? 'เลือกค่าแรงค้างที่ต้องการจ่ายก่อนยืนยัน' : action === 'receipt' && !selectedGroup ? 'เลือกชุดรับเงินก่อนยืนยัน' : action === 'recovery' && (!selectedAdvance || !selectedPayable) ? 'เลือกคนที่มีทั้งเงินเบิกและค่าแรงค้างก่อนยืนยัน' : action === 'correction' && !reason.trim() ? 'การแก้ไขต้องระบุเหตุผลก่อนยืนยัน' : action === 'correction' && !correctionTargetId ? 'เลือกรายการการเงินที่ต้องการแก้ไขก่อนยืนยัน' : null; if (reviewError) { setFeedback({ kind: 'error', text: reviewError }); return; } moneyCommit.current = null; setFeedback(null); setConfirmation({ title: `ยืนยัน${label[action]}`, detail: 'ตรวจสอบวันที่ จำนวนเงิน และรายการที่เลือกแล้ว กดยืนยันเพื่อบันทึกครั้งเดียว' }); };
  const run = async (confirmed = false) => { if (busy) return; if (action !== 'job' && !confirmed) { review(); return; } setFeedback(null); setBusy(true); try { if (action === 'job') { await executeCommand(); try { await onRefresh(); onToast('บันทึกงานแล้ว และรีเฟรชปฏิทิน/ประวัติเรียบร้อย'); } catch { onToast('บันทึกงานแล้ว แต่รีเฟรชรายการไม่สำเร็จ'); } } else { moneyCommit.current ??= createSingleCommitCoordinator(); const result = await moneyCommit.current.commit(executeCommand, onRefresh); onToast(result === 'committed' ? 'บันทึกรายการการเงินแล้ว' : 'บันทึกรายการการเงินแล้ว แต่รีเฟรชรายการไม่สำเร็จ'); setConfirmation(null); } } catch (error) { setFeedback({ kind: 'error', text: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }); } finally { setBusy(false); } };
  const label: Record<RecordAction, string> = { job: 'งานรายคน', payment: 'จ่ายค่าแรง', receipt: 'รับเงินชุดงาน', advance: 'ให้เงินเบิก', recovery: 'หักคืนเงินเบิก', correction: 'แก้ไขรายการ' };
  return <>
    <FieldCard variant="raised"><Text style={styles.eyebrow}>บันทึกงาน</Text><Text style={styles.title}>{label[action]}</Text><Text style={styles.muted}>รายการเงินมีเส้นทางชัดเจน: จ่ายรายคน, รับเงินชุดงาน, และเงินเบิกของคนทำงาน</Text></FieldCard>
    <ChipRow>{(Object.entries(label) as Array<[RecordAction, string]>).map(([key, value]) => <FilterChip key={key} label={value} active={action === key} onPress={() => setAction(key)} />)}</ChipRow>
    <DatePickerField label={action === 'job' ? 'วันที่ทำงาน' : 'วันที่เกิดรายการ'} value={date} onChange={setDate} />
    {feedback?.kind === 'error' ? <FormFeedback>{feedback.text}</FormFeedback> : null}
    {action === 'job' ? <><ChipRow><FilterChip label="งานรายคน" active={jobKind === 'normal'} onPress={() => setJobKind('normal')} /><FilterChip label="งานรายชิ้นเป็นชุด" active={jobKind === 'group'} onPress={() => setJobKind('group')} /><FilterChip label="งานเหมา" active={jobKind === 'contract'} onPress={() => setJobKind('contract')} /></ChipRow>{jobKind === 'normal' ? <><TextField label="ชื่องาน" value={title} onChange={setTitle} placeholder="เช่น ตัดหญ้ารอบบ้าน" /><PersonPicker people={activePeople} selected={personId} onQuickAdd={() => setQuickAdd(true)} onSelect={setPersonId} /><ChipRow>{([['daily', 'รายวัน'], ['hourly', 'รายชั่วโมง'], ['piece', 'รายชิ้น']] as const).map(([key, value]) => <FilterChip key={key} label={value} active={basis === key} onPress={() => setBasis(key)} />)}</ChipRow>{basis === 'daily' ? <ChipRow><FilterChip label="เต็มวัน" active={dayPart === '1000'} onPress={() => setDayPart('1000')} /><FilterChip label="ครึ่งวัน" active={dayPart === '500'} onPress={() => setDayPart('500')} /></ChipRow> : null}<TextField label={basis === 'hourly' ? 'ค่าแรงต่อชั่วโมง (บาท)' : 'อัตราต่อหน่วย (บาท)'} value={rate} onChange={setRate} keyboard="decimal-pad" />{basis === 'hourly' ? <TextField label="จำนวนนาที" value={minutes} onChange={setMinutes} keyboard="number-pad" /> : basis === 'piece' ? <><TextField label="จำนวน" value={quantity} onChange={setQuantity} keyboard="decimal-pad" /><TextField label="หน่วย" value={unit} onChange={setUnit} /></> : null}<TextField label="หมายเหตุ (ไม่บังคับ)" value={note} onChange={setNote} /></> : null}{jobKind === 'group' ? <FieldCard><TextField label="ชื่องานรายชิ้น" value={title} onChange={setTitle} /><MultiPersonPicker people={activePeople} selected={members} onToggle={(id) => setMembers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /><TextField label="จำนวน" value={quantity} onChange={setQuantity} keyboard="decimal-pad" /><TextField label="อัตราต่อหน่วย (บาท)" value={rate} onChange={setRate} keyboard="decimal-pad" /><TextField label="หน่วย" value={unit} onChange={setUnit} /></FieldCard> : null}</> : null}
    {action === 'receipt' ? <><GroupPicker groups={model.settlementGroups} selected={selectedGroup?.id ?? ''} onSelect={setJobId} /><TextField label="จำนวนที่รับ (บาท)" value={amount} onChange={setAmount} keyboard="decimal-pad" /><TextField label="หมายเหตุ" value={note} onChange={setNote} /></> : null}
    {action === 'payment' || action === 'advance' || action === 'recovery' ? <><PersonPicker people={activePeople} selected={personId} onQuickAdd={() => setQuickAdd(true)} onSelect={setPersonId} /><FieldCard><Text style={styles.caption}>{action === 'payment' ? `ค่าแรงค้างที่เลือก: ${selectedPayable ? money(selectedPayable.remainingSatang) : 'ไม่มี'}` : action === 'recovery' ? `เงินเบิกคงเหลือ: ${selectedAdvance ? money(selectedAdvance.remainingSatang) : 'ไม่มี'} · ค่าแรงค้าง: ${selectedPayable ? money(selectedPayable.remainingSatang) : 'ไม่มี'}` : 'เงินเบิกเป็นรายการของคนทำงานเท่านั้น'}</Text></FieldCard><TextField label="จำนวนเงิน (บาท)" value={amount} onChange={setAmount} keyboard="decimal-pad" /><TextField label="หมายเหตุ" value={note} onChange={setNote} /></> : null}
    {action === 'correction' ? <><Text style={styles.muted}>ระบบจะสร้าง revision ของรายการเงินเดิม ไม่ลบประวัติเดิม</Text><CorrectionTargetPicker selected={correctionTargetId} targets={correctionTargets} onSelect={setCorrectionTargetId} /><TextField label="เหตุผลที่แก้ไข" value={reason} onChange={setReason} placeholder="เช่น ลงวันที่หรือยอดผิด" /></> : null}
    {action === 'job' && jobKind === 'contract' ? <><SectionHeader title="งานเหมา" /><FieldCard><Text style={styles.caption}>งานเหมารับเงินชุดจะรับเป็นก้อนเดียว ไม่แบ่งเป็นค่าแรงรายคน</Text><TextField label="ชื่องานเหมา" value={title} onChange={setTitle} placeholder="กรอกเมื่อเริ่มงานเหมา" /><MultiPersonPicker people={activePeople} selected={members} onToggle={(id) => setMembers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} /><ChipRow><FilterChip label="รับเงินชุด" active={route === 'group'} onPress={() => setRoute('group')} /><FilterChip label="จ่ายแยกคน" active={route === 'individual'} onPress={() => setRoute('individual')} /></ChipRow><TextField label="กำหนดเสร็จ (YYYY-MM-DD, ไม่บังคับ)" value={deadline} onChange={setDeadline} /><ContractPicker contracts={contracts} selected={jobId} onSelect={(id) => { setJobId(id); const snapshot = model.workBasisSnapshots.find((item) => item.jobId === id && item.basisKind === 'contract'); if (snapshot) setRoute(snapshot.settlementRoute); }} /><ChipRow><FilterChip label="เริ่มงานใหม่" active={!jobId} onPress={() => setJobId('')} /><FilterChip label="ความคืบหน้า" active={Boolean(jobId) && basis === 'piece'} onPress={() => setBasis('piece')} /><FilterChip label="จบงาน" active={Boolean(jobId) && basis !== 'piece'} onPress={() => setBasis('daily')} /></ChipRow>{jobId && basis === 'piece' ? <><TextField label="ผลงานเพิ่ม" value={quantity} onChange={setQuantity} keyboard="decimal-pad" /><TextField label="หน่วย" value={unit} onChange={setUnit} /></> : null}{jobId && basis !== 'piece' ? <TextField label="ยอดสุดท้าย (บาท)" value={amount} onChange={setAmount} keyboard="decimal-pad" /> : null}</FieldCard></> : null}
    {quickAdd ? <QuickAddWorkerForm adapter={adapter} onCancel={() => setQuickAdd(false)} onCreated={async (id) => { setPersonId(id); setMembers((current) => current.length ? current : [id]); setQuickAdd(false); try { await onRefresh(); onToast('เพิ่มคนทำงานแล้ว และเลือกไว้ในรายการนี้'); } catch { onToast('เพิ่มคนทำงานแล้ว แต่รีเฟรชรายการไม่สำเร็จ'); } }} /> : null}
    <PrimaryButton disabled={busy} label={busy ? 'กำลังบันทึก…' : action === 'job' && jobKind === 'contract' ? 'บันทึกงานเหมา' : `บันทึก ${label[action]}`} onPress={review} />
    <ConfirmActionSheet cancelLabel="กลับไปแก้ไข" confirmDisabled={busy} confirmLabel={busy ? 'กำลังบันทึก…' : 'ยืนยันบันทึก'} detail={confirmation?.detail ?? ''} onCancel={() => setConfirmation(null)} onConfirm={() => { void run(true); }} title={confirmation?.title ?? ''} visible={Boolean(confirmation)} />
  </>;
}
function TextField({ label, value, onChange, placeholder, keyboard }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: 'decimal-pad' | 'number-pad' }) { return <View style={styles.field}><Text style={styles.formLabel}>{label}</Text><TextInput accessibilityLabel={label} keyboardType={keyboard} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={tokens.color.text.muted} style={styles.input} value={value} /></View>; }
function PersonPicker({ people, selected, onQuickAdd, onSelect }: { people: LaborMvpReadModel['people']; selected: string; onQuickAdd?: () => void; onSelect: (id: string) => void }) { const [visible, setVisible] = useState(false); const [query, setQuery] = useState(''); const selectedPerson = people.find((person) => person.id === selected); return <><PickerField label="คนทำงาน" onPress={() => setVisible(true)} placeholder="เลือกคนทำงาน" value={selectedPerson?.displayName} /><SearchPickerSheet emptyLabel="ยังไม่มีคนทำงานที่ใช้งานอยู่" onClose={() => setVisible(false)} onPick={(id) => { onSelect(id); setVisible(false); }} options={people.map((person) => ({ id: person.id, label: person.displayName, meta: person.specialty || undefined }))} query={query} quickAdd={onQuickAdd ? <PrimaryButton label="+ เพิ่มคนทำงาน" onPress={() => { setVisible(false); onQuickAdd(); }} variant="secondary" /> : undefined} recentIds={selected ? [selected] : []} setQuery={setQuery} title="เลือกคนทำงาน" visible={visible} /></>; }
function MultiPersonPicker({ people, selected, onToggle }: { people: LaborMvpReadModel['people']; selected: string[]; onToggle: (id: string) => void }) { return <View><Text style={styles.formLabel}>คนทำงานในชุด</Text><ChipRow>{people.map((person) => <FilterChip key={person.id} label={person.displayName} active={selected.includes(person.id)} onPress={() => onToggle(person.id)} />)}</ChipRow></View>; }
function GroupPicker({ groups, selected, onSelect }: { groups: LaborMvpReadModel['settlementGroups']; selected: string; onSelect: (id: string) => void }) { return <View><Text style={styles.formLabel}>ชุดรับเงิน</Text><ChipRow>{groups.filter((group) => group.status === 'open').map((group) => <FilterChip key={group.id} label={`ค้าง ${shortMoney(group.remainingSatang)}`} active={group.id === selected} onPress={() => onSelect(group.id)} />)}</ChipRow></View>; }
function ContractPicker({ contracts, selected, onSelect }: { contracts: LaborMvpReadModel['contracts']; selected: string; onSelect: (id: string) => void }) { return <View><Text style={styles.formLabel}>เลือกงานเหมาที่มีอยู่ (สำหรับความคืบหน้า/จบงาน)</Text><ChipRow>{contracts.map((contract) => <FilterChip key={contract.id} label={contract.title} active={contract.id === selected} onPress={() => onSelect(contract.id)} />)}</ChipRow></View>; }
function CorrectionTargetPicker({ selected, targets, onSelect }: { selected: string; targets: CorrectionTarget[]; onSelect: (id: string) => void }) { const [visible, setVisible] = useState(false); const [query, setQuery] = useState(''); const target = targets.find((item) => item.id === selected); return <><PickerField label="รายการที่ต้องการแก้ไข" onPress={() => setVisible(true)} placeholder={targets.length ? 'เลือกรายการการเงิน' : 'ไม่มีรายการที่แก้ไขได้ในบริบทนี้'} value={target ? `${target.label} · ${target.detail}` : null} /><SearchPickerSheet emptyLabel="ไม่มีรายการการเงินที่แก้ไขได้ในบริบทนี้" onClose={() => setVisible(false)} onPick={(id) => { onSelect(id); setVisible(false); }} options={targets.map((item) => ({ id: item.id, label: item.label, meta: item.detail }))} query={query} recentIds={selected ? [selected] : []} setQuery={setQuery} title="เลือกรายการที่ต้องการแก้ไข" visible={visible} /></>; }
function QuickAddWorkerForm({ adapter, onCancel, onCreated }: { adapter: LaborPreviewAdapter; onCancel: () => void; onCreated: (id: string) => Promise<void> }) { const [displayName, setDisplayName] = useState(''); const [specialty, setSpecialty] = useState(''); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState<string | null>(null); const create = async () => { const message = workerDraftError({ displayName }, 'create'); if (message) { setFeedback(message); return; } setBusy(true); try { const id = await adapter.workers.create({ displayName, specialty }); await onCreated(id); } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'เพิ่มคนทำงานไม่สำเร็จ'); } finally { setBusy(false); } }; return <FieldCard variant="raised"><Text style={styles.formLabel}>เพิ่มคนทำงานระหว่างบันทึก</Text><Text style={styles.caption}>ข้อมูลที่กรอกไว้ในงานนี้จะยังอยู่ครบ</Text><TextField label="ชื่อคนทำงาน" value={displayName} onChange={setDisplayName} /><TextField label="งานที่ถนัด (ไม่บังคับ)" value={specialty} onChange={setSpecialty} />{feedback ? <FormFeedback>{feedback}</FormFeedback> : null}<PrimaryButton disabled={busy} label={busy ? 'กำลังเพิ่ม…' : 'เพิ่มและเลือกคนนี้'} onPress={create} /><PrimaryButton disabled={busy} label="กลับไปบันทึกงาน" onPress={onCancel} variant="secondary" /></FieldCard>; }
function PersonListRow({ archived = false, person, onPress }: { person: LaborMvpReadModel['people'][number]; onPress: () => void; archived?: boolean }) { return <LedgerListRow onPress={onPress}><View style={styles.avatar}><Text style={styles.avatarText}>{person.displayName.slice(0, 1)}</Text></View><LedgerRowText detail={person.specialty || 'ยังไม่ได้ระบุงานที่ถนัด'} title={person.displayName} /><LedgerTrailing>{archived ? <StatusChip label="เก็บไว้" variant="offline" /> : <><Text style={styles.money}>{person.wageRemainingSatang ? `ค้าง ${shortMoney(person.wageRemainingSatang)}` : 'ค่าแรงครบ'}</Text><Text numberOfLines={1} style={styles.rowMeta}>{person.advanceRemainingSatang ? `เบิก ${shortMoney(person.advanceRemainingSatang)}` : 'ไม่มีเงินเบิก'}</Text></>}</LedgerTrailing></LedgerListRow>; }
function NotebookEmptyState({ onRecord }: { onRecord: () => void }) { return <ActionEmptyState actionLabel="ไปที่บันทึกงาน" detail="เพิ่มคนทำงานก่อน แล้วจึงบันทึกงาน ค่าแรง และการจ่ายเงินได้จากหน้าเดียว" onAction={onRecord} title="เริ่มจดงานของสวน" withMascot />; }
function MoreScreen() { return <><FieldCard variant="raised"><View style={styles.aboutMark}><TakaiMascot size={72} /></View><Text style={styles.eyebrow}>TAKAI</Text><Text style={styles.title}>สมุดงานสวน</Text><Text style={styles.muted}>เก็บงาน ค่าแรง เงินเบิก และประวัติการแก้ไขไว้ในที่เดียว</Text></FieldCard><FieldCard><Text style={styles.rowTitle}>เกี่ยวกับสมุดงาน</Text><Text style={styles.muted}>การเปลี่ยนแปลงทุกครั้งจะมีเหตุผลประกอบ เพื่อย้อนดูประวัติได้ภายหลัง</Text></FieldCard></>; }
function Attention({ title, people, amount, onPerson, empty }: { title: string; people: LaborMvpReadModel['people']; amount: (person: LaborMvpReadModel['people'][number]) => number; onPerson: (id: string) => void; empty: string }) { return <><SectionHeader title={title} />{people.length ? <LedgerListCard>{people.map((person) => <LedgerListRow key={person.id} onPress={() => onPerson(person.id)}><LedgerRowText title={person.displayName} /><LedgerTrailing><Text style={styles.money}>{money(amount(person))}</Text></LedgerTrailing></LedgerListRow>)}</LedgerListCard> : <Text style={styles.caption}>{empty}</Text>}</>; }
function LaborRow({ event, onJob, onPerson }: { event: LaborProjectionEvent; onJob: (id: string) => void; onPerson: (id: string) => void }) { const press = event.jobId ? () => onJob(event.jobId!) : event.personId ? () => onPerson(event.personId!) : undefined; const amount = event.amountSatang || event.dueSatang; return <LedgerListRow accessibilityLabel={event.label} onPress={press}><View style={[styles.eventDot, event.eventType === 'work' ? styles.workMarker : styles.moneyMarker]} /><LedgerRowText detail={[thaiDate(event.effectiveDate), event.detail, event.eventType === 'group_receipt' ? 'ไม่ใช่ค่าแรงรายคน' : ''].filter(Boolean).join(' · ')} title={event.label} /><LedgerTrailing><StatusChip label={eventLabels[event.eventType]} variant={event.paymentState === 'unpaid' ? 'unpaid' : event.eventType === 'advance' ? 'dueSoon' : 'paid'} />{amount ? <Text style={styles.money}>{money(amount)}</Text> : null}</LedgerTrailing></LedgerListRow>; }
function AmountStrip({ items }: { items: Array<[string, number]> }) { return <View style={styles.amountStrip}>{items.map(([label, value]) => <FieldCard key={label} variant="summary" style={styles.amountCard}><Text numberOfLines={1} style={styles.caption}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.amount}>{shortMoney(value)}</Text></FieldCard>)}</View>; }
function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.segmentItem, active && styles.segmentActive]}><Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text></Pressable>; }
function ChipRow({ children }: { children: React.ReactNode }) { return <View style={styles.chipRow}>{children}</View>; }
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text></Pressable>; }
function Empty({ label }: { label: string }) { return <ActionEmptyState detail="เลือกวันอื่น หรือเพิ่มรายการเมื่อพร้อม" title={label} />; }
function RetryState({ label, onRetry }: { label: string; onRetry: () => void }) { return <FieldCard variant="alert"><Text style={styles.muted}>{label}</Text><PrimaryButton label="ลองอีกครั้ง" onPress={onRetry} /></FieldCard>; }
function basisLabel(payType: string): string { return ({ daily: 'รายวัน', hourly: 'รายชั่วโมง', piece: 'รายชิ้น', contract: 'งานเหมา' } as Record<string, string>)[payType] ?? 'ผู้ร่วมงาน'; }

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  aboutMark: { alignItems: 'center' }, eyebrow: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontWeight: '700' }, title: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '700', marginTop: 6 }, muted: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23, marginTop: 8 }, caption: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 18 },
  amountStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', width: '100%' }, amountCard: { flexGrow: 0, flexShrink: 1, minWidth: 0, padding: 10, width: '31.8%' }, amount: { color: tokens.color.text.primary, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 5 },
  segment: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, flexDirection: 'row', padding: 4 }, segmentItem: { alignItems: 'center', borderRadius: tokens.radius.button, flex: 1, minHeight: 42, justifyContent: 'center' }, segmentActive: { backgroundColor: '#EAF4EA' }, segmentLabel: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, fontWeight: '700' }, segmentLabelActive: { color: tokens.color.primary.green },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, monthTitle: { alignItems: 'center', flex: 1 }, monthNav: { alignItems: 'center', justifyContent: 'center', minHeight: 44, width: 44 }, monthNavText: { color: tokens.color.primary.green, fontSize: 30, lineHeight: 32 }, week: { flexDirection: 'row' }, weekday: { color: tokens.color.text.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: '14.2857%' }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, blankCell: { height: 60, width: '14.2857%' }, calendarCell: { borderColor: tokens.color.border.soft, borderRadius: 8, borderWidth: 1, height: 60, padding: 4, width: '14.2857%' }, calendarSelected: { backgroundColor: tokens.color.primary.green, borderColor: tokens.color.primary.green }, dayNumber: { color: tokens.color.text.primary, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' }, selectedText: { color: tokens.color.text.inverse }, markerLine: { flexDirection: 'row', gap: 3, marginTop: 4 }, workMarker: { backgroundColor: tokens.color.primary.green, borderRadius: 3, height: 6, width: 6 }, moneyMarker: { backgroundColor: tokens.color.soil.brown, borderRadius: 3, height: 6, width: 6 }, markerText: { color: tokens.color.text.muted, fontSize: 9, marginTop: 3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterChip: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.chip, borderWidth: 1, minHeight: 38, paddingHorizontal: 12, justifyContent: 'center' }, filterChipActive: { backgroundColor: '#EAF4EA', borderColor: tokens.color.primary.green }, filterLabel: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, fontWeight: '700' }, filterLabelActive: { color: tokens.color.primary.green }, formLabel: { color: tokens.color.text.primary, fontSize: tokens.typography.caption.size, fontWeight: '700' }, field: { gap: 6 }, input: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.button, borderWidth: 1, color: tokens.color.text.primary, fontSize: tokens.typography.body.size, minHeight: 48, paddingHorizontal: 12 }, error: { color: tokens.color.state.danger, fontSize: tokens.typography.body.size, fontWeight: '700' }, success: { color: tokens.color.primary.green, fontSize: tokens.typography.body.size, fontWeight: '700' }, search: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, marginTop: 6, minHeight: 40, paddingVertical: 6 },
  eventDot: { borderRadius: 5, height: 10, width: 10 }, rowTitle: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, fontWeight: '700' }, rowMeta: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 17, marginTop: 2 }, money: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontVariant: ['tabular-nums'], fontWeight: '700', textAlign: 'right' },
  historyGroup: { gap: 6 }, groupDate: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, fontWeight: '700', paddingTop: 6 }, avatar: { alignItems: 'center', backgroundColor: '#EAF4EA', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, avatarText: { color: tokens.color.primary.green, fontSize: tokens.typography.body.size, fontWeight: '700' },
});
