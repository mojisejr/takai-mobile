import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { initializeTakaiDatabase, type TakaiDatabase } from '../../data';
import { tokens } from '../../theme/tokens';
import {
  AppShell,
  EvidenceTimeline,
  FieldCard,
  PrimaryButton,
  RecordListItem,
  SectionHeader,
  StatusChip,
  TopBar,
  TrackerCard,
} from '../../ui';
import { DesignLabScreen } from '../design-lab/DesignLabScreen';
import {
  closeCase,
  createDemoSprayActivity,
  createFieldActivity,
  formatThaiShortDate,
  getActivityCaptureOptions,
  getCaseList,
  getCaseTimeline,
  getHoleDetail,
  getLaborLedger,
  getMenuDashboard,
  getMaterialLibrary,
  getTodayDashboard,
  nextDateFrom,
  settleUnpaidLaborForPerson,
  type ActivityCaptureOption,
  type CaseListItem,
  type CaseTimeline,
  type HoleDetail,
  type LaborLedger,
  type MenuDashboard,
  type MaterialLibraryItem,
  type TakaiView,
  type TodayDashboard,
} from './index';

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready';
      db: TakaiDatabase;
      dashboard: TodayDashboard;
      options: ActivityCaptureOption;
      caseList: CaseListItem[];
      caseTimeline: CaseTimeline;
      laborLedger: LaborLedger;
      menuDashboard: MenuDashboard;
      materials: MaterialLibraryItem[];
      holeDetail: HoleDetail;
      message: string | null;
    }
  | { status: 'error'; message: string };

