import { useCallback, useEffect, useMemo, useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { initializeTakaiDatabase, type TakaiDatabase } from '../../data';
import { tokens } from '../../theme/tokens';
import {
  AppShell,
  EvidenceTimeline,
  FieldCard,
  FormSection,
  PickerField,
  PrimaryButton,
  RecordListItem,
  SearchPickerSheet,
  SectionHeader,
  StatusChip,
  TopBar,
  TrackerCard,
  StickySaveBar,
  type PickerOption,
} from '../../ui';
import { DesignLabScreen } from '../design-lab/DesignLabScreen';
import {
  closeCase,
  createHole,
  createPlanting,
  createPlot,
  createActivityCategory,
  createDemoSprayActivity,
  createFieldActivity,
  createMaterial,
  calculateChemicalDose,
  createPerson,
  formatThaiShortDate,
  formatFollowUpDueLabel,
  followUpDaysRemaining,
  getActivityCaptureOptions,
  getCaseList,
  getCaseTimeline,
  getHoleDetail,
  getLaborLedger,
  getMenuDashboard,
  getMaterialLibrary,
  getTodayDashboard,
  archiveActivityCategory,
  archiveMaterial,
  archivePerson,
  listActivityCategories,
  listPeople,
  resolveFollowUpOn,
  pinPlotTracker,
  restoreActivityCategory,
  restoreMaterial,
  restorePerson,
  settleUnpaidLaborForPerson,
  syncFollowUpReminder,
  unpinPlotTracker,
  updateActivityCategory,
  updateMaterial,
  updatePerson,
  type ActivityCaptureOption,
  type CategoryInput,
  type CaseListItem,
  type CaseTimeline,
  type HoleDetail,
  type HoleInput,
  type PlantingInput,
  type PlotInput,
  type LaborLedger,
  type MenuDashboard,
  type MaterialLibraryItem,
  type MaterialInput,
  type TakaiView,
  type TodayDashboard,
  type PersonDirectoryItem,
} from './index';
import {
  configureFollowUpNotifications,
  expoFollowUpNotificationGateway,
  getFollowUpNotificationPermission,
  requestFollowUpNotificationPermission,
} from './expoNotifications';

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
      holeDetail: HoleDetail | null;
      categories: Awaited<ReturnType<typeof listActivityCategories>>;
      people: PersonDirectoryItem[];
      message: string | null;
    }
  | { status: 'error'; message: string };

type ActivityPicker = 'category' | 'plot' | 'target' | 'material' | 'worker' | 'payType';
type WorkerDraft = { key: string; personId: string; payType: 'none' | 'daily' | 'hourly' | 'piece' | 'contract'; amount: string };
type MaterialUsageDraft = { key: string; materialId: string; amount: string; unit: string; waterVolume: string; waterUnit: string; dilutionText: string; note: string; actualTankLitres: string; manualAmount: string };

