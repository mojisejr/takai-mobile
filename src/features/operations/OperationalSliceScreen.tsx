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
  createActivityCategory,
  createDemoSprayActivity,
  createFieldActivity,
  createPerson,
  formatThaiShortDate,
  getActivityCaptureOptions,
  getCaseList,
  getCaseTimeline,
  getHoleDetail,
  getLaborLedger,
  getMenuDashboard,
  getMaterialLibrary,
  getTodayDashboard,
  archiveActivityCategory,
  archivePerson,
  listActivityCategories,
  listPeople,
  nextDateFrom,
  pinPlotTracker,
  restoreActivityCategory,
  restorePerson,
  settleUnpaidLaborForPerson,
  unpinPlotTracker,
  updateActivityCategory,
  updatePerson,
  type ActivityCaptureOption,
  type CategoryInput,
  type CaseListItem,
  type CaseTimeline,
  type HoleDetail,
  type LaborLedger,
  type MenuDashboard,
  type MaterialLibraryItem,
  type TakaiView,
  type TodayDashboard,
  type PersonDirectoryItem,
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
      categories: Awaited<ReturnType<typeof listActivityCategories>>;
      people: PersonDirectoryItem[];
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
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workerAmount, setWorkerAmount] = useState('600');
  const [selectedCaseId, setSelectedCaseId] = useState('case-a-014');
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [showArchivedPeople, setShowArchivedPeople] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryInput>({ id: '', name: '', kind: 'other' });
  const [personDraft, setPersonDraft] = useState({ id: '', displayName: '', specialty: '', phone: '', note: '' });
  const [showInlineCategoryForm, setShowInlineCategoryForm] = useState(false);
  const [showInlineWorkerForm, setShowInlineWorkerForm] = useState(false);
  const [settlePersonId, setSettlePersonId] = useState<string | null>(null);

  const refresh = useCallback(async (db: TakaiDatabase, message: string | null = null, caseId = selectedCaseId) => {
    const [dashboard, options, caseList, laborLedger, menuDashboard, materials, holeDetail, categories, people] = await Promise.all([
      getTodayDashboard(db),
      getActivityCaptureOptions(db),
      getCaseList(db),
      getLaborLedger(db),
      getMenuDashboard(db),
      getMaterialLibrary(db),
      getHoleDetail(db),
      listActivityCategories(db, true),
      listPeople(db, true),
    ]);
    const resolvedCaseId = caseList.some((caseItem) => caseItem.id === caseId) ? caseId : caseList[0]?.id ?? 'case-a-014';
    const caseTimeline = await getCaseTimeline(db, resolvedCaseId);
    setSelectedCaseId(resolvedCaseId);
    setState({ status: 'ready', db, dashboard, options, caseList, caseTimeline, laborLedger, menuDashboard, materials, holeDetail, categories, people, message });
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

  const saveCategory = useCallback(async (fromActivity = false) => {
    if (state.status !== 'ready') return;
    try {
      const input = { name: categoryDraft.name, kind: categoryDraft.kind };
      const categoryId = categoryDraft.id
        ? (await updateActivityCategory(state.db, categoryDraft.id, input), categoryDraft.id)
        : await createActivityCategory(state.db, input);
      await refresh(state.db, categoryDraft.id ? 'แก้ไขหมวดงานแล้ว' : 'เพิ่มหมวดงานแล้ว');
      setSelectedCategoryId(categoryId);
      setCategoryDraft({ id: '', name: '', kind: 'other' });
      setShowInlineCategoryForm(false);
      if (!fromActivity) setView('categories');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกหมวดงานไม่สำเร็จ');
    }
  }, [categoryDraft, refresh, state]);

  const saveWorker = useCallback(async (fromActivity = false) => {
    if (state.status !== 'ready') return;
    try {
      const input = {
        displayName: personDraft.displayName,
        role: 'worker' as const,
        isSelf: false,
        specialty: personDraft.specialty,
        phone: personDraft.phone,
        note: personDraft.note,
      };
      const personId = personDraft.id
        ? (await updatePerson(state.db, personDraft.id, input), personDraft.id)
        : await createPerson(state.db, input);
      await refresh(state.db, personDraft.id ? 'แก้ไขข้อมูลคนงานแล้ว' : 'เพิ่มคนงานแล้ว');
      setSelectedWorkerId(personId);
      setPersonDraft({ id: '', displayName: '', specialty: '', phone: '', note: '' });
      setShowInlineWorkerForm(false);
      if (!fromActivity) setView('workers');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกคนงานไม่สำเร็จ');
    }
  }, [personDraft, refresh, state]);

  const toggleCategoryArchive = useCallback(async (categoryId: string, archivedAt: string | null) => {
    if (state.status !== 'ready') return;
    if (archivedAt) await restoreActivityCategory(state.db, categoryId);
    else await archiveActivityCategory(state.db, categoryId);
    await refresh(state.db, archivedAt ? 'นำหมวดงานกลับมาใช้แล้ว' : 'เก็บหมวดงานเข้าแฟ้มแล้ว');
  }, [refresh, state]);

  const togglePersonArchive = useCallback(async (personId: string, archivedAt: string | null) => {
    if (state.status !== 'ready') return;
    if (archivedAt) await restorePerson(state.db, personId);
    else await archivePerson(state.db, personId);
    await refresh(state.db, archivedAt ? 'นำคนงานกลับมาใช้แล้ว' : 'เก็บคนงานเข้าแฟ้มแล้ว');
    if (!archivedAt && selectedWorkerId === personId) setSelectedWorkerId(null);
  }, [refresh, selectedWorkerId, state]);

  const toggleTracker = useCallback(async (categoryId: string, pinned: boolean) => {
    if (state.status !== 'ready') return;
    if (pinned) await unpinPlotTracker(state.db, state.dashboard.plot.id, categoryId);
    else await pinPlotTracker(state.db, state.dashboard.plot.id, categoryId);
    await refresh(state.db, pinned ? 'หยุดติดตามหมวดงานนี้ในแปลงแล้ว' : 'เพิ่ม Tracker ของแปลงแล้ว');
  }, [refresh, state]);

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
            selectedWorkerId
              ? {
                  personId: selectedWorkerId,
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
    materialAmount,
    note,
    refresh,
    selectedCategoryId,
    selectedMaterialId,
    selectedTarget,
    selectedWorkerId,
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

  const settleSelectedWorker = useCallback(async () => {
    if (state.status !== 'ready') return;
    const person = state.laborLedger.unpaidPeople.find((item) => item.personId === settlePersonId);
    if (!person) return;
    await settleUnpaidLaborForPerson(state.db, person.personId);
    await refresh(state.db, `จ่ายค่าแรง ${person.displayName} แล้ว`);
    setSettlePersonId(null);
    setView('labor');
  }, [refresh, settlePersonId, state]);

  const activeTab = useMemo(() => {
    if (view === 'plot' || view === 'trackerManage') return 'plots';
    if (view === 'activity') return 'activity';
    if (view === 'cases') return 'cases';
    if (view === 'labor' || view === 'materials' || view === 'hole' || view === 'menu' || view === 'categories' || view === 'workers') return 'menu';
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
                  : view === 'categories'
                    ? 'หมวดงาน'
                    : view === 'workers'
                      ? 'คนงาน'
                      : view === 'trackerManage'
                        ? 'จัดการ Tracker'
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

          <SectionHeader title="Tracker ที่ติดตาม" actionLabel="จัดการ" onActionPress={() => setView('trackerManage')} />
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

      {view === 'trackerManage' ? (
        <>
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>{plot.name}</Text>
            <Text style={styles.cardTitle}>Tracker ของแปลงนี้</Text>
            <Text style={styles.muted}>เลือกหมวดงานที่อยากติดตามเฉพาะแปลงนี้ การหยุดติดตามไม่ลบประวัติกิจกรรมเดิม</Text>
          </FieldCard>
          <SectionHeader title="หมวดงานที่ติดตามได้" />
          <View style={styles.list}>
            {options.categories.map((category) => {
              const pinned = plot.trackers.some((tracker) => tracker.categoryId === category.id);
              return (
                <RecordListItem
                  key={category.id}
                  meta={pinned ? 'ติดตามในแปลงนี้อยู่' : 'ยังไม่ติดตามในแปลงนี้'}
                  onPress={() => void toggleTracker(category.id, pinned)}
                  title={category.name}
                  trailing={pinned ? 'หยุดติดตาม' : 'เพิ่ม'}
                  variant="activity"
                />
              );
            })}
          </View>
          <PrimaryButton label="กลับแปลง" onPress={() => setView('plot')} variant="secondary" />
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
          <PrimaryButton
            label={showInlineCategoryForm ? 'ซ่อนแบบฟอร์มเพิ่มหมวดงาน' : '+ เพิ่มหมวดงาน'}
            onPress={() => setShowInlineCategoryForm((value) => !value)}
            variant="tertiary"
          />
          {showInlineCategoryForm ? (
            <FieldCard>
              <Text style={styles.inputLabel}>ชื่อหมวดงาน</Text>
              <TextInput onChangeText={(name) => setCategoryDraft({ id: '', name, kind: 'other' })} style={styles.input} value={categoryDraft.name} />
              <Text style={styles.muted}>เพิ่มแล้วจะเลือกใช้ในบันทึกนี้ทันที</Text>
              <PrimaryButton label="เพิ่มและเลือกหมวดงาน" onPress={() => void saveCategory(true)} />
            </FieldCard>
          ) : null}

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

          <SectionHeader title="4. ผู้ร่วมงานและค่าแรง" />
          <FieldCard>
            <StatusChip label="เจ้าของสวน · ไม่คิดค่าแรง" variant="paid" />
            <Text style={styles.muted}>งานที่ทำเองจะเก็บในประวัติกิจกรรม แต่ไม่สร้างยอดค้างจ่าย</Text>
            <Text style={styles.inputLabel}>เลือกคนงาน</Text>
            <View style={styles.chipWrap}>
              <SelectPill active={selectedWorkerId === null} label="ทำเอง" onPress={() => setSelectedWorkerId(null)} />
              {options.people.filter((person) => !person.isSelf && person.role === 'worker').map((person) => (
                <SelectPill
                  active={selectedWorkerId === person.id}
                  key={person.id}
                  label={person.displayName}
                  onPress={() => setSelectedWorkerId(person.id)}
                />
              ))}
            </View>
            <PrimaryButton
              label={showInlineWorkerForm ? 'ซ่อนแบบฟอร์มเพิ่มคนงาน' : '+ เพิ่มคนงาน'}
              onPress={() => setShowInlineWorkerForm((value) => !value)}
              variant="tertiary"
            />
            {showInlineWorkerForm ? (
              <View style={styles.inlineForm}>
                <Text style={styles.inputLabel}>ชื่อคนงาน</Text>
                <TextInput onChangeText={(displayName) => setPersonDraft((draft) => ({ ...draft, id: '', displayName }))} style={styles.input} value={personDraft.displayName} />
                <Text style={styles.inputLabel}>งานที่ถนัด (ถ้ามี)</Text>
                <TextInput onChangeText={(specialty) => setPersonDraft((draft) => ({ ...draft, specialty }))} style={styles.input} value={personDraft.specialty} />
                <Text style={styles.inputLabel}>เบอร์โทร (ถ้ามี)</Text>
                <TextInput keyboardType="phone-pad" onChangeText={(phone) => setPersonDraft((draft) => ({ ...draft, phone }))} style={styles.input} value={personDraft.phone} />
                <PrimaryButton label="เพิ่มและเลือกคนงาน" onPress={() => void saveWorker(true)} />
              </View>
            ) : null}
            {selectedWorkerId ? (
              <>
                <Text style={styles.inputLabel}>ค่าแรง</Text>
                <TextInput keyboardType="numeric" onChangeText={setWorkerAmount} style={styles.input} value={workerAmount} />
                <Text style={styles.muted}>จะสร้างยอดค้างจ่ายสำหรับคนงานที่เลือกเท่านั้น</Text>
              </>
            ) : <Text style={styles.muted}>เลือก “ทำเอง” จึงไม่มีค่าแรงค้างจ่าย</Text>}
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
              meta={`${state.categories.filter((category) => !category.archivedAt).length} หมวดใช้งาน · เก็บเข้าแฟ้มได้โดยไม่ลบประวัติ`}
              onPress={() => setView('categories')}
              title="หมวดงาน"
              trailing="จัดการ"
              variant="activity"
            />
            <RecordListItem
              meta={`${state.people.filter((person) => !person.archivedAt && !person.isSelf).length} คนงาน · เพิ่มแล้วเลือกใช้ตอนบันทึกได้`}
              onPress={() => setView('workers')}
              title="คนงาน"
              trailing="จัดการ"
              variant="labor"
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

      {view === 'categories' ? (
        <>
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>สมุดหมวดงาน</Text>
            <Text style={styles.cardTitle}>หมวดที่ใช้ตอนบันทึกกิจกรรม</Text>
            <Text style={styles.muted}>เก็บเข้าแฟ้มจะซ่อนจากการบันทึกใหม่ แต่ประวัติกิจกรรมเดิมยังอยู่ครบ</Text>
          </FieldCard>
          <SectionHeader title={categoryDraft.id ? 'แก้ไขหมวดงาน' : 'เพิ่มหมวดงาน'} />
          <FieldCard>
            <Text style={styles.inputLabel}>ชื่อหมวดงาน</Text>
            <TextInput onChangeText={(name) => setCategoryDraft((draft) => ({ ...draft, name }))} style={styles.input} value={categoryDraft.name} />
            <PrimaryButton label={categoryDraft.id ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดงาน'} onPress={() => void saveCategory()} />
            {categoryDraft.id ? <PrimaryButton label="ยกเลิกการแก้ไข" onPress={() => setCategoryDraft({ id: '', name: '', kind: 'other' })} variant="tertiary" /> : null}
          </FieldCard>
          <SectionHeader
            title={showArchivedCategories ? 'หมวดงานในแฟ้ม' : 'หมวดงานที่ใช้งาน'}
            actionLabel={showArchivedCategories ? 'ดูที่ใช้งาน' : 'ดูในแฟ้ม'}
            onActionPress={() => setShowArchivedCategories((value) => !value)}
          />
          <View style={styles.list}>
            {state.categories.filter((category) => Boolean(category.archivedAt) === showArchivedCategories).map((category) => (
              <View key={category.id} style={styles.directoryRow}>
                <RecordListItem
                  meta={category.archivedAt ? 'อยู่ในแฟ้ม · ประวัติเดิมยังอ่านได้' : 'ใช้เลือกตอนบันทึกกิจกรรม'}
                  onPress={() => setCategoryDraft({ id: category.id, name: category.name, kind: category.kind })}
                  title={category.name}
                  trailing={category.archivedAt ? 'แก้ไข/กู้คืน' : 'แก้ไข'}
                  variant="activity"
                />
                <PrimaryButton
                  label={category.archivedAt ? 'นำกลับมาใช้' : 'เก็บเข้าแฟ้ม'}
                  onPress={() => void toggleCategoryArchive(category.id, category.archivedAt ?? null)}
                  variant={category.archivedAt ? 'secondary' : 'tertiary'}
                />
              </View>
            ))}
          </View>
          <PrimaryButton label="กลับเมนู" onPress={() => setView('menu')} variant="secondary" />
        </>
      ) : null}

      {view === 'workers' ? (
        <>
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>คลังข้อมูลคนงาน</Text>
            <Text style={styles.cardTitle}>คนงานที่เรียกใช้ซ้ำได้</Text>
            <Text style={styles.muted}>ชื่อจำเป็น ส่วนงานที่ถนัด เบอร์โทร และโน้ตเป็นข้อมูลช่วยจำในสมุดสวน</Text>
          </FieldCard>
          <SectionHeader title={personDraft.id ? 'แก้ไขข้อมูลคนงาน' : 'เพิ่มคนงาน'} />
          <FieldCard>
            <Text style={styles.inputLabel}>ชื่อคนงาน</Text>
            <TextInput onChangeText={(displayName) => setPersonDraft((draft) => ({ ...draft, displayName }))} style={styles.input} value={personDraft.displayName} />
            <Text style={styles.inputLabel}>งานที่ถนัด</Text>
            <TextInput onChangeText={(specialty) => setPersonDraft((draft) => ({ ...draft, specialty }))} style={styles.input} value={personDraft.specialty} />
            <Text style={styles.inputLabel}>เบอร์โทร</Text>
            <TextInput keyboardType="phone-pad" onChangeText={(phone) => setPersonDraft((draft) => ({ ...draft, phone }))} style={styles.input} value={personDraft.phone} />
            <Text style={styles.inputLabel}>โน้ต</Text>
            <TextInput multiline onChangeText={(note) => setPersonDraft((draft) => ({ ...draft, note }))} style={[styles.input, styles.textArea]} value={personDraft.note} />
            <PrimaryButton label={personDraft.id ? 'บันทึกการแก้ไข' : 'เพิ่มคนงาน'} onPress={() => void saveWorker()} />
            {personDraft.id ? <PrimaryButton label="ยกเลิกการแก้ไข" onPress={() => setPersonDraft({ id: '', displayName: '', specialty: '', phone: '', note: '' })} variant="tertiary" /> : null}
          </FieldCard>
          <SectionHeader
            title={showArchivedPeople ? 'คนงานในแฟ้ม' : 'คนงานที่ใช้งาน'}
            actionLabel={showArchivedPeople ? 'ดูที่ใช้งาน' : 'ดูในแฟ้ม'}
            onActionPress={() => setShowArchivedPeople((value) => !value)}
          />
          <View style={styles.list}>
            {state.people.filter((person) => !person.isSelf && Boolean(person.archivedAt) === showArchivedPeople).map((person) => (
              <View key={person.id} style={styles.directoryRow}>
                <RecordListItem
                  meta={[person.specialty, person.phone].filter(Boolean).join(' · ') || (person.archivedAt ? 'อยู่ในแฟ้ม · ประวัติเดิมยังอ่านได้' : 'ยังไม่มีรายละเอียดเพิ่ม')}
                  onPress={() => setPersonDraft({ id: person.id, displayName: person.displayName, specialty: person.specialty, phone: person.phone, note: person.note })}
                  title={person.displayName}
                  trailing={person.archivedAt ? 'แก้ไข/กู้คืน' : 'แก้ไข'}
                  variant="labor"
                />
                <PrimaryButton
                  label={person.archivedAt ? 'นำกลับมาใช้' : 'เก็บเข้าแฟ้ม'}
                  onPress={() => void togglePersonArchive(person.id, person.archivedAt)}
                  variant={person.archivedAt ? 'secondary' : 'tertiary'}
                />
              </View>
            ))}
          </View>
          <PrimaryButton label="กลับเมนู" onPress={() => setView('menu')} variant="secondary" />
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
                  meta={`จากกิจกรรม ${person.sourceCount} รายการ · ล่าสุด ${formatThaiShortDate(person.latestWorkDate)}`}
                  onPress={() => setSettlePersonId(person.personId)}
                  title={person.displayName}
                  trailing={`${person.unpaidTotal.toLocaleString('th-TH')} บาท`}
                  variant="labor"
                />
              ))
            ) : (
              <RecordListItem title="ไม่มีค่าแรงค้างจ่าย" meta="งานที่ทำเองยังเก็บประวัติ แต่ไม่สร้างยอดจ่าย" trailing="จบ" variant="labor" />
            )}
          </View>
          {settlePersonId ? (() => {
            const person = state.laborLedger.unpaidPeople.find((item) => item.personId === settlePersonId);
            return person ? (
              <FieldCard variant="alert">
                <Text style={styles.cardTitle}>ยืนยันการจ่ายค่าแรง</Text>
                <Text style={styles.muted}>
                  {person.displayName} · จากกิจกรรม {person.sourceCount} รายการ · ยอด {person.unpaidTotal.toLocaleString('th-TH')} บาท
                </Text>
                <Text style={styles.confirmationNote}>การยืนยันจะบันทึกสถานะว่าจ่ายแล้ว ไม่ลบกิจกรรมหรือประวัติค่าแรงเดิม</Text>
                <PrimaryButton label={`ยืนยันจ่าย ${person.unpaidTotal.toLocaleString('th-TH')} บาท`} onPress={() => void settleSelectedWorker()} />
                <PrimaryButton label="ยังไม่จ่าย" onPress={() => setSettlePersonId(null)} variant="secondary" />
              </FieldCard>
            ) : null;
          })() : <Text style={styles.muted}>แตะชื่อคนงานเพื่อดูที่มาและยืนยันก่อนจ่าย</Text>}
          <SectionHeader title="ประวัติที่จ่ายแล้ว" />
          <View style={styles.list}>
            {state.laborLedger.recentPaid.length ? state.laborLedger.recentPaid.map((entry) => (
              <RecordListItem key={entry.id} meta={`บันทึกไว้ ${formatThaiShortDate(entry.paidAt)} · ประวัติยังอ่านได้`} title={entry.displayName} trailing={`${entry.amountPaid.toLocaleString('th-TH')} บาท`} variant="labor" />
            )) : <RecordListItem title="ยังไม่มีรายการจ่ายแล้ว" meta="เมื่อยืนยันการจ่าย ประวัติจะเก็บอยู่ตรงนี้" trailing="ประวัติ" variant="labor" />}
          </View>
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
  inlineForm: {
    borderTopColor: tokens.color.border.soft,
    borderTopWidth: 1,
    marginTop: tokens.spacing.control,
    paddingTop: tokens.spacing.control,
  },
  directoryRow: {
    borderBottomColor: tokens.color.border.soft,
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  confirmationNote: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.metadata.size,
    lineHeight: 21,
    marginTop: tokens.spacing.control,
  },
});