export function OperationalSliceScreen() {
  const [view, setView] = useState<TakaiView>('today');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('cat-spray');
  const [selectedTarget, setSelectedTarget] = useState<'plot' | 'hole' | 'case'>('hole');
  const [selectedMaterialId, setSelectedMaterialId] = useState('material-fungicide-a');
  const [note, setNote] = useState('พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม');
  const [materialAmount, setMaterialAmount] = useState('20');
  const [followUpDays, setFollowUpDays] = useState('4');
  const [includeWorker, setIncludeWorker] = useState(true);
  const [workerAmount, setWorkerAmount] = useState('600');
  const [selectedCaseId, setSelectedCaseId] = useState('case-a-014');

  const refresh = useCallback(async (db: TakaiDatabase, message: string | null = null, caseId = selectedCaseId) => {
    const [dashboard, options, caseList, laborLedger, menuDashboard, materials, holeDetail] = await Promise.all([
      getTodayDashboard(db),
      getActivityCaptureOptions(db),
      getCaseList(db),
      getLaborLedger(db),
      getMenuDashboard(db),
      getMaterialLibrary(db),
      getHoleDetail(db),
    ]);
    const resolvedCaseId = caseList.some((caseItem) => caseItem.id === caseId) ? caseId : caseList[0]?.id ?? 'case-a-014';
    const caseTimeline = await getCaseTimeline(db, resolvedCaseId);
    setSelectedCaseId(resolvedCaseId);
    setState({ status: 'ready', db, dashboard, options, caseList, caseTimeline, laborLedger, menuDashboard, materials, holeDetail, message });
  }, [selectedCaseId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db = await initializeTakaiDatabase();
        if (!cancelled) {
          await refresh(db);
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const createActivity = useCallback(async (mode: 'demo' | 'field' = 'field') => {
    if (state.status !== 'ready') return;
    try {
      if (mode === 'demo') {
        await createDemoSprayActivity(state.db);
      } else {
        const material = state.options.materials.find((item) => item.id === selectedMaterialId) ?? state.options.materials[0];
        const category = state.options.categories.find((item) => item.id === selectedCategoryId) ?? state.options.categories[0];
        if (!material || !category) {
          throw new Error('ยังไม่มีหมวดหรือวัสดุให้บันทึก');
        }
        const performedAt = new Date().toISOString();
        const targetType = selectedTarget === 'case' ? 'case' : selectedTarget === 'hole' && state.options.defaultHoleId ? 'hole' : 'plot';
        const targetId =
          targetType === 'case'
            ? state.caseTimeline.id
            : targetType === 'hole'
              ? state.options.defaultHoleId ?? state.options.defaultPlotId
              : state.options.defaultPlotId;
        const parsedAmount = Number(materialAmount);
        const parsedFollowUp = Number(followUpDays);
        const parsedWorkerAmount = Number(workerAmount);
        await createFieldActivity(state.db, {
          idSeed: `${Date.now()}`,
          plotId: state.options.defaultPlotId,
          categoryId: category.id,
          performedAt,
          note: note.trim() || `${category.name} ${state.dashboard.plot.name}`,
          followUpOn: Number.isFinite(parsedFollowUp) && parsedFollowUp > 0 ? nextDateFrom(performedAt, parsedFollowUp) : null,
          targetType,
          targetId,
          materials: [
            {
              materialId: material.id,
              amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1,
              unit: material.unit,
            },
          ],
          participants: [
            state.options.defaultSelfId
              ? { personId: state.options.defaultSelfId, payType: 'none' as const, amountDue: 0 }
              : null,
            includeWorker && state.options.defaultWorkerId
              ? {
                  personId: state.options.defaultWorkerId,
                  payType: 'daily' as const,
                  amountDue: Number.isFinite(parsedWorkerAmount) ? parsedWorkerAmount : 0,
                }
              : null,
          ].filter((participant): participant is NonNullable<typeof participant> => Boolean(participant)),
        });
      }
      await refresh(state.db, selectedTarget === 'case' ? 'เพิ่มบันทึกเคสแล้ว' : 'บันทึกกิจกรรมแล้ว', state.caseTimeline.id);
      setView(selectedTarget === 'case' ? 'cases' : 'today');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ', state.caseTimeline.id);
    }
  }, [
    followUpDays,
    includeWorker,
    materialAmount,
    note,
    refresh,
    selectedCategoryId,
    selectedMaterialId,
    selectedTarget,
    state,
    workerAmount,
  ]);

  const markCaseClosed = useCallback(async () => {
    if (state.status !== 'ready') return;
    await closeCase(state.db, state.caseTimeline.id);
    await refresh(state.db, 'ปิดเคสแล้ว', state.caseTimeline.id);
    setView('cases');
  }, [refresh, state]);

  const openCase = useCallback(async (caseId: string) => {
    if (state.status !== 'ready') return;
    setSelectedCaseId(caseId);
    await refresh(state.db, null, caseId);
    setView('cases');
  }, [refresh, state]);

  const settleFirstWorker = useCallback(async () => {
    if (state.status !== 'ready') return;
    const person = state.laborLedger.unpaidPeople[0];
    if (!person) return;
    await settleUnpaidLaborForPerson(state.db, person.personId);
    await refresh(state.db, `จ่ายค่าแรง ${person.displayName} แล้ว`);
    setView('labor');
  }, [refresh, state]);

  const activeTab = useMemo(() => {
    if (view === 'plot') return 'plots';
    if (view === 'activity') return 'activity';
    if (view === 'cases') return 'cases';
    if (view === 'labor' || view === 'materials' || view === 'hole' || view === 'menu') return 'menu';
    if (view === 'designLab') return 'menu';
    return 'today';
  }, [view]);

  if (view === 'designLab') {
    return <DesignLabScreen />;
  }

  if (state.status === 'loading') {
    return (
      <AppShell showTabs={false}>
        <View style={styles.center}>
          <ActivityIndicator color={tokens.color.primary.green} />
          <Text style={styles.muted}>กำลังเปิดสมุดสวนในเครื่อง</Text>
        </View>
      </AppShell>
    );
  }

  if (state.status === 'error') {
    return (
      <AppShell showTabs={false}>
        <TopBar title="ตาไก๊" actionLabel="ออฟไลน์" />
        <FieldCard variant="alert">
          <Text style={styles.cardTitle}>โหลดข้อมูลไม่ได้</Text>
          <Text style={styles.muted}>{state.message}</Text>
        </FieldCard>
      </AppShell>
    );
  }

  const { dashboard, options, message } = state;
  const plot = dashboard.plot;
  const screenTitle =
    view === 'plot'
      ? plot.name
      : view === 'activity'
        ? 'บันทึกกิจกรรม'
        : view === 'cases'
          ? 'เคส'
          : view === 'labor'
            ? 'ค่าแรง'
            : view === 'materials'
              ? 'วัสดุ'
              : view === 'hole'
                ? `หลุม ${state.holeDetail.marker}`
                : view === 'menu'
                  ? 'เมนู'
                : 'วันนี้';

  return (
    <AppShell activeTab={activeTab} onTabPress={(tab) => {
      if (tab === 'today') setView('today');
      if (tab === 'plots') setView('plot');
      if (tab === 'activity') setView('activity');
      if (tab === 'cases') setView('cases');
      if (tab === 'menu') setView('menu');
    }}>
      <TopBar title={screenTitle} actionLabel="ออฟไลน์" />

      {message ? <StatusChip label={message} variant={message.includes('ไม่') ? 'overdue' : 'active'} /> : null}

      {view === 'today' ? (
        <>
          <SectionHeader title={dashboard.gardenName} actionLabel="บันทึก" onActionPress={() => setView('activity')} />
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>ภาพรวมวันนี้</Text>
                <Text style={styles.title}>{plot.name}</Text>
                <Text style={styles.muted}>
                  {plot.activeCrop ? `${plot.activeCrop.label} · เปิดมา ${plot.activeCrop.activeDays} วัน` : 'ยังไม่มี crop active'}
                </Text>
              </View>
              <StatusChip label="Local" variant="offline" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="พื้นที่" value={`${plot.areaRai} ไร่`} />
              <Metric label="หลุมปลูก" value={`${plot.plantedHoles}/${plot.totalHoles}`} />
              <Metric label="ค้างจ่าย" value={`${dashboard.unpaidLaborTotal.toLocaleString('th-TH')} บาท`} danger={dashboard.unpaidLaborTotal > 0} />
            </View>
          </FieldCard>

          <PrimaryButton label="+ บันทึกกิจกรรม" onPress={() => setView('activity')} />

          <SectionHeader title="รายการล่าสุด" />
          <View style={styles.list}>
            {dashboard.recentItems.map((item) => (
              <RecordListItem
                key={item.id}
                meta={item.meta}
                title={item.title}
                trailing={item.trailing}
                variant={item.variant}
              />
            ))}
          </View>

          <SectionHeader title="Tracker สำคัญ" actionLabel="แปลง" onActionPress={() => setView('plot')} />
          {plot.trackers.map((tracker) => (
            <TrackerCard
              key={tracker.categoryId}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เคยบันทึก' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={tracker.nextDueOn ? formatThaiShortDate(tracker.nextDueOn) : undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.categoryId === 'cat-spray' ? 'spray' : tracker.categoryId === 'cat-fertilizer' ? 'fertilizer' : 'pruning'}
            />
          ))}

          <SectionHeader title="สมุดที่ต้องดู" />
          <View style={styles.quickGrid}>
            <QuickAction label="เคส" value={`${plot.activeCases.length} ติดตาม`} onPress={() => setView('cases')} />
            <QuickAction label="ค่าแรง" value={`${dashboard.unpaidLaborTotal.toLocaleString('th-TH')} บาท`} onPress={() => setView('labor')} />
            <QuickAction label="วัสดุ" value={`${state.materials.length} รายการ`} onPress={() => setView('materials')} />
          </View>
        </>
      ) : null}

      {view === 'plot' ? (
        <>
          <TopBar title={plot.name} variant="plot" actionLabel="วันนี้" onActionPress={() => setView('today')} />
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.eyebrow}>{plot.activeCrop?.label ?? 'ไม่มี crop active'}</Text>
                <Text style={styles.title}>{plot.areaRai} ไร่</Text>
              </View>
              <StatusChip label="Active" variant="active" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="หลุมทั้งหมด" value={`${plot.totalHoles}`} />
              <Metric label="หลุมปลูก" value={`${plot.plantedHoles}`} />
              <Metric label="หลุมว่าง" value={`${plot.emptyHoles}`} />
            </View>
          </FieldCard>

          <SectionHeader title="Tracker ที่ติดตาม" />
          {plot.trackers.map((tracker) => (
            <TrackerCard
              key={tracker.categoryId}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เริ่ม' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={tracker.nextDueOn ? formatThaiShortDate(tracker.nextDueOn) : undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.elapsedDays !== null && tracker.elapsedDays > 7 ? 'overdue' : 'custom'}
            />
          ))}

          <SectionHeader title="Active Cases" />
          <View style={styles.list}>
            {plot.activeCases.length ? (
              plot.activeCases.map((caseItem) => (
                <RecordListItem
                  key={caseItem.id}
                  meta={caseItem.targetLabel}
                  onPress={() => openCase(caseItem.id)}
                  title={caseItem.title}
                  trailing={caseItem.statusLabel}
                  variant="case"
                />
              ))
            ) : (
              <RecordListItem title="ยังไม่มีเคสที่ต้องติดตาม" meta="เมื่อเปิดเคส ระบบจะแสดงตรงนี้" trailing="ดี" variant="case" />
            )}
          </View>
          <PrimaryButton label={`ดูหลุม ${state.holeDetail.marker}`} onPress={() => setView('hole')} variant="secondary" />
        </>
      ) : null}

      {view === 'activity' ? (
        <>
          <SectionHeader title="1. เลือกหมวด" />
          <View style={styles.chipWrap}>
            {options.categories.map((category) => (
              <SelectPill
                active={category.id === selectedCategoryId}
                key={category.id}
                label={category.name}
                onPress={() => setSelectedCategoryId(category.id)}
              />
            ))}
          </View>

          <SectionHeader title="2. เป้าหมาย" />
          <View style={styles.chipWrap}>
            <SelectPill active={selectedTarget === 'plot'} label="ทั้งแปลง" onPress={() => setSelectedTarget('plot')} />
            <SelectPill active={selectedTarget === 'hole'} label={state.holeDetail.marker} onPress={() => setSelectedTarget('hole')} />
            <SelectPill active={selectedTarget === 'case'} label={state.caseTimeline.title} onPress={() => setSelectedTarget('case')} />
          </View>

          <SectionHeader title="3. รายละเอียด" />
          <FieldCard>
            <Text style={styles.inputLabel}>บันทึก</Text>
            <TextInput multiline onChangeText={setNote} style={[styles.input, styles.textArea]} value={note} />
            <Text style={styles.inputLabel}>วัสดุ</Text>
            <View style={styles.chipWrap}>
              {options.materials.slice(0, 4).map((material) => (
                <SelectPill
                  active={material.id === selectedMaterialId}
                  key={material.id}
                  label={material.name}
                  onPress={() => setSelectedMaterialId(material.id)}
                />
              ))}
            </View>
            <View style={styles.formRow}>
              <View style={styles.formCell}>
                <Text style={styles.inputLabel}>ปริมาณ</Text>
                <TextInput keyboardType="numeric" onChangeText={setMaterialAmount} style={styles.input} value={materialAmount} />
              </View>
              <View style={styles.formCell}>
                <Text style={styles.inputLabel}>ติดตามอีกกี่วัน</Text>
                <TextInput keyboardType="numeric" onChangeText={setFollowUpDays} style={styles.input} value={followUpDays} />
              </View>
            </View>
          </FieldCard>

          <SectionHeader title="4. ค่าแรง" />
          <FieldCard>
            <Pressable onPress={() => setIncludeWorker((value) => !value)} style={styles.toggleRow}>
              <StatusChip label={includeWorker ? 'มีคนงาน' : 'ทำเอง'} variant={includeWorker ? 'unpaid' : 'paid'} />
              <Text style={styles.muted}>{includeWorker ? 'สร้างรายการค้างจ่ายจากกิจกรรมนี้' : 'ไม่คิดค่าแรง แต่ยังเก็บประวัติงาน'}</Text>
            </Pressable>
            {includeWorker ? (
              <>
                <Text style={styles.inputLabel}>ค่าแรง</Text>
                <TextInput keyboardType="numeric" onChangeText={setWorkerAmount} style={styles.input} value={workerAmount} />
              </>
            ) : null}
          </FieldCard>

          <PrimaryButton label="บันทึกกิจกรรมลงเครื่อง" onPress={() => createActivity('field')} />
          <PrimaryButton label="กลับวันนี้" onPress={() => setView('today')} variant="secondary" />
        </>
      ) : null}

      {view === 'menu' ? (
        <>
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>{state.menuDashboard.gardenName}</Text>
                <Text style={styles.title}>สมุดจัดการสวน</Text>
                <Text style={styles.muted}>ทุกอย่างเก็บในเครื่องก่อน ยังไม่ sync cloud</Text>
              </View>
              <StatusChip label={state.menuDashboard.localStatusLabel} variant="offline" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="เคสติดตาม" value={`${state.menuDashboard.activeCaseCount}`} />
              <Metric label="ค่าแรงค้าง" value={`${state.menuDashboard.unpaidLaborTotal.toLocaleString('th-TH')}`} danger={state.menuDashboard.unpaidLaborTotal > 0} />
              <Metric label="วัสดุ" value={`${state.menuDashboard.materialCount}`} />
            </View>
          </FieldCard>

          <SectionHeader title="ไปทำงานต่อ" />
          <View style={styles.list}>
            <RecordListItem
              meta={`${state.menuDashboard.activeCaseCount} เคสติดตาม · ${state.menuDashboard.closedCaseCount} เก็บประวัติ`}
              onPress={() => setView('cases')}
              title="เคส"
              trailing="เปิด"
              variant="case"
            />
            <RecordListItem
              meta={`${state.laborLedger.unpaidPeople.length} คน · ${state.laborLedger.unpaidTotal.toLocaleString('th-TH')} บาท`}
              onPress={() => setView('labor')}
              title="ค่าแรง"
              trailing="เปิด"
              variant="labor"
            />
            <RecordListItem
              meta={`${state.materials.length} รายการ · ใช้เลือกตอนบันทึกกิจกรรม`}
              onPress={() => setView('materials')}
              title="วัสดุ"
              trailing="เปิด"
              variant="material"
            />
            <RecordListItem
              meta={`${state.menuDashboard.plotCount} แปลง · ${state.menuDashboard.holeCount} หลุม`}
              onPress={() => setView('plot')}
              title="แปลงและหลุม"
              trailing="เปิด"
              variant="hole"
            />
          </View>

          <SectionHeader title="ระบบ" />
          <View style={styles.list}>
            <RecordListItem title="สำรองข้อมูล" meta="เตรียมไว้สำหรับ export/local backup ใน phase ถัดไป" trailing="เร็วๆ นี้" variant="activity" />
            <RecordListItem title="Design Lab" meta="พื้นที่ตรวจ primitive สำหรับนักพัฒนา" onPress={() => setView('designLab')} trailing="Dev" variant="activity" />
          </View>
        </>
      ) : null}

      {view === 'cases' ? (
        <>
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>{state.caseTimeline.targetLabel}</Text>
                <Text style={styles.title}>{state.caseTimeline.title}</Text>
                <Text style={styles.muted}>
                  เปิด {formatThaiShortDate(state.caseTimeline.openedAt)}
                  {state.caseTimeline.closedAt ? ` · ปิด ${formatThaiShortDate(state.caseTimeline.closedAt)}` : ''}
                </Text>
              </View>
              <StatusChip label={caseStatusLabel(state.caseTimeline.status)} variant={caseStatusVariant(state.caseTimeline.status)} />
            </View>
          </FieldCard>

          <SectionHeader title="เคสทั้งหมด" />
          <View style={styles.list}>
            {state.caseList.map((caseItem) => (
              <RecordListItem
                key={caseItem.id}
                meta={`${caseItem.targetLabel} · ${caseItem.entryCount} บันทึก`}
                onPress={() => openCase(caseItem.id)}
                title={caseItem.title}
                trailing={caseItem.statusLabel}
                variant="case"
              />
            ))}
          </View>

          <SectionHeader title="ไทม์ไลน์เคส" actionLabel={state.caseTimeline.status === 'tracking' ? 'เพิ่มบันทึก' : undefined} onActionPress={() => {
            setSelectedTarget('case');
            setView('activity');
          }} />
          <FieldCard>
            <EvidenceTimeline
              items={state.caseTimeline.entries.map((entry) => ({
                id: entry.id,
                dateLabel: formatThaiShortDate(entry.performedAt),
                dayLabel: entry.dayLabel,
                title: entry.title,
                note: entry.meta,
              }))}
              variant="case"
            />
          </FieldCard>
          {state.caseTimeline.status === 'tracking' ? (
            <PrimaryButton label="ปิดเคส" onPress={markCaseClosed} variant="secondary" />
          ) : null}
          <PrimaryButton label="กลับเมนู" onPress={() => setView('menu')} variant="secondary" />
        </>
      ) : null}

      {view === 'labor' ? (
        <>
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>ค่าแรงค้างจ่าย</Text>
            <Text style={styles.title}>{state.laborLedger.unpaidTotal.toLocaleString('th-TH')} บาท</Text>
            <Text style={styles.muted}>{state.laborLedger.unpaidPeople.length} คนที่ต้องเคลียร์</Text>
          </FieldCard>
          <SectionHeader title="ค้างจ่าย" />
          <View style={styles.list}>
            {state.laborLedger.unpaidPeople.length ? (
              state.laborLedger.unpaidPeople.map((person) => (
                <RecordListItem
                  key={person.personId}
                  meta={`${person.unpaidCount} รายการ · ล่าสุด ${formatThaiShortDate(person.latestWorkDate)}`}
                  title={person.displayName}
                  trailing={`${person.unpaidTotal.toLocaleString('th-TH')} บาท`}
                  variant="labor"
                />
              ))
            ) : (
              <RecordListItem title="ไม่มีค่าแรงค้างจ่าย" meta="งานที่ทำเองยังเก็บประวัติ แต่ไม่สร้างยอดจ่าย" trailing="จบ" variant="labor" />
            )}
          </View>
          <PrimaryButton disabled={!state.laborLedger.unpaidPeople.length} label="จ่ายคนแรกทั้งหมด" onPress={settleFirstWorker} />
        </>
      ) : null}

      {view === 'materials' ? (
        <>
          <SectionHeader title="วัสดุ" actionLabel="บันทึก" onActionPress={() => setView('activity')} />
          <View style={styles.list}>
            {state.materials.map((material) => (
              <RecordListItem
                key={material.id}
                meta={`${material.defaultRatePerTank ?? 'ยังไม่ตั้งอัตรา'} · ใช้แล้ว ${material.usageCount} ครั้ง`}
                title={material.name}
                trailing={material.lastUsedAt ? formatThaiShortDate(material.lastUsedAt) : material.unit}
                variant="material"
              />
            ))}
          </View>
          <PrimaryButton label="ดู Design Lab" onPress={() => setView('designLab')} variant="secondary" />
        </>
      ) : null}

      {view === 'hole' ? (
        <>
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>{state.holeDetail.plotName}</Text>
            <Text style={styles.title}>หลุม {state.holeDetail.marker}</Text>
            <Text style={styles.muted}>
              {state.holeDetail.plantName
                ? `${state.holeDetail.plantName} · อายุ ${state.holeDetail.ageDays ?? 0} วัน`
                : 'ยังไม่มีต้นปลูก'}
            </Text>
          </FieldCard>
          <SectionHeader title="เคสในหลุม" />
          <View style={styles.list}>
            {state.holeDetail.activeCases.map((caseItem) => (
              <RecordListItem key={caseItem.id} meta={caseItem.targetLabel} title={caseItem.title} trailing={caseItem.statusLabel} variant="case" />
            ))}
          </View>
          <SectionHeader title="ประวัติหลุม" actionLabel="เพิ่ม" onActionPress={() => {
            setSelectedTarget('hole');
            setView('activity');
          }} />
          <View style={styles.list}>
            {state.holeDetail.activities.length ? (
              state.holeDetail.activities.map((activity) => (
                <RecordListItem key={activity.id} meta={activity.meta} title={activity.title} trailing={activity.trailing} variant="hole" />
              ))
            ) : (
              <RecordListItem title="ยังไม่มีประวัติกิจกรรมในหลุมนี้" meta="บันทึกกิจกรรมแล้วจะมาอยู่ตรงนี้" trailing="เริ่ม" variant="hole" />
            )}
          </View>
        </>
      ) : null}
    </AppShell>
  );
}

function Metric({ danger, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={[styles.metricLabel, danger && styles.danger]}>{label}</Text>
    </View>
  );
}

function caseStatusLabel(status: CaseTimeline['status']) {
  if (status === 'tracking') return 'ติดตามอยู่';
  if (status === 'closed') return 'ปิดเคส';
  return 'เก็บเข้าแฟ้ม';
}

function caseStatusVariant(status: CaseTimeline['status']) {
  if (status === 'tracking') return 'active';
  if (status === 'closed') return 'closed';
  return 'archived';
}

function SelectPill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.selectPill, active && styles.selectPillActive]}>
      <Text style={[styles.selectPillText, active && styles.selectPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function QuickAction({ label, onPress, value }: { label: string; onPress: () => void; value: string }) {
  return (
    <Pressable onPress={onPress} style={styles.quickAction}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: tokens.spacing.row,
    paddingVertical: 48,
  },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.row,
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
  },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h1.size,
    fontWeight: '700',
    marginTop: 2,
  },
  cardTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  muted: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
    lineHeight: 21,
    marginTop: 4,
  },
  summaryGrid: {
    borderTopColor: tokens.color.border.soft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.control,
    marginTop: tokens.spacing.card,
    paddingTop: tokens.spacing.card,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  metricLabel: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
    marginTop: 2,
  },
  danger: {
    color: tokens.color.state.danger,
  },
  list: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.control,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
  },
  quickAction: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    flex: 1,
    minHeight: 74,
    justifyContent: 'center',
    padding: tokens.spacing.control,
  },
  selectPill: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.chip,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectPillActive: {
    backgroundColor: '#EAF4EA',
    borderColor: tokens.color.primary.green,
  },
  selectPillText: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  selectPillTextActive: {
    color: tokens.color.primary.green,
  },
  inputLabel: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: tokens.color.surface.muted,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    color: tokens.color.text.primary,
    fontSize: tokens.typography.body.size,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
  },
  formCell: {
    flex: 1,
  },
  toggleRow: {
    gap: 4,
  },
});