export function OperationalSliceScreen() {
  const [view, setView] = useState<TakaiView>('today');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('cat-spray');
  const [selectedTarget, setSelectedTarget] = useState<'plot' | 'hole' | 'case'>('hole');
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [activityDateDraft, setActivityDateDraft] = useState(new Date().toISOString().slice(0, 10));
  const [timeMode, setTimeMode] = useState<'all_day' | 'time_range' | 'duration_only'>('all_day');
  const [startedAtDraft, setStartedAtDraft] = useState('08:00');
  const [endedAtDraft, setEndedAtDraft] = useState('17:00');
  const [durationMinutesDraft, setDurationMinutesDraft] = useState('60');
  const [showTimeDetails, setShowTimeDetails] = useState(false);
  const [showMaterialDetails, setShowMaterialDetails] = useState(false);
  const [showWorkerDetails, setShowWorkerDetails] = useState(false);
  const [showFollowUpDetails, setShowFollowUpDetails] = useState(false);
  const [note, setNote] = useState('พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม');
  const [followUpMode, setFollowUpMode] = useState<'date' | 'days'>('days');
  const [followUpDays, setFollowUpDays] = useState('4');
  const [followUpDateDraft, setFollowUpDateDraft] = useState('');
  const [showFollowUpCalendar, setShowFollowUpCalendar] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('unavailable');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workerAmount, setWorkerAmount] = useState('600');
  const [selectedCaseId, setSelectedCaseId] = useState('case-a-014');
  const [showArchivedCategories, setShowArchivedCategories] = useState(false);
  const [showArchivedPeople, setShowArchivedPeople] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<CategoryInput>({ id: '', name: '', kind: 'other' });
  const [personDraft, setPersonDraft] = useState({ id: '', displayName: '', specialty: '', phone: '', note: '' });
  const [materialUsages, setMaterialUsages] = useState<MaterialUsageDraft[]>([]);
  const [showArchivedMaterials, setShowArchivedMaterials] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<MaterialInput>({ id: '', name: '', type: 'other', unit: '' });
  const [settlePersonId, setSettlePersonId] = useState<string | null>(null);
  const [plotDraft, setPlotDraft] = useState<PlotInput>({ name: '', areaRai: 0 });
  const [holeDraft, setHoleDraft] = useState<HoleInput>({ plotId: '', marker: '' });
  const [plantingDraft, setPlantingDraft] = useState<PlantingInput>({ holeId: '', plantName: '', variety: '', plantedOn: new Date().toISOString().slice(0, 10) });
  const [activityPicker, setActivityPicker] = useState<{ kind: ActivityPicker; materialKey?: string } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [recentPickerIds, setRecentPickerIds] = useState<Record<ActivityPicker, string[]>>({ category: [], plot: [], target: [], material: [], worker: [], payType: [] });
  const [activityWorkers, setActivityWorkers] = useState<WorkerDraft[]>([]);

  const followUpPreview = useMemo(() => {
    try {
      return {
        followUpOn: resolveFollowUpOn({
          mode: followUpMode,
          baseDate: activityDateDraft,
          directDate: followUpDateDraft,
          days: followUpDays,
        }),
        error: null,
      };
    } catch (error) {
      return { followUpOn: null, error: error instanceof Error ? error.message : 'วันติดตามไม่ถูกต้อง' };
    }
  }, [activityDateDraft, followUpDateDraft, followUpDays, followUpMode]);

  const selectFollowUpDate = useCallback((_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowFollowUpCalendar(false);
    if (date) setFollowUpDateDraft(dateKeyFromLocalDate(date));
  }, []);

  const openActivityPicker = useCallback((kind: ActivityPicker, materialKey?: string) => {
    setPickerQuery('');
    setActivityPicker({ kind, materialKey });
  }, []);

  const rememberPicker = useCallback((kind: ActivityPicker, id: string) => {
    setRecentPickerIds((current) => ({
      ...current,
      [kind]: [id, ...current[kind].filter((recentId) => recentId !== id)].slice(0, 3),
    }));
  }, []);

  const beginMaterialUsage = useCallback(() => {
    const key = `material-${Date.now()}-${materialUsages.length}`;
    setMaterialUsages((rows) => [...rows, {
      key,
      materialId: '',
      amount: '',
      unit: '',
      waterVolume: '',
      waterUnit: 'ลิตร',
      dilutionText: '',
      note: '',
      actualTankLitres: '',
      manualAmount: '',
    }]);
    openActivityPicker('material', key);
  }, [materialUsages.length, openActivityPicker]);

  const beginWorker = useCallback(() => {
    const key = `worker-${Date.now()}-${activityWorkers.length}`;
    setActivityWorkers((rows) => [...rows, { key, personId: '', payType: 'daily', amount: '' }]);
    openActivityPicker('worker', key);
  }, [activityWorkers.length, openActivityPicker]);

  const refresh = useCallback(async (
    db: TakaiDatabase,
    message: string | null = null,
    caseId = selectedCaseId,
    preferredPlotId = selectedPlotId,
    preferredHoleId = selectedHoleId,
  ) => {
    const options = await getActivityCaptureOptions(db);
    const resolvedPlotId = options.plots.some((plot) => plot.id === preferredPlotId)
      ? preferredPlotId
      : options.defaultPlotId;
    const plotHoles = options.holes.filter((hole) => hole.plotId === resolvedPlotId);
    const resolvedHoleId = plotHoles.some((hole) => hole.id === preferredHoleId)
      ? preferredHoleId
      : plotHoles[0]?.id ?? null;
    const [dashboard, caseList, laborLedger, menuDashboard, materials, holeDetail, categories, people] = await Promise.all([
      getTodayDashboard(db, resolvedPlotId),
      getCaseList(db),
      getLaborLedger(db),
      getMenuDashboard(db),
      getMaterialLibrary(db),
      getHoleDetail(db, resolvedHoleId ?? undefined),
      listActivityCategories(db, true),
      listPeople(db, true),
    ]);
    setSelectedPlotId(resolvedPlotId);
    setSelectedHoleId(resolvedHoleId);
    const resolvedCaseId = caseList.some((caseItem) => caseItem.id === caseId) ? caseId : caseList[0]?.id ?? 'case-a-014';
    const caseTimeline = await getCaseTimeline(db, resolvedCaseId);
    setSelectedCaseId(resolvedCaseId);
    setState({ status: 'ready', db, dashboard, options, caseList, caseTimeline, laborLedger, menuDashboard, materials, holeDetail, categories, people, message });
  }, [selectedCaseId, selectedHoleId, selectedPlotId]);

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

  useEffect(() => {
    configureFollowUpNotifications();
    void getFollowUpNotificationPermission().then(setNotificationPermission).catch(() => setNotificationPermission('unavailable'));
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
      if (!fromActivity) setView('workers');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกคนงานไม่สำเร็จ');
    }
  }, [personDraft, refresh, state]);

  const savePlot = useCallback(async () => {
    if (state.status !== 'ready') return;
    try {
      const plotId = await createPlot(state.db, plotDraft);
      setSelectedPlotId(plotId);
      setSelectedHoleId(null);
      setHoleDraft((draft) => ({ ...draft, plotId }));
      await refresh(state.db, 'เพิ่มแปลงแล้ว', selectedCaseId, plotId, null);
      setPlotDraft({ name: '', areaRai: 0 });
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'เพิ่มแปลงไม่สำเร็จ');
    }
  }, [plotDraft, refresh, selectedCaseId, state]);

  const saveHole = useCallback(async () => {
    if (state.status !== 'ready') return;
    try {
      const plotId = holeDraft.plotId || selectedPlotId;
      const holeId = await createHole(state.db, { ...holeDraft, plotId });
      setSelectedHoleId(holeId);
      setPlantingDraft((draft) => ({ ...draft, holeId }));
      await refresh(state.db, 'เพิ่มหลุมแล้ว · ใส่ต้นไม้ได้เลย', selectedCaseId, plotId, holeId);
      setHoleDraft({ plotId, marker: '' });
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'เพิ่มหลุมไม่สำเร็จ');
    }
  }, [holeDraft, refresh, selectedCaseId, selectedPlotId, state]);

  const savePlanting = useCallback(async () => {
    if (state.status !== 'ready') return;
    try {
      const holeId = plantingDraft.holeId || selectedHoleId;
      if (!holeId) throw new Error('กรุณาเพิ่มหรือเลือกหลุมก่อน');
      await createPlanting(state.db, { ...plantingDraft, holeId });
      setSelectedHoleId(holeId);
      setSelectedTarget('hole');
      setSelectedTargetId(holeId);
      await refresh(state.db, 'ปลูกต้นไม้แล้ว · พร้อมบันทึกกิจกรรม', selectedCaseId, selectedPlotId, holeId);
      setPlantingDraft({ holeId, plantName: '', variety: '', plantedOn: new Date().toISOString().slice(0, 10) });
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกต้นไม้ไม่สำเร็จ');
    }
  }, [plantingDraft, refresh, selectedCaseId, selectedHoleId, selectedPlotId, state]);

  const quickAddActivityPicker = useCallback(async () => {
    if (state.status !== 'ready' || !activityPicker) return;
    try {
      if (activityPicker.kind === 'plot') {
        const plotId = await createPlot(state.db, plotDraft);
        await refresh(state.db, 'เพิ่มแปลงแล้ว', selectedCaseId, plotId, null);
        setSelectedPlotId(plotId);
        setSelectedTarget('plot');
        setSelectedTargetId(plotId);
        rememberPicker('plot', plotId);
        setPlotDraft({ name: '', areaRai: 0 });
      }
      if (activityPicker.kind === 'category') {
        const categoryId = await createActivityCategory(state.db, { name: categoryDraft.name, kind: categoryDraft.kind });
        await refresh(state.db, 'เพิ่มหมวดงานแล้ว');
        setSelectedCategoryId(categoryId);
        rememberPicker('category', categoryId);
        setCategoryDraft({ id: '', name: '', kind: 'other' });
      }
      if (activityPicker.kind === 'worker') {
        const personId = await createPerson(state.db, { displayName: personDraft.displayName, role: 'worker', isSelf: false, specialty: personDraft.specialty, phone: personDraft.phone, note: personDraft.note });
        await refresh(state.db, 'เพิ่มคนงานแล้ว');
        setSelectedWorkerId(personId);
        setActivityWorkers((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, personId } : row));
        rememberPicker('worker', personId);
        setPersonDraft({ id: '', displayName: '', specialty: '', phone: '', note: '' });
      }
      if (activityPicker.kind === 'material') {
        const materialId = await createMaterial(state.db, materialDraft);
        await refresh(state.db, 'เพิ่มวัสดุแล้ว');
        setMaterialUsages((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, materialId, unit: materialDraft.unit.trim() } : row));
        rememberPicker('material', materialId);
        setMaterialDraft({ id: '', name: '', type: 'other', unit: '' });
      }
      setActivityPicker(null);
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'เพิ่มรายการไม่สำเร็จ');
    }
  }, [activityPicker, categoryDraft, materialDraft, personDraft, plotDraft, refresh, rememberPicker, selectedCaseId, state]);

  const selectActivityPicker = useCallback((id: string) => {
    if (!activityPicker || state.status !== 'ready') return;
    if (activityPicker.kind === 'category') setSelectedCategoryId(id);
    if (activityPicker.kind === 'plot') {
      setSelectedPlotId(id);
      setSelectedHoleId(null);
      setSelectedTarget('plot');
      setSelectedTargetId(id);
      void refresh(state.db, null, selectedCaseId, id, null);
    }
    if (activityPicker.kind === 'target') {
      const [targetType, targetId] = id.split(':', 2) as ['plot' | 'hole' | 'case', string];
      setSelectedTarget(targetType);
      setSelectedTargetId(targetId);
    }
    if (activityPicker.kind === 'material') {
      const material = state.options.materials.find((item) => item.id === id);
      setMaterialUsages((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, materialId: id, unit: material?.unit ?? row.unit } : row));
    }
    if (activityPicker.kind === 'worker') setSelectedWorkerId(id === 'self' ? null : id);
    if (activityPicker.kind === 'worker') setActivityWorkers((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, personId: id } : row));
    if (activityPicker.kind === 'payType') setActivityWorkers((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, payType: id as WorkerDraft['payType'] } : row));
    rememberPicker(activityPicker.kind, id);
    setActivityPicker(null);
  }, [activityPicker, refresh, rememberPicker, selectedCaseId, state]);

  const saveMaterial = useCallback(async (fromActivity = false) => {
    if (state.status !== 'ready') return;
    try {
      const materialId = materialDraft.id
        ? (await updateMaterial(state.db, materialDraft.id, materialDraft), materialDraft.id)
        : await createMaterial(state.db, materialDraft);
      await refresh(state.db, materialDraft.id ? 'แก้ไขวัสดุแล้ว' : 'เพิ่มวัสดุแล้ว');
      if (fromActivity) {
        setMaterialUsages((rows) => [...rows, {
          key: `${materialId}-${Date.now()}-${rows.length}`,
          materialId,
          amount: '',
          unit: materialDraft.unit.trim(),
          waterVolume: '',
          waterUnit: 'ลิตร',
          dilutionText: '',
          note: '',
          actualTankLitres: '',
          manualAmount: '',
        }]);
      }
      setMaterialDraft({ id: '', name: '', type: 'other', unit: '' });
      if (!fromActivity) setView('materials');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกวัสดุไม่สำเร็จ');
    }
  }, [materialDraft, refresh, state]);

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

  const toggleMaterialArchive = useCallback(async (materialId: string, archivedAt: string | null) => {
    if (state.status !== 'ready') return;
    if (archivedAt) await restoreMaterial(state.db, materialId);
    else await archiveMaterial(state.db, materialId);
    await refresh(state.db, archivedAt ? 'นำวัสดุกลับมาใช้แล้ว' : 'เก็บวัสดุเข้าแฟ้มแล้ว');
    if (!archivedAt) setMaterialUsages((rows) => rows.filter((row) => row.materialId !== materialId));
  }, [refresh, state]);

  const toggleTracker = useCallback(async (categoryId: string, pinned: boolean) => {
    if (state.status !== 'ready') return;
    if (pinned) await unpinPlotTracker(state.db, state.dashboard.plot.id, categoryId);
    else await pinPlotTracker(state.db, state.dashboard.plot.id, categoryId);
    await refresh(state.db, pinned ? 'หยุดติดตามหมวดงานนี้ในแปลงแล้ว' : 'เพิ่ม Tracker ของแปลงแล้ว');
  }, [refresh, state]);

  const requestReminderPermission = useCallback(async () => {
    const permission = await requestFollowUpNotificationPermission();
    setNotificationPermission(permission);
    if (state.status === 'ready') {
      const message = permission === 'granted'
        ? 'เปิดการแจ้งเตือนแล้ว · จะตั้งนัดเมื่อบันทึก'
        : permission === 'denied'
          ? 'ยังไม่ได้รับอนุญาตให้แจ้งเตือน · บันทึกวันติดตามได้ตามปกติ'
          : 'การแจ้งเตือนยังใช้ไม่ได้ในอุปกรณ์นี้';
      await refresh(state.db, message, state.caseTimeline.id);
    }
  }, [refresh, state]);

  const createActivity = useCallback(async (mode: 'demo' | 'field' = 'field') => {
    if (state.status !== 'ready') return;
    try {
      let completionMessage = selectedTarget === 'case' ? 'เพิ่มบันทึกเคสแล้ว' : 'บันทึกกิจกรรมแล้ว';
      if (mode === 'demo') {
        await createDemoSprayActivity(state.db);
      } else {
        const category = state.options.categories.find((item) => item.id === selectedCategoryId) ?? state.options.categories[0];
        if (!category) {
          throw new Error('ยังไม่มีหมวดงานให้บันทึก');
        }
        const performedAt = `${activityDateDraft}T12:00:00.000Z`;
        const targetType = selectedTarget;
        const targetId = selectedTargetId
          ?? (targetType === 'case'
            ? state.options.activeCases.find((item) => item.plotId === selectedPlotId)?.id
            : targetType === 'hole'
              ? state.options.holes.find((item) => item.plotId === selectedPlotId)?.id
              : selectedPlotId);
        if (!targetId) throw new Error('กรุณาเลือกเป้าหมายกิจกรรม');
        const followUpOn = resolveFollowUpOn({
          mode: followUpMode,
          baseDate: activityDateDraft,
          directDate: followUpDateDraft,
          days: followUpDays,
        });
        const created = await createFieldActivity(state.db, {
          idSeed: `${Date.now()}`,
          plotId: selectedPlotId,
          categoryId: category.id,
          performedAt,
          timeMode,
          activityDate: activityDateDraft,
          startedAt: startedAtDraft,
          endedAt: endedAtDraft,
          durationMinutes: Number(durationMinutesDraft),
          note: note.trim() || `${category.name} ${state.dashboard.plot.name}`,
          followUpOn,
          targetType,
          targetId,
          materials: materialUsages.map((usage, index) => {
            const material = state.options.materials.find((item) => item.id === usage.materialId);
            const calculatedAmount = material?.referenceAmount == null || !usage.actualTankLitres
              ? null
              : calculateChemicalDose(material.referenceAmount, Number(usage.actualTankLitres), material.referenceWaterLitres ?? 200);
            return {
              materialId: usage.materialId,
              amount: Number(usage.manualAmount) || calculatedAmount || Number(usage.amount),
              unit: material?.referenceUnit || usage.unit,
              waterVolume: usage.waterVolume ? Number(usage.waterVolume) : null,
              waterUnit: usage.waterUnit || null,
              dilutionText: usage.dilutionText || null,
              note: usage.note || null,
              sortOrder: index,
              materialNameSnapshot: material?.name ?? null,
              commonNameSnapshot: material?.commonName ?? null,
              brandNameSnapshot: material?.brandName ?? null,
              referenceAmountSnapshot: material?.referenceAmount ?? null,
              referenceUnitSnapshot: material?.referenceUnit ?? null,
              referenceWaterLitresSnapshot: material?.referenceWaterLitres ?? null,
              actualTankLitres: usage.actualTankLitres ? Number(usage.actualTankLitres) : null,
              calculatedAmount,
              manualAmount: usage.manualAmount ? Number(usage.manualAmount) : null,
            };
          }),
          participants: [
            state.options.defaultSelfId
              ? { personId: state.options.defaultSelfId, payType: 'none' as const, amountDue: 0 }
              : null,
            ...activityWorkers
              .filter((worker) => worker.personId)
              .map((worker) => ({
                personId: worker.personId,
                payType: worker.payType,
                amountDue: worker.payType === 'none' ? 0 : Number(worker.amount) || 0,
              })),
          ].filter((participant): participant is NonNullable<typeof participant> => Boolean(participant)),
        });
        const reminder = await syncFollowUpReminder(
          state.db,
          { activityId: created.activityId, followUpOn },
          expoFollowUpNotificationGateway,
        );
        if (followUpOn && reminder.status === 'scheduled') completionMessage = 'บันทึกกิจกรรมและตั้งการแจ้งเตือนแล้ว';
        if (followUpOn && reminder.status === 'skipped' && reminder.reason === 'permission_undetermined') completionMessage = 'บันทึกกิจกรรมแล้ว · ยังไม่ได้เปิดการแจ้งเตือน';
        if (followUpOn && reminder.status === 'skipped' && reminder.reason === 'permission_denied') completionMessage = 'บันทึกกิจกรรมแล้ว · การแจ้งเตือนถูกปิดอยู่';
        if (followUpOn && reminder.status === 'failed') completionMessage = 'บันทึกกิจกรรมแล้ว · ตั้งการแจ้งเตือนไม่สำเร็จ';
      }
      await refresh(state.db, completionMessage, state.caseTimeline.id);
      setView(selectedTarget === 'case' ? 'cases' : 'today');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ', state.caseTimeline.id);
    }
  }, [
    activityDateDraft,
    activityWorkers,
    durationMinutesDraft,
    endedAtDraft,
    followUpDateDraft,
    followUpDays,
    followUpMode,
    materialUsages,
    note,
    refresh,
    selectedCategoryId,
    selectedPlotId,
    selectedTargetId,
    selectedTarget,
    selectedWorkerId,
    state,
    startedAtDraft,
    timeMode,
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
                ? state.holeDetail ? `หลุม ${state.holeDetail.marker}` : 'หลุมปลูก'
                : view === 'menu'
                  ? 'เมนู'
                  : view === 'categories'
                    ? 'หมวดงาน'
                    : view === 'workers'
                      ? 'คนงาน'
                      : view === 'trackerManage'
                        ? 'จัดการ Tracker'
                  : 'วันนี้';

  const pickerOptions: Record<ActivityPicker, PickerOption[]> = {
    category: options.categories.map((item) => ({ id: item.id, label: item.name, meta: 'หมวดงานที่ใช้งานอยู่' })),
    plot: options.plots.map((item) => ({ id: item.id, label: item.name, meta: 'แปลงที่ใช้งานได้' })),
    target: [
      { id: `plot:${selectedPlotId}`, label: 'ทั้งแปลง', meta: options.plots.find((item) => item.id === selectedPlotId)?.name ?? '' },
      ...options.holes.filter((item) => item.plotId === selectedPlotId).map((item) => ({ id: `hole:${item.id}`, label: `หลุม ${item.marker}`, meta: item.status === 'planted' ? 'มีต้นปลูกแล้ว' : 'หลุมว่าง' })),
      ...options.activeCases.filter((item) => item.plotId === selectedPlotId).map((item) => ({ id: `case:${item.id}`, label: item.title, meta: 'เคสที่กำลังติดตาม' })),
    ],
    material: options.materials.map((item) => ({ id: item.id, label: item.name, meta: `${materialTypeLabel(item.type)} · ${item.unit}` })),
    worker: options.people.filter((person) => !person.isSelf && person.role === 'worker').map((person) => ({ id: person.id, label: person.displayName, meta: 'คนงานที่ใช้งานอยู่' })),
    payType: [
      { id: 'daily', label: 'รายวัน', meta: 'กำหนดจำนวนเงินแยกคน' },
      { id: 'hourly', label: 'รายชั่วโมง', meta: 'กำหนดจำนวนเงินแยกคน' },
      { id: 'piece', label: 'เหมางานย่อย', meta: 'กำหนดจำนวนเงินแยกคน' },
      { id: 'contract', label: 'เหมางาน', meta: 'กำหนดจำนวนเงินแยกคน' },
      { id: 'none', label: 'ไม่คิดค่าแรง', meta: 'เก็บชื่อในกิจกรรมเท่านั้น' },
    ],
  };

  const pickerQuickAdd = activityPicker?.kind === 'plot' ? (
    <>
      <Text style={styles.sheetCaption}>+ เพิ่มแปลงใหม่ แล้วเลือกกลับมาที่บันทึกนี้</Text>
      <TextInput onChangeText={(name) => setPlotDraft((draft) => ({ ...draft, name }))} placeholder="ชื่อแปลง" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={plotDraft.name} />
      <PrimaryButton label="เพิ่มและเลือกแปลง" onPress={() => void quickAddActivityPicker()} />
    </>
  ) : activityPicker?.kind === 'category' ? (
    <>
      <Text style={styles.sheetCaption}>+ เพิ่มหมวดงานใหม่</Text>
      <TextInput onChangeText={(name) => setCategoryDraft({ id: '', name, kind: 'other' })} placeholder="ชื่อหมวดงาน" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={categoryDraft.name} />
      <PrimaryButton label="เพิ่มและเลือกหมวดงาน" onPress={() => void quickAddActivityPicker()} />
    </>
  ) : activityPicker?.kind === 'worker' ? (
    <>
      <Text style={styles.sheetCaption}>+ เพิ่มคนงานใหม่</Text>
      <TextInput onChangeText={(displayName) => setPersonDraft((draft) => ({ ...draft, id: '', displayName }))} placeholder="ชื่อคนงาน" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={personDraft.displayName} />
      <TextInput onChangeText={(specialty) => setPersonDraft((draft) => ({ ...draft, specialty }))} placeholder="งานที่ถนัด (ถ้ามี)" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={personDraft.specialty} />
      <PrimaryButton label="เพิ่มและเลือกคนงาน" onPress={() => void quickAddActivityPicker()} />
    </>
  ) : activityPicker?.kind === 'material' ? (
    <>
      <Text style={styles.sheetCaption}>+ เพิ่มวัสดุใหม่</Text>
      <TextInput onChangeText={(name) => setMaterialDraft((draft) => ({ ...draft, id: '', name }))} placeholder="ชื่อวัสดุ" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialDraft.name} />
      <TextInput onChangeText={(unit) => setMaterialDraft((draft) => ({ ...draft, unit }))} placeholder="หน่วย เช่น cc หรือ กรัม" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialDraft.unit} />
      <TextInput onChangeText={(commonName) => setMaterialDraft((draft) => ({ ...draft, commonName }))} placeholder="ชื่อสามัญ (สารเคมี ถ้ามี)" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialDraft.commonName ?? ''} />
      <TextInput onChangeText={(brandName) => setMaterialDraft((draft) => ({ ...draft, brandName }))} placeholder="ชื่อยี่ห้อ (ถ้ามี)" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialDraft.brandName ?? ''} />
      <TextInput keyboardType="decimal-pad" onChangeText={(referenceAmount) => setMaterialDraft((draft) => ({ ...draft, referenceAmount: Number(referenceAmount) || null, referenceWaterLitres: draft.referenceWaterLitres ?? 200, referenceUnit: draft.referenceUnit ?? draft.unit }))} placeholder="อัตราอ้างอิง เช่น 20" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialDraft.referenceAmount == null ? '' : String(materialDraft.referenceAmount)} />
      <PrimaryButton label="เพิ่มและเลือกวัสดุ" onPress={() => void quickAddActivityPicker()} />
    </>
  ) : undefined;

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
              nextDueLabel={formatFollowUpDueLabel(tracker.nextDueOn) ?? undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.dueState === 'overdue' ? 'overdue' : tracker.categoryId === 'cat-spray' ? 'spray' : tracker.categoryId === 'cat-fertilizer' ? 'fertilizer' : 'pruning'}
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

          <SectionHeader title="ตั้งค่าสวนก่อนบันทึก" />
          <FieldCard>
            <Text style={styles.cardTitle}>1. เลือกหรือเพิ่มแปลง</Text>
            <View style={styles.chipWrap}>
              {options.plots.map((item) => (
                <SelectPill
                  active={item.id === selectedPlotId}
                  key={item.id}
                  label={item.name}
                  onPress={() => {
                    setSelectedPlotId(item.id);
                    setSelectedHoleId(null);
                    setSelectedTarget('plot');
                    setSelectedTargetId(item.id);
                    void refresh(state.db, null, selectedCaseId, item.id, null);
                  }}
                />
              ))}
            </View>
            <Text style={styles.inputLabel}>ชื่อแปลงใหม่</Text>
            <TextInput
              onChangeText={(name) => setPlotDraft((draft) => ({ ...draft, name }))}
              placeholder="เช่น แปลงหลังบ้าน"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={plotDraft.name}
            />
            <Text style={styles.inputLabel}>พื้นที่ (ไร่, ไม่บังคับ)</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setPlotDraft((draft) => ({ ...draft, areaRai: Number(value) || 0 }))}
              placeholder="0"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={plotDraft.areaRai ? String(plotDraft.areaRai) : ''}
            />
            <PrimaryButton label="+ เพิ่มแปลงนี้" onPress={() => void savePlot()} variant="secondary" />
          </FieldCard>

          <FieldCard>
            <Text style={styles.cardTitle}>2. เพิ่มหลุมใน {options.plots.find((item) => item.id === selectedPlotId)?.name ?? 'แปลง'}</Text>
            <Text style={styles.inputLabel}>รหัสหรือชื่อหลุม</Text>
            <TextInput
              onChangeText={(marker) => setHoleDraft((draft) => ({ ...draft, marker }))}
              placeholder="เช่น B-001"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={holeDraft.marker}
            />
            <PrimaryButton label="+ เพิ่มหลุม" onPress={() => void saveHole()} variant="secondary" />
          </FieldCard>

          <FieldCard>
            <Text style={styles.cardTitle}>3. ใส่ต้นไม้ในหลุม</Text>
            <Text style={styles.muted}>เลือกหลุมที่เพิ่งเพิ่ม หรือดูหลุมเดิมก่อนปลูก</Text>
            <View style={styles.chipWrap}>
              {options.holes.filter((hole) => hole.plotId === selectedPlotId && hole.status === 'empty').map((hole) => (
                <SelectPill active={hole.id === selectedHoleId} key={hole.id} label={hole.marker} onPress={() => {
                  setSelectedHoleId(hole.id);
                  setPlantingDraft((draft) => ({ ...draft, holeId: hole.id }));
                }} />
              ))}
            </View>
            <Text style={styles.inputLabel}>ชื่อต้นไม้</Text>
            <TextInput
              onChangeText={(plantName) => setPlantingDraft((draft) => ({ ...draft, plantName }))}
              placeholder="เช่น ทุเรียน"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={plantingDraft.plantName}
            />
            <Text style={styles.inputLabel}>พันธุ์ (ไม่บังคับ)</Text>
            <TextInput
              onChangeText={(variety) => setPlantingDraft((draft) => ({ ...draft, variety }))}
              placeholder="เช่น หมอนทอง"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={plantingDraft.variety ?? ''}
            />
            <Text style={styles.inputLabel}>วันปลูก (YYYY-MM-DD)</Text>
            <TextInput
              onChangeText={(plantedOn) => setPlantingDraft((draft) => ({ ...draft, plantedOn }))}
              placeholder="2026-07-28"
              placeholderTextColor={tokens.color.text.muted}
              style={styles.input}
              value={plantingDraft.plantedOn}
            />
            <PrimaryButton label="บันทึกต้นไม้" onPress={() => void savePlanting()} variant="secondary" />
          </FieldCard>

          <PrimaryButton label="ไปบันทึกกิจกรรมของหลุมนี้" onPress={() => setView('activity')} />

          <SectionHeader title="Tracker ที่ติดตาม" actionLabel="จัดการ" onActionPress={() => setView('trackerManage')} />
          {plot.trackers.map((tracker) => (
            <TrackerCard
              key={tracker.categoryId}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เริ่ม' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={formatFollowUpDueLabel(tracker.nextDueOn) ?? undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.dueState === 'overdue' ? 'overdue' : 'custom'}
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
          {state.holeDetail ? <PrimaryButton label={`ดูหลุม ${state.holeDetail.marker}`} onPress={() => setView('hole')} variant="secondary" /> : null}
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
          <FieldCard variant="summary">
            <Text style={styles.eyebrow}>บันทึกภาคสนาม</Text>
            <Text style={styles.cardTitle}>{options.categories.find((item) => item.id === selectedCategoryId)?.name ?? 'เลือกหมวดงาน'} · {options.plots.find((item) => item.id === selectedPlotId)?.name}</Text>
            <Text style={styles.muted}>เลือก ค้นหา หรือเพิ่มรายการใหม่ได้ โดยแบบฟอร์มที่กำลังกรอกจะไม่หาย</Text>
          </FieldCard>

          <FormSection title="1. งานและสถานที่">
            <FieldCard>
              <PickerField label="หมวดงาน" onPress={() => openActivityPicker('category')} placeholder="เลือกหมวดงาน" value={options.categories.find((item) => item.id === selectedCategoryId)?.name} />
              <PickerField label="แปลง" onPress={() => openActivityPicker('plot')} placeholder="เลือกแปลงก่อน" value={options.plots.find((item) => item.id === selectedPlotId)?.name} />
              <PickerField label="เป้าหมายในแปลง" onPress={() => openActivityPicker('target')} placeholder="เลือกทั้งแปลง หลุม หรือเคส" value={activityTargetLabel(options, selectedPlotId, selectedTarget, selectedTargetId)} />
              <Text style={styles.inputLabel}>วันที่ทำงาน</Text>
              <TextInput keyboardType="numbers-and-punctuation" onChangeText={setActivityDateDraft} placeholder="YYYY-MM-DD" style={styles.input} value={activityDateDraft} />
            </FieldCard>
          </FormSection>

          <Pressable accessibilityRole="button" onPress={() => setShowTimeDetails((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>เวลา</Text><Text style={styles.disclosureAction}>{showTimeDetails ? 'ซ่อน' : 'เพิ่มถ้าจำเป็น'}</Text></Pressable>
          {showTimeDetails ? <FormSection title="เวลา (ถ้าต้องการ)">
            <FieldCard>
              <TimeModeControl onChange={setTimeMode} value={timeMode} />
              {timeMode === 'all_day' ? <Text style={styles.muted}>ทำทั้งวัน: จะบันทึกเพียงวันที่ ไม่สร้างเวลาเริ่มหรือเวลาจบขึ้นมาเอง</Text> : null}
              {timeMode === 'time_range' ? <View style={styles.formRow}><TextInput keyboardType="numbers-and-punctuation" onChangeText={setStartedAtDraft} placeholder="เริ่ม 08:00" style={[styles.input, styles.formCell]} value={startedAtDraft} /><TextInput keyboardType="numbers-and-punctuation" onChangeText={setEndedAtDraft} placeholder="จบ 17:00" style={[styles.input, styles.formCell]} value={endedAtDraft} /></View> : null}
              {timeMode === 'duration_only' ? <><Text style={styles.inputLabel}>ใช้เวลากี่นาที</Text><TextInput keyboardType="numeric" onChangeText={setDurationMinutesDraft} placeholder="เช่น 90" style={styles.input} value={durationMinutesDraft} /><Text style={styles.muted}>ไม่ต้องระบุช่วงเวลา และเวลาไม่ถูกนำไปคิดค่าแรง</Text></> : null}
            </FieldCard>
          </FormSection> : null}

          <FormSection title="2. บันทึก">
            <FieldCard>
            <Text style={styles.inputLabel}>บันทึก</Text>
            <TextInput multiline onChangeText={setNote} style={[styles.input, styles.textArea]} value={note} />
            </FieldCard>
          </FormSection>

          <Pressable accessibilityRole="button" onPress={() => setShowMaterialDetails((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>วัสดุครั้งนี้</Text><Text style={styles.disclosureAction}>{showMaterialDetails ? 'ซ่อน' : 'เพิ่มถ้าจำเป็น'}</Text></Pressable>
          {showMaterialDetails ? <FormSection title="3. วัสดุครั้งนี้">
            <FieldCard>
            {materialUsages.length === 0 ? <Text style={styles.noMaterial}>ไม่มีวัสดุในครั้งนี้</Text> : null}
            {materialUsages.map((usage, index) => {
              const selected = options.materials.find((item) => item.id === usage.materialId);
              const patchUsage = (patch: Partial<typeof usage>) => setMaterialUsages((rows) => rows.map((row) => row.key === usage.key ? { ...row, ...patch } : row));
              return (
                <View key={usage.key} style={styles.materialUsageRow}>
                  <View style={styles.usageTitleRow}><Text style={styles.cardTitle}>วัสดุ {index + 1}</Text><Pressable accessibilityRole="button" onPress={() => setMaterialUsages((rows) => rows.filter((row) => row.key !== usage.key))}><Text style={styles.removeText}>นำออก</Text></Pressable></View>
                  <PickerField label="วัสดุ" onPress={() => openActivityPicker('material', usage.key)} placeholder="เลือกหรือเพิ่มวัสดุ" value={selected?.name} />
                  {selected?.type === 'fungicide' || selected?.type === 'insecticide' ? (() => {
                    const calculated = selected.referenceAmount == null || !usage.actualTankLitres ? null : calculateChemicalDose(selected.referenceAmount, Number(usage.actualTankLitres), selected.referenceWaterLitres ?? 200);
                    const visibleAmount = usage.manualAmount || (calculated == null ? '' : String(calculated));
                    return <View style={styles.chemicalBox}>
                      <Text style={styles.chemicalTitle}>{[selected.commonName, selected.brandName].filter(Boolean).join(' · ') || selected.name}</Text>
                      <Text style={styles.muted}>{selected.usageLabel || 'บันทึกการใช้สารครั้งนี้'} · อ้างอิง {selected.referenceAmount ?? '—'} {selected.referenceUnit ?? selected.unit} / น้ำ {selected.referenceWaterLitres ?? 200} L</Text>
                      <Text style={styles.inputLabel}>น้ำในถังครั้งนี้ (L)</Text><TextInput keyboardType="decimal-pad" onChangeText={(actualTankLitres) => patchUsage({ actualTankLitres })} placeholder="เช่น 100" style={styles.input} value={usage.actualTankLitres} />
                      <Text style={styles.inputLabel}>ปริมาณที่ใช้ {usage.manualAmount ? '(กำหนดเอง)' : '(คำนวณ)'}</Text><TextInput keyboardType="decimal-pad" onChangeText={(manualAmount) => patchUsage({ manualAmount })} placeholder={visibleAmount || 'คำนวณเมื่อใส่น้ำ'} style={styles.input} value={usage.manualAmount} />
                      {calculated != null ? <Text style={styles.calculatedDose}>คำนวณได้ {calculated} {selected.referenceUnit ?? selected.unit}</Text> : null}
                    </View>;
                  })() : null}
                  <Text style={styles.inputLabel}>ปริมาณจริง และหน่วย</Text>
                  <View style={styles.formRow}><TextInput keyboardType="decimal-pad" onChangeText={(amount) => patchUsage({ amount })} placeholder="เช่น 20" style={[styles.input, styles.formCell]} value={usage.amount} /><TextInput onChangeText={(unit) => patchUsage({ unit })} placeholder={selected?.unit ?? 'หน่วย'} style={[styles.input, styles.formCell]} value={usage.unit} /></View>
                  <Text style={styles.inputLabel}>น้ำ/อัตราผสม/โน้ต (ถ้ามี)</Text>
                  <View style={styles.formRow}><TextInput keyboardType="decimal-pad" onChangeText={(waterVolume) => patchUsage({ waterVolume })} placeholder="น้ำ" style={[styles.input, styles.formCell]} value={usage.waterVolume} /><TextInput onChangeText={(waterUnit) => patchUsage({ waterUnit })} placeholder="ลิตร" style={[styles.input, styles.formCell]} value={usage.waterUnit} /></View>
                  <TextInput onChangeText={(dilutionText) => patchUsage({ dilutionText })} placeholder="อัตราผสม" style={styles.input} value={usage.dilutionText} />
                  <TextInput multiline onChangeText={(noteText) => patchUsage({ note: noteText })} placeholder="โน้ตวัสดุ" style={[styles.input, styles.textAreaSmall]} value={usage.note} />
                </View>
              );
            })}
            <PrimaryButton label="+ เลือกวัสดุ" onPress={beginMaterialUsage} variant="tertiary" />
            </FieldCard>
          </FormSection> : null}

          <Pressable accessibilityRole="button" onPress={() => setShowWorkerDetails((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>คนงานและค่าแรง</Text><Text style={styles.disclosureAction}>{showWorkerDetails ? 'ซ่อน' : 'เพิ่มถ้าจำเป็น'}</Text></Pressable>
          {showWorkerDetails ? <FormSection title="4. ผู้ร่วมงานและค่าแรง">
            <FieldCard>
            <StatusChip label="เจ้าของสวน · ไม่คิดค่าแรง" variant="paid" />
            <Text style={styles.muted}>งานที่ทำเองจะเก็บในประวัติกิจกรรม แต่ไม่สร้างยอดค้างจ่าย</Text>
            {activityWorkers.map((worker, index) => <View key={worker.key} style={styles.workerRow}>
              <View style={styles.usageTitleRow}><Text style={styles.cardTitle}>คนงาน {index + 1}</Text><Pressable accessibilityRole="button" onPress={() => setActivityWorkers((rows) => rows.filter((row) => row.key !== worker.key))}><Text style={styles.removeText}>นำออก</Text></Pressable></View>
              <PickerField label="ชื่อคนงาน" onPress={() => openActivityPicker('worker', worker.key)} placeholder="เลือกหรือเพิ่มคนงาน" value={options.people.find((person) => person.id === worker.personId)?.displayName} />
              <PickerField label="วิธีคิดค่าแรง" onPress={() => openActivityPicker('payType', worker.key)} placeholder="เลือกวิธีคิด" value={payTypeLabel(worker.payType)} />
              {worker.payType !== 'none' ? <><Text style={styles.inputLabel}>จำนวนเงิน</Text><TextInput keyboardType="numeric" onChangeText={(amount) => setActivityWorkers((rows) => rows.map((row) => row.key === worker.key ? { ...row, amount } : row))} placeholder="เช่น 600" style={styles.input} value={worker.amount} /></> : null}
            </View>)}
            <PrimaryButton label="+ เพิ่มคนงาน" onPress={beginWorker} variant="tertiary" />
            </FieldCard>
          </FormSection> : null}

          <Pressable accessibilityRole="button" onPress={() => setShowFollowUpDetails((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>ติดตามต่อ</Text><Text style={styles.disclosureAction}>{showFollowUpDetails ? 'ซ่อน' : 'เพิ่มถ้าจำเป็น'}</Text></Pressable>
          {showFollowUpDetails ? <FormSection title="5. ติดตามต่อ (ถ้ามี)">
            <FieldCard>
              <Text style={styles.inputLabel}>เลือกวิธีตั้งวันติดตาม</Text>
              <View style={styles.chipWrap}>
                <SelectPill active={followUpMode === 'days'} label="อีกกี่วัน" onPress={() => setFollowUpMode('days')} />
                <SelectPill active={followUpMode === 'date'} label="เลือกวันโดยตรง" onPress={() => setFollowUpMode('date')} />
              </View>
              {followUpMode === 'days' ? <><Text style={styles.inputLabel}>ติดตามอีกกี่วัน</Text><TextInput keyboardType="numeric" onChangeText={setFollowUpDays} placeholder="เช่น 7" style={styles.input} value={followUpDays} /></> : <>
                <Text style={styles.inputLabel}>วันติดตาม</Text>
                {Platform.OS === 'web' ? <TextInput keyboardType="numbers-and-punctuation" onChangeText={setFollowUpDateDraft} placeholder="YYYY-MM-DD" style={styles.input} value={followUpDateDraft} /> : <PrimaryButton label={followUpDateDraft ? `เปลี่ยนวัน · ${formatThaiShortDate(followUpDateDraft)}` : 'เปิดปฏิทินเลือกวัน'} onPress={() => setShowFollowUpCalendar(true)} variant="secondary" />}
                {showFollowUpCalendar ? <DateTimePicker display={Platform.OS === 'ios' ? 'inline' : 'default'} mode="date" onChange={selectFollowUpDate} value={dateFromDayKey(followUpDateDraft || activityDateDraft)} /> : null}
              </>}
              {followUpPreview.error ? <Text style={styles.danger}>{followUpPreview.error}</Text> : followUpPreview.followUpOn ? <View style={styles.followUpSummary}><Text style={styles.cardTitle}>นัดติดตาม {formatThaiShortDate(followUpPreview.followUpOn)}</Text><Text style={styles.muted}>{formatFollowUpDueLabel(followUpPreview.followUpOn) ?? ''}</Text></View> : <Text style={styles.muted}>ปล่อยว่างหรือใส่ 0 ได้ หากงานนี้ไม่มีวันติดตาม</Text>}
              {followUpPreview.followUpOn && followUpDaysRemaining(followUpPreview.followUpOn) !== null && followUpDaysRemaining(followUpPreview.followUpOn)! > 0 ? <View style={styles.reminderPanel}>
                <Text style={styles.cardTitle}>เตือนในเครื่อง (ไม่บังคับ)</Text>
                {notificationPermission === 'granted' ? <Text style={styles.muted}>เปิดแล้ว · เมื่อบันทึก ระบบจะตั้งเตือนครั้งเดียวในเช้าวันนัด</Text> : notificationPermission === 'denied' ? <Text style={styles.muted}>ถูกปิดอยู่ · วันติดตามยังบันทึกและแสดงในวันนี้ได้ตามปกติ</Text> : notificationPermission === 'unavailable' ? <Text style={styles.muted}>ตั้งเตือนได้เมื่อเปิดบนแอป Android หรือ iOS</Text> : <><Text style={styles.muted}>ขออนุญาตเฉพาะเมื่อคุณเลือกจะใช้การเตือนนี้</Text><PrimaryButton label="เปิดการแจ้งเตือนวันติดตาม" onPress={() => void requestReminderPermission()} variant="secondary" /></>}
              </View> : null}
            </FieldCard>
          </FormSection> : null}
          <StickySaveBar label="บันทึกกิจกรรมลงเครื่อง" onPress={() => createActivity('field')} />
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
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>คลังวัสดุ</Text>
            <Text style={styles.cardTitle}>ยา ปุ๋ย และวัสดุที่เลือกใช้ซ้ำได้</Text>
            <Text style={styles.muted}>เก็บเข้าแฟ้มจะซ่อนจากบันทึกใหม่ แต่ประวัติการใช้เดิมยังอ่านได้ครบ</Text>
          </FieldCard>
          <SectionHeader title={materialDraft.id ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุ'} />
          <FieldCard>
            <Text style={styles.inputLabel}>ชื่อวัสดุ</Text><TextInput onChangeText={(name) => setMaterialDraft((draft) => ({ ...draft, name }))} style={styles.input} value={materialDraft.name} />
            <Text style={styles.inputLabel}>ชนิด</Text><View style={styles.chipWrap}>{(['fungicide', 'insecticide', 'fertilizer', 'soil', 'tool', 'other'] as const).map((type) => <SelectPill active={materialDraft.type === type} key={type} label={materialTypeLabel(type)} onPress={() => setMaterialDraft((draft) => ({ ...draft, type }))} />)}</View>
            <Text style={styles.inputLabel}>หน่วย</Text><TextInput onChangeText={(unit) => setMaterialDraft((draft) => ({ ...draft, unit }))} style={styles.input} value={materialDraft.unit} />
            <Text style={styles.inputLabel}>อัตราเริ่มต้น / โน้ต (ถ้ามี)</Text><TextInput onChangeText={(defaultRatePerTank) => setMaterialDraft((draft) => ({ ...draft, defaultRatePerTank }))} style={styles.input} value={materialDraft.defaultRatePerTank ?? ''} />
            <TextInput multiline onChangeText={(notes) => setMaterialDraft((draft) => ({ ...draft, notes }))} placeholder="โน้ตคลังวัสดุ" style={[styles.input, styles.textAreaSmall]} value={materialDraft.notes ?? ''} />
            <PrimaryButton label={materialDraft.id ? 'บันทึกการแก้ไข' : 'เพิ่มวัสดุ'} onPress={() => void saveMaterial()} />
            {materialDraft.id ? <PrimaryButton label="ยกเลิกการแก้ไข" onPress={() => setMaterialDraft({ id: '', name: '', type: 'other', unit: '' })} variant="tertiary" /> : null}
          </FieldCard>
          <SectionHeader title={showArchivedMaterials ? 'วัสดุในแฟ้ม' : 'วัสดุที่ใช้งาน'} actionLabel={showArchivedMaterials ? 'ดูที่ใช้งาน' : 'ดูในแฟ้ม'} onActionPress={() => setShowArchivedMaterials((value) => !value)} />
          <View style={styles.list}>
            {state.materials.filter((material) => Boolean(material.archivedAt) === showArchivedMaterials).map((material) => (
              <View key={material.id} style={styles.directoryRow}>
                <RecordListItem
                  meta={`${materialTypeLabel(material.type as MaterialInput['type'])} · ${material.defaultRatePerTank ?? material.unit} · ใช้แล้ว ${material.usageCount} ครั้ง${material.archivedAt ? ' · อยู่ในแฟ้ม ประวัติยังอ่านได้' : ''}`}
                  onPress={() => setMaterialDraft({ id: material.id, name: material.name, type: material.type as MaterialInput['type'], unit: material.unit, defaultRatePerTank: material.defaultRatePerTank })}
                  title={material.name}
                  trailing={material.lastUsedAt ? formatThaiShortDate(material.lastUsedAt) : material.unit}
                  variant="material"
                />
                <PrimaryButton label={material.archivedAt ? 'นำกลับมาใช้' : 'เก็บเข้าแฟ้ม'} onPress={() => void toggleMaterialArchive(material.id, material.archivedAt)} variant={material.archivedAt ? 'secondary' : 'tertiary'} />
              </View>
            ))}
          </View>
          <PrimaryButton label="บันทึกกิจกรรม" onPress={() => setView('activity')} variant="secondary" />
        </>
      ) : null}

      {view === 'hole' && state.holeDetail ? (
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
      <SearchPickerSheet
        emptyLabel="ยังไม่มีรายการที่ใช้งานอยู่"
        onClose={() => setActivityPicker(null)}
        onPick={selectActivityPicker}
        options={activityPicker ? pickerOptions[activityPicker.kind] : []}
        query={pickerQuery}
        quickAdd={pickerQuickAdd}
        recentIds={activityPicker ? recentPickerIds[activityPicker.kind] : []}
        setQuery={setPickerQuery}
        title={activityPicker ? ({ category: 'เลือกหมวดงาน', plot: 'เลือกแปลง', target: 'เลือกเป้าหมาย', material: 'เลือกวัสดุ', worker: 'เลือกคนงาน', payType: 'เลือกวิธีคิดค่าแรง' }[activityPicker.kind]) : 'เลือกข้อมูล'}
        visible={Boolean(activityPicker)}
      />
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

function dateKeyFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12);
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

function materialTypeLabel(type: MaterialInput['type']): string {
  return {
    fungicide: 'ยาป้องกันเชื้อรา',
    insecticide: 'ยาป้องกันแมลง',
    fertilizer: 'ปุ๋ย',
    soil: 'วัสดุปรับดิน',
    tool: 'อุปกรณ์',
    other: 'อื่น ๆ',
  }[type];
}

function activityTargetLabel(
  options: ActivityCaptureOption,
  plotId: string,
  targetType: 'plot' | 'hole' | 'case',
  targetId: string | null,
): string | undefined {
  if (targetType === 'plot') return 'ทั้งแปลง';
  if (targetType === 'hole') {
    const hole = options.holes.find((item) => item.id === targetId && item.plotId === plotId);
    return hole ? `หลุม ${hole.marker}` : undefined;
  }
  return options.activeCases.find((item) => item.id === targetId && item.plotId === plotId)?.title;
}

function payTypeLabel(payType: WorkerDraft['payType']): string {
  return { none: 'ไม่คิดค่าแรง', daily: 'รายวัน', hourly: 'รายชั่วโมง', piece: 'เหมางานย่อย', contract: 'เหมางาน' }[payType];
}

function TimeModeControl({ onChange, value }: { value: 'all_day' | 'time_range' | 'duration_only'; onChange: (value: 'all_day' | 'time_range' | 'duration_only') => void }) {
  const options: Array<{ id: typeof value; label: string }> = [
    { id: 'all_day', label: 'ทั้งวัน' },
    { id: 'time_range', label: 'ตั้งแต่–ถึง' },
    { id: 'duration_only', label: 'ระบุชั่วโมง' },
  ];
  return <View style={styles.timeModeRow}>{options.map((option) => <Pressable accessibilityRole="button" key={option.id} onPress={() => onChange(option.id)} style={[styles.timeModeButton, option.id === value && styles.timeModeButtonActive]}><Text style={[styles.timeModeText, option.id === value && styles.timeModeTextActive]}>{option.label}</Text></Pressable>)}</View>;
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
  sheetCaption: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
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
  textAreaSmall: {
    marginTop: tokens.spacing.control,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
    minWidth: 0,
  },
  formCell: {
    flex: 1,
    flexBasis: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  disclosure: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  disclosureLabel: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  disclosureAction: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  timeModeRow: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
  },
  timeModeButton: {
    alignItems: 'center',
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  timeModeButtonActive: {
    backgroundColor: '#E5F2E6',
    borderColor: tokens.color.primary.green,
  },
  timeModeText: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
  },
  timeModeTextActive: {
    color: tokens.color.primary.green,
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
  noMaterial: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.body.size,
    lineHeight: 24,
    paddingVertical: tokens.spacing.control,
  },
  materialUsageRow: {
    borderBottomColor: tokens.color.border.soft,
    borderBottomWidth: 1,
    gap: tokens.spacing.control,
    marginBottom: tokens.spacing.card,
    paddingBottom: tokens.spacing.card,
  },
  chemicalBox: {
    backgroundColor: '#F2F8ED',
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    padding: tokens.spacing.control,
  },
  chemicalTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  calculatedDose: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.body.size,
    fontWeight: '700',
    marginTop: tokens.spacing.control,
  },
  followUpSummary: {
    backgroundColor: '#F2F8ED',
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    marginTop: tokens.spacing.control,
    padding: tokens.spacing.control,
  },
  reminderPanel: {
    borderTopColor: tokens.color.border.soft,
    borderTopWidth: 1,
    gap: tokens.spacing.control,
    marginTop: tokens.spacing.card,
    paddingTop: tokens.spacing.card,
  },
  workerRow: {
    borderBottomColor: tokens.color.border.soft,
    borderBottomWidth: 1,
    gap: tokens.spacing.control,
    marginBottom: tokens.spacing.card,
    paddingBottom: tokens.spacing.card,
  },
  usageTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  removeText: {
    color: tokens.color.state.danger,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
    padding: tokens.spacing.control,
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
