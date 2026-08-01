import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { initializeTakaiDatabase, type TakaiDatabase } from '../../data';
import { tokens } from '../../theme/tokens';
import {
  AppShell,
  DatePickerField,
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
  retireCurrentPlanting,
  createPlot,
  createActivityCategory,
  createDemoSprayActivity,
  createFieldActivity,
  createMaterial,
  calculateChemicalDose,
  emptyMaterialDraft,
  filterMaterialLibraryItems,
  materialDraftFromLibrary,
  validateMaterialCatalogDraft,
  validateActivityDraft,
  createPerson,
  formatThaiShortDate,
  formatFollowUpDueLabel,
  followUpDaysRemaining,
  localDateKey,
  getActivityCaptureOptions,
  getCaseList,
  getCaseTimeline,
  getHoleDetail,
  getPlotDetail,
  getLaborLedger,
  getMenuDashboard,
  getMaterialLibrary,
  getTodayDashboard,
  archiveActivityCategory,
  archiveMaterial,
  archivePerson,
  listActivityCategories,
  listPlotSummaries,
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
  type PlotDetail,
  type PlotSummary,
  type LaborLedger,
  type MenuDashboard,
  type MaterialLibraryItem,
  type MaterialInput,
  type ActivityMaterialReturnIntent,
  type MaterialCatalogMode,
  type MaterialLibraryTypeFilter,
  type TakaiView,
  type TodayDashboard,
  type TodayScope,
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
      plotDetail: PlotDetail;
      plotList: PlotSummary[];
      categories: Awaited<ReturnType<typeof listActivityCategories>>;
      people: PersonDirectoryItem[];
      message: string | null;
    }
  | { status: 'error'; message: string };

type ActivityPicker = 'category' | 'plot' | 'target' | 'material' | 'worker' | 'payType';
type WorkerDraft = { key: string; personId: string; payType: 'none' | 'daily' | 'hourly' | 'piece' | 'contract'; amount: string };
type MaterialUsageDraft = { key: string; materialId: string; amount: string; unit: string; waterVolume: string; waterUnit: string; dilutionText: string; note: string; actualTankLitres: string; manualAmount: string; manualOverride: boolean };

export function OperationalSliceScreen() {
  const [view, setView] = useState<TakaiView>('today');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('cat-spray');
  const [selectedTarget, setSelectedTarget] = useState<'plot' | 'hole' | 'case'>('hole');
  const [todayScope, setTodayScope] = useState<TodayScope>('all');
  const [selectedDetailPlotId, setSelectedDetailPlotId] = useState('');
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [activityDateDraft, setActivityDateDraft] = useState(localDateKey());
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
  const [materialDraft, setMaterialDraft] = useState<MaterialInput>(emptyMaterialDraft);
  const [materialCatalogMode, setMaterialCatalogMode] = useState<MaterialCatalogMode>('library');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState<MaterialLibraryTypeFilter>('all');
  const [archiveConfirmationMaterialId, setArchiveConfirmationMaterialId] = useState<string | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialReturnIntent, setMaterialReturnIntent] = useState<ActivityMaterialReturnIntent | null>(null);
  const [materialFormError, setMaterialFormError] = useState<string | null>(null);
  const [materialSaving, setMaterialSaving] = useState(false);
  const [materialDetailKey, setMaterialDetailKey] = useState<string | null>(null);
  const [settlePersonId, setSettlePersonId] = useState<string | null>(null);
  const [plotDraft, setPlotDraft] = useState<PlotInput>({ name: '', areaRai: 0 });
  const [holeDraft, setHoleDraft] = useState<HoleInput>({ plotId: '', marker: '' });
  const [plantingDraft, setPlantingDraft] = useState<PlantingInput>({ holeId: '', plantName: '', variety: '', plantedOn: localDateKey() });
  const [retirementDate, setRetirementDate] = useState(localDateKey());
  const [retirementReason, setRetirementReason] = useState('');
  const [activityPicker, setActivityPicker] = useState<{ kind: ActivityPicker; materialKey?: string } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [recentPickerIds, setRecentPickerIds] = useState<Record<ActivityPicker, string[]>>({ category: [], plot: [], target: [], material: [], worker: [], payType: [] });
  const [activityWorkers, setActivityWorkers] = useState<WorkerDraft[]>([]);
  const [activitySaveState, setActivitySaveState] = useState<{ status: 'idle' | 'saving' | 'success' | 'error'; activityId?: string; message?: string; errors?: string[] }>({ status: 'idle' });

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

  const openActivityPicker = useCallback((kind: ActivityPicker, materialKey?: string) => {
    setPickerQuery('');
    setActivityPicker({ kind, materialKey });
  }, []);

  const beginMaterialCreate = useCallback((returnIntent: ActivityMaterialReturnIntent | null = null) => {
    setMaterialCatalogMode('materialCreate');
    setEditingMaterialId(null);
    setMaterialDraft(emptyMaterialDraft());
    setMaterialReturnIntent(returnIntent);
    setMaterialFormError(null);
    setMaterialSaving(false);
  }, []);

  const beginMaterialEdit = useCallback((material: MaterialLibraryItem) => {
    setMaterialCatalogMode('materialEdit');
    setEditingMaterialId(material.id);
    setMaterialDraft(materialDraftFromLibrary(material));
    setMaterialReturnIntent(null);
    setMaterialFormError(null);
    setMaterialSaving(false);
  }, []);

  const beginMaterialDetail = useCallback((materialId: string) => {
    setSelectedMaterialId(materialId);
    setMaterialCatalogMode('materialDetail');
    setArchiveConfirmationMaterialId(null);
    setMaterialFormError(null);
  }, []);

  const openMaterialsLibrary = useCallback(() => {
    setMaterialCatalogMode('library');
    setSelectedMaterialId(null);
    setArchiveConfirmationMaterialId(null);
    setMaterialFormError(null);
    setView('materials');
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
      manualOverride: false,
    }]);
    openActivityPicker('material', key);
  }, [materialUsages.length, openActivityPicker]);

  const beginActivityMaterialCreate = useCallback(() => {
    if (activityPicker?.kind !== 'material' || !activityPicker.materialKey) return;
    const usageKey = activityPicker.materialKey;
    setActivityPicker(null);
    beginMaterialCreate({ source: 'activity', usageKey });
  }, [activityPicker, beginMaterialCreate]);

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
    preferredScope: TodayScope = todayScope,
    preferredDetailPlotId = selectedDetailPlotId,
  ) => {
    const options = await getActivityCaptureOptions(db);
    const resolvedPlotId = options.plots.some((plot) => plot.id === preferredPlotId)
      ? preferredPlotId
      : options.defaultPlotId;
    const plotHoles = options.holes.filter((hole) => hole.plotId === resolvedPlotId);
    const resolvedHoleId = plotHoles.some((hole) => hole.id === preferredHoleId)
      ? preferredHoleId
      : plotHoles[0]?.id ?? null;
    const resolvedScope = preferredScope === 'all' || options.plots.some((plot) => plot.id === preferredScope)
      ? preferredScope
      : 'all';
    const resolvedDetailPlotId = options.plots.some((plot) => plot.id === preferredDetailPlotId)
      ? preferredDetailPlotId
      : resolvedPlotId;
    const [dashboard, caseList, laborLedger, menuDashboard, materials, holeDetail, plotDetail, plotList, categories, people] = await Promise.all([
      getTodayDashboard(db, resolvedScope),
      getCaseList(db),
      getLaborLedger(db),
      getMenuDashboard(db),
      getMaterialLibrary(db),
      getHoleDetail(db, resolvedHoleId ?? undefined),
      getPlotDetail(db, resolvedDetailPlotId),
      listPlotSummaries(db),
      listActivityCategories(db, true),
      listPeople(db, true),
    ]);
    setSelectedPlotId(resolvedPlotId);
    setSelectedHoleId(resolvedHoleId);
    setTodayScope(resolvedScope);
    setSelectedDetailPlotId(resolvedDetailPlotId);
    const resolvedCaseId = caseList.some((caseItem) => caseItem.id === caseId) ? caseId : caseList[0]?.id ?? 'case-a-014';
    const caseTimeline = await getCaseTimeline(db, resolvedCaseId);
    setSelectedCaseId(resolvedCaseId);
    setState({ status: 'ready', db, dashboard, options, caseList, caseTimeline, laborLedger, menuDashboard, materials, holeDetail, plotDetail, plotList, categories, people, message });
  }, [selectedCaseId, selectedDetailPlotId, selectedHoleId, selectedPlotId, todayScope]);

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
      setSelectedDetailPlotId(plotId);
      await refresh(state.db, 'เพิ่มแปลงแล้ว', selectedCaseId, selectedPlotId, selectedHoleId, todayScope, plotId);
      setPlotDraft({ name: '', areaRai: 0 });
      setView('plotDetail');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'เพิ่มแปลงไม่สำเร็จ');
    }
  }, [plotDraft, refresh, selectedCaseId, selectedHoleId, selectedPlotId, state, todayScope]);

  const openPlotDetail = useCallback((plotId: string) => {
    if (state.status !== 'ready') return;
    setSelectedDetailPlotId(plotId);
    setView('plotDetail');
    void refresh(state.db, null, selectedCaseId, selectedPlotId, selectedHoleId, todayScope, plotId);
  }, [refresh, selectedCaseId, selectedHoleId, selectedPlotId, state, todayScope]);

  const startPlotActivity = useCallback((plotId: string) => {
    setSelectedPlotId(plotId);
    setSelectedTarget('plot');
    setSelectedTargetId(plotId);
    setView('activity');
  }, []);

  const selectTodayScope = useCallback((scope: TodayScope) => {
    if (state.status !== 'ready') return;
    setTodayScope(scope);
    void refresh(state.db, null, selectedCaseId, selectedPlotId, selectedHoleId, scope, selectedDetailPlotId);
  }, [refresh, selectedCaseId, selectedDetailPlotId, selectedHoleId, selectedPlotId, state]);

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
      setPlantingDraft({ holeId, plantName: '', variety: '', plantedOn: localDateKey() });
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกต้นไม้ไม่สำเร็จ');
    }
  }, [plantingDraft, refresh, selectedCaseId, selectedHoleId, selectedPlotId, state]);

  const retirePlanting = useCallback(async (status: 'dead' | 'retired') => {
    if (state.status !== 'ready' || !selectedHoleId) return;
    try {
      await retireCurrentPlanting(state.db, {
        holeId: selectedHoleId,
        status,
        removedOn: retirementDate,
        removedReason: retirementReason,
      });
      setPlantingDraft((draft) => ({ ...draft, holeId: selectedHoleId, plantedOn: localDateKey() }));
      await refresh(state.db, status === 'dead' ? 'บันทึกว่าต้นตายแล้ว · หลุมพร้อมปลูกใหม่' : 'นำต้นออกแล้ว · หลุมพร้อมปลูกใหม่', selectedCaseId, selectedPlotId, selectedHoleId);
      setRetirementReason('');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกการนำต้นออกไม่สำเร็จ');
    }
  }, [refresh, retirementDate, retirementReason, selectedCaseId, selectedHoleId, selectedPlotId, state]);

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
      setActivityPicker(null);
    } catch (error) {
      if (activityPicker.kind === 'material') {
        setMaterialFormError(error instanceof Error ? error.message : 'เพิ่มวัสดุไม่สำเร็จ');
        return;
      }
      await refresh(state.db, error instanceof Error ? error.message : 'เพิ่มรายการไม่สำเร็จ');
    }
  }, [activityPicker, categoryDraft, personDraft, plotDraft, refresh, rememberPicker, selectedCaseId, state]);

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
      setMaterialUsages((rows) => rows.map((row) => row.key === activityPicker.materialKey ? {
        ...row,
        materialId: id,
        amount: '',
        actualTankLitres: '',
        manualAmount: '',
        manualOverride: false,
        unit: material?.unit ?? row.unit,
      } : row));
      setMaterialDetailKey(activityPicker.materialKey ?? null);
      setMaterialReturnIntent(null);
      setMaterialFormError(null);
    }
    if (activityPicker.kind === 'worker') setSelectedWorkerId(id === 'self' ? null : id);
    if (activityPicker.kind === 'worker') setActivityWorkers((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, personId: id } : row));
    if (activityPicker.kind === 'payType') setActivityWorkers((rows) => rows.map((row) => row.key === activityPicker.materialKey ? { ...row, payType: id as WorkerDraft['payType'] } : row));
    rememberPicker(activityPicker.kind, id);
    setActivityPicker(null);
  }, [activityPicker, refresh, rememberPicker, selectedCaseId, state]);

  const saveMaterial = useCallback(async () => {
    if (state.status !== 'ready') return;
    if (materialSaving) return;
    const validationError = validateMaterialCatalogDraft(materialDraft);
    if (validationError) {
      setMaterialFormError(validationError);
      return;
    }
    setMaterialSaving(true);
    try {
      const input = materialInputForSave(materialDraft);
      const isEditing = materialCatalogMode === 'materialEdit' && Boolean(editingMaterialId);
      const materialId = isEditing
        ? (await updateMaterial(state.db, editingMaterialId!, input), editingMaterialId!)
        : await createMaterial(state.db, input);
      await refresh(state.db, isEditing ? 'แก้ไขวัสดุแล้ว' : 'เพิ่มวัสดุแล้ว');
      if (!isEditing && materialReturnIntent?.source === 'activity') {
        setMaterialUsages((rows) => rows.map((row) => row.key === materialReturnIntent.usageKey
          ? { ...row, materialId, unit: input.referenceUnit?.trim() || input.unit.trim() }
          : row));
        setMaterialDetailKey(materialReturnIntent.usageKey);
        rememberPicker('material', materialId);
        setActivityPicker(null);
        setMaterialReturnIntent(null);
        setMaterialDraft(emptyMaterialDraft());
        setMaterialCatalogMode('library');
        setMaterialFormError(null);
        setMaterialSaving(false);
        setView('activity');
        return;
      }
      setMaterialDraft(emptyMaterialDraft());
      setEditingMaterialId(null);
      setMaterialCatalogMode(isEditing ? 'materialDetail' : 'library');
      setMaterialFormError(null);
      setMaterialSaving(false);
      setView('materials');
    } catch (error) {
      setMaterialFormError(error instanceof Error ? error.message : 'บันทึกวัสดุไม่สำเร็จ');
      setMaterialSaving(false);
    }
  }, [editingMaterialId, materialCatalogMode, materialDraft, materialReturnIntent, materialSaving, refresh, rememberPicker, state]);

  const cancelMaterialForm = useCallback(() => {
    if (materialReturnIntent?.source === 'activity') {
      const usageKey = materialReturnIntent.usageKey;
      setMaterialCatalogMode('library');
      setMaterialDraft(emptyMaterialDraft());
      setMaterialFormError(null);
      setMaterialSaving(false);
      setMaterialReturnIntent(null);
      setActivityPicker({ kind: 'material', materialKey: usageKey });
      return;
    }
    const returnToDetail = materialCatalogMode === 'materialEdit' && Boolean(selectedMaterialId);
    setMaterialCatalogMode(returnToDetail ? 'materialDetail' : 'library');
    setEditingMaterialId(null);
    setMaterialDraft(emptyMaterialDraft());
    setMaterialFormError(null);
    setMaterialSaving(false);
  }, [materialCatalogMode, materialReturnIntent, selectedMaterialId]);

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
    setArchiveConfirmationMaterialId(null);
    if (!archivedAt) setMaterialUsages((rows) => rows.filter((row) => row.materialId !== materialId));
  }, [refresh, state]);

  const toggleTracker = useCallback(async (categoryId: string, pinned: boolean) => {
    if (state.status !== 'ready') return;
    if (pinned) await unpinPlotTracker(state.db, state.plotDetail.plot.id, categoryId);
    else await pinPlotTracker(state.db, state.plotDetail.plot.id, categoryId);
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
    if (activitySaveState.status === 'saving') return;
    const baseValidationErrors = mode === 'field' ? validateActivityDraft({
      activityDate: activityDateDraft,
      timeMode,
      startedAt: startedAtDraft,
      endedAt: endedAtDraft,
      durationMinutes: durationMinutesDraft,
      materials: materialUsages,
      workers: activityWorkers,
    }) : [];
    const materialUsageErrors = mode === 'field'
      ? materialUsages.flatMap((usage, index) => {
        const error = materialUsageValidationError(usage, state.options.materials.find((material) => material.id === usage.materialId));
        return error ? [`วัสดุ ${index + 1}: ${error}`] : [];
      })
      : [];
    const validationErrors = [...baseValidationErrors, ...materialUsageErrors];
    if (validationErrors.length) {
      setActivitySaveState({ status: 'error', message: 'ยังบันทึกไม่ได้ กรุณาตรวจรายการที่แจ้ง', errors: validationErrors });
      return;
    }
    setActivitySaveState({ status: 'saving' });
    try {
      let completionMessage = selectedTarget === 'case' ? 'เพิ่มบันทึกเคสแล้ว' : 'บันทึกกิจกรรมแล้ว';
      let createdActivityId: string | undefined;
      if (mode === 'demo') {
        createdActivityId = (await createDemoSprayActivity(state.db)).activityId;
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
          note: note.trim() || `${category.name} ${options.plots.find((item) => item.id === selectedPlotId)?.name ?? 'แปลง'}`,
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
              amount: usage.manualOverride && Number(usage.manualAmount) > 0 ? Number(usage.manualAmount) : calculatedAmount ?? Number(usage.amount),
              unit: material?.referenceUnit || usage.unit,
              waterVolume: usage.actualTankLitres ? Number(usage.actualTankLitres) : usage.waterVolume ? Number(usage.waterVolume) : null,
              waterUnit: usage.actualTankLitres ? 'L' : usage.waterUnit || null,
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
              manualAmount: usage.manualOverride && usage.manualAmount ? Number(usage.manualAmount) : null,
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
        createdActivityId = created.activityId;
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
      setActivitySaveState({ status: 'success', activityId: createdActivityId, message: completionMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ';
      setActivitySaveState({ status: 'error', message, errors: [message] });
    }
  }, [
    activitySaveState.status,
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
    if (view === 'plot' || view === 'plotList' || view === 'plotCreate' || view === 'plotDetail' || view === 'trackerManage' || view === 'cases') return 'work';
    if (view === 'activity') return 'record';
    if (view === 'labor' || view === 'workers') return 'people';
    if (view === 'materials' || view === 'hole' || view === 'menu' || view === 'categories') return 'more';
    if (view === 'designLab') return 'more';
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
  const plot = state.plotDetail.plot;
  const todayPlots = dashboard.plots;
  const todayAreaRai = todayPlots.reduce((total, item) => total + item.areaRai, 0);
  const todayHoles = todayPlots.reduce((total, item) => total + item.totalHoles, 0);
  const todayPlantedHoles = todayPlots.reduce((total, item) => total + item.plantedHoles, 0);
  const todayTrackers = todayPlots.flatMap((item) => item.trackers.map((tracker) => ({ ...tracker, plotName: item.name })));
  const visibleCatalogMaterials = filterMaterialLibraryItems(state.materials, {
    archived: showArchivedMaterials,
    query: materialSearch,
    type: materialTypeFilter,
  });
  const selectedCatalogMaterial = selectedMaterialId
    ? state.materials.find((material) => material.id === selectedMaterialId) ?? null
    : null;
  const screenTitle =
    view === 'plot' || view === 'plotList'
      ? 'แปลง'
      : view === 'plotCreate'
        ? 'เพิ่มแปลง'
        : view === 'plotDetail'
          ? state.plotDetail.plot.name
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
      <Text style={styles.sheetCaption}>หาและเลือกวัสดุจากคลังได้ทันที หรือเพิ่มรายการใหม่ในหน้าถัดไป</Text>
      <PrimaryButton label="+ เพิ่มวัสดุใหม่" onPress={beginActivityMaterialCreate} />
    </>
  ) : undefined;

  const materialDetail = materialDetailKey ? materialUsages.find((usage) => usage.key === materialDetailKey) ?? null : null;
  const materialDetailItem = materialDetail ? options.materials.find((material) => material.id === materialDetail.materialId) ?? null : null;
  const materialDetailCalculatedDose = materialDetailItem?.referenceAmount == null || !materialDetail?.actualTankLitres
    ? null
    : calculateChemicalDose(materialDetailItem.referenceAmount, Number(materialDetail.actualTankLitres), materialDetailItem.referenceWaterLitres ?? 200);
  const materialDetailError = materialDetail ? materialUsageValidationError(materialDetail, materialDetailItem) : null;
  const patchMaterialUsage = (key: string, patch: Partial<MaterialUsageDraft>) => {
    setMaterialUsages((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row));
  };

  return (
    <AppShell activeTab={activeTab} onTabPress={(tab) => {
      if (tab === 'today') setView('today');
      if (tab === 'work') setView('plotList');
      if (tab === 'record') setView('activity');
      if (tab === 'people') setView('workers');
      if (tab === 'more') setView('menu');
    }}>
      <TopBar title={screenTitle} actionLabel="ออฟไลน์" />

      {message ? <StatusChip label={message} variant={message.includes('ไม่') ? 'overdue' : 'active'} /> : null}

      {view === 'today' ? (
        <>
          <SectionHeader title={dashboard.gardenName} actionLabel="บันทึก" onActionPress={() => setView('activity')} />
          <FieldCard>
            <Text style={styles.eyebrow}>ขอบเขตวันนี้</Text>
            <View style={styles.chipWrap}>
              <SelectPill active={todayScope === 'all'} label="ทุกแปลง" onPress={() => selectTodayScope('all')} />
              {options.plots.map((item) => <SelectPill active={todayScope === item.id} key={item.id} label={item.name} onPress={() => selectTodayScope(item.id)} />)}
            </View>
            <Text style={styles.muted}>เลือกเพื่อดูภาพรวมเท่านั้น — แปลงในแบบบันทึกยังเป็นรายการที่เลือกไว้เอง</Text>
          </FieldCard>
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>ภาพรวมวันนี้</Text>
                <Text style={styles.title}>{todayScope === 'all' ? 'ทุกแปลง' : todayPlots[0]?.name}</Text>
                <Text style={styles.muted}>{todayScope === 'all' ? `${todayPlots.length} แปลงในสวน` : (todayPlots[0]?.activeCrop ? `${todayPlots[0].activeCrop.label} · เปิดมา ${todayPlots[0].activeCrop.activeDays} วัน` : 'ยังไม่มี crop active')}</Text>
              </View>
              <StatusChip label="Local" variant="offline" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="พื้นที่" value={`${todayAreaRai} ไร่`} />
              <Metric label="หลุมปลูก" value={`${todayPlantedHoles}/${todayHoles}`} />
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

          <SectionHeader title="Tracker สำคัญ" actionLabel="แปลง" onActionPress={() => setView('plotList')} />
          {todayTrackers.map((tracker) => (
            <TrackerCard
              key={`${tracker.plotName}-${tracker.categoryId}`}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เคยบันทึก' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={formatFollowUpDueLabel(tracker.nextDueOn) ?? undefined}
              progress={tracker.progress}
              title={`${tracker.title} · ${tracker.plotName}`}
              variant={tracker.dueState === 'overdue' ? 'overdue' : tracker.categoryId === 'cat-spray' ? 'spray' : tracker.categoryId === 'cat-fertilizer' ? 'fertilizer' : 'pruning'}
            />
          ))}

          <SectionHeader title="สมุดที่ต้องดู" />
          <View style={styles.quickGrid}>
            <QuickAction label="เคส" value={`${todayPlots.reduce((count, item) => count + item.activeCases.length, 0)} ติดตาม`} onPress={() => setView('cases')} />
            <QuickAction label="ค่าแรง" value={`${dashboard.unpaidLaborTotal.toLocaleString('th-TH')} บาท`} onPress={() => setView('labor')} />
            <QuickAction label="วัสดุ" value={`${state.materials.length} รายการ`} onPress={openMaterialsLibrary} />
          </View>
        </>
      ) : null}

      {view === 'plot' || view === 'plotList' ? (
        <>
          <View style={styles.list}>
            {state.plotList.map((item) => <RecordListItem key={item.id} title={item.name} meta={`${item.areaRai} ไร่ · ปลูกแล้ว ${item.plantedHoles}/${item.totalHoles} หลุม`} trailing={item.emptyHoles ? `ว่าง ${item.emptyHoles}` : 'ครบ'} variant="hole" onPress={() => openPlotDetail(item.id)} />)}
          </View>
          <PrimaryButton label="+ เพิ่มแปลง" onPress={() => setView('plotCreate')} />
        </>
      ) : null}

      {view === 'plotCreate' ? <>
        <FieldCard variant="raised"><Text style={styles.cardTitle}>เพิ่มแปลงใหม่</Text><Text style={styles.muted}>เริ่มด้วยชื่อแปลงและพื้นที่ก่อน ส่วนหลุมกับต้นไม้จัดการจากหน้ารายละเอียดภายหลัง</Text></FieldCard>
        <FieldCard><Text style={styles.inputLabel}>ชื่อแปลง</Text><TextInput onChangeText={(name) => setPlotDraft((draft) => ({ ...draft, name }))} placeholder="เช่น แปลงหลังบ้าน" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={plotDraft.name} /><Text style={styles.inputLabel}>พื้นที่ (ไร่, ไม่บังคับ)</Text><TextInput keyboardType="decimal-pad" onChangeText={(value) => setPlotDraft((draft) => ({ ...draft, areaRai: Number(value) || 0 }))} placeholder="0" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={plotDraft.areaRai ? String(plotDraft.areaRai) : ''} /><PrimaryButton label="บันทึกแปลง" onPress={() => void savePlot()} /></FieldCard>
        <PrimaryButton label="กลับรายชื่อแปลง" onPress={() => setView('plotList')} variant="secondary" />
      </> : null}

      {view === 'plotDetail' ? <>
        <FieldCard variant="raised"><View style={styles.heroRow}><View><Text style={styles.eyebrow}>{plot.activeCrop?.label ?? 'แปลงที่ใช้งานอยู่'}</Text><Text style={styles.title}>{plot.areaRai} ไร่</Text></View><StatusChip label="Active" variant="active" /></View><View style={styles.summaryGrid}><Metric label="หลุมทั้งหมด" value={`${plot.totalHoles}`} /><Metric label="มีต้น" value={`${plot.plantedHoles}`} /><Metric label="หลุมว่าง" value={`${plot.emptyHoles}`} /></View></FieldCard>
        <PrimaryButton label="บันทึกกิจกรรมแปลงนี้" onPress={() => startPlotActivity(plot.id)} />
        <SectionHeader title="ต้นไม้และหลุม" />
        <View style={styles.list}>{state.plotDetail.holes.map((hole) => <RecordListItem key={hole.id} title={`หลุม ${hole.marker}`} meta={hole.status === 'planted' ? 'มีต้นปลูกแล้ว' : 'หลุมว่าง พร้อมปลูก'} trailing={hole.status === 'planted' ? 'ต้นไม้' : 'ว่าง'} variant="hole" onPress={() => { setSelectedHoleId(hole.id); setView('hole'); }} />)}</View>
        <SectionHeader title="Tracker ที่ติดตาม" actionLabel="จัดการ" onActionPress={() => setView('trackerManage')} />
        {plot.trackers.map((tracker) => <TrackerCard key={tracker.categoryId} countLabel={`ครั้งที่ ${tracker.count}`} elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เริ่ม' : `ผ่านมา ${tracker.elapsedDays} วัน`} nextDueLabel={formatFollowUpDueLabel(tracker.nextDueOn) ?? undefined} progress={tracker.progress} title={tracker.title} variant={tracker.dueState === 'overdue' ? 'overdue' : 'custom'} />)}
        <SectionHeader title="เคสและประวัติ" />
        <View style={styles.list}>{plot.activeCases.map((caseItem) => <RecordListItem key={caseItem.id} meta={caseItem.targetLabel} onPress={() => openCase(caseItem.id)} title={caseItem.title} trailing={caseItem.statusLabel} variant="case" />)}{state.plotDetail.recentItems.map((item) => <RecordListItem key={item.id} meta={item.meta} title={item.title} trailing={item.trailing} variant={item.variant} />)}</View>
        <PrimaryButton label="กลับรายชื่อแปลง" onPress={() => setView('plotList')} variant="secondary" />
      </> : null}

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
          <PrimaryButton label="กลับแปลง" onPress={() => setView('plotDetail')} variant="secondary" />
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
              <DatePickerField label="วันที่ทำงาน" onChange={setActivityDateDraft} value={activityDateDraft} />
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
              const usageError = materialUsageValidationError(usage, selected);
              const calculated = selected?.referenceAmount == null || !usage.actualTankLitres
                ? null
                : calculateChemicalDose(selected.referenceAmount, Number(usage.actualTankLitres), selected.referenceWaterLitres ?? 200);
              const amountLabel = usage.manualOverride && usage.manualAmount
                ? `${usage.manualAmount} ${selected?.referenceUnit ?? usage.unit} · กำหนดเอง`
                : calculated != null
                  ? `${calculated} ${selected?.referenceUnit ?? usage.unit} · อัตโนมัติ`
                  : usage.amount
                    ? `${usage.amount} ${usage.unit}`
                    : 'แตะเพื่อใส่ถังหรือปริมาณ';
              return (
                <MaterialSummary
                  key={usage.key}
                  label={selected ? [selected.commonName, selected.brandName].filter(Boolean).join(' · ') || selected.name : `วัสดุ ${index + 1}`}
                  meta={selected ? `${amountLabel}${usage.actualTankLitres ? ` · ถัง ${usage.actualTankLitres} L` : ''}` : 'ยังไม่ได้เลือกวัสดุ'}
                  onOpen={() => selected ? setMaterialDetailKey(usage.key) : openActivityPicker('material', usage.key)}
                  onRemove={() => setMaterialUsages((rows) => rows.filter((row) => row.key !== usage.key))}
                  error={usageError}
                />
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
              {followUpMode === 'days' ? <><Text style={styles.inputLabel}>ติดตามอีกกี่วัน</Text><TextInput keyboardType="numeric" onChangeText={setFollowUpDays} placeholder="เช่น 7" style={styles.input} value={followUpDays} /></> : <DatePickerField label="วันติดตาม" onChange={setFollowUpDateDraft} value={followUpDateDraft || activityDateDraft} />}
              {followUpPreview.error ? <Text style={styles.danger}>{followUpPreview.error}</Text> : followUpPreview.followUpOn ? <View style={styles.followUpSummary}><Text style={styles.cardTitle}>นัดติดตาม {formatThaiShortDate(followUpPreview.followUpOn)}</Text><Text style={styles.muted}>{formatFollowUpDueLabel(followUpPreview.followUpOn) ?? ''}</Text></View> : <Text style={styles.muted}>ปล่อยว่างหรือใส่ 0 ได้ หากงานนี้ไม่มีวันติดตาม</Text>}
              {followUpPreview.followUpOn && followUpDaysRemaining(followUpPreview.followUpOn) !== null && followUpDaysRemaining(followUpPreview.followUpOn)! > 0 ? <View style={styles.reminderPanel}>
                <Text style={styles.cardTitle}>เตือนในเครื่อง (ไม่บังคับ)</Text>
                {notificationPermission === 'granted' ? <Text style={styles.muted}>เปิดแล้ว · เมื่อบันทึก ระบบจะตั้งเตือนครั้งเดียวในเช้าวันนัด</Text> : notificationPermission === 'denied' ? <Text style={styles.muted}>ถูกปิดอยู่ · วันติดตามยังบันทึกและแสดงในวันนี้ได้ตามปกติ</Text> : notificationPermission === 'unavailable' ? <Text style={styles.muted}>ตั้งเตือนได้เมื่อเปิดบนแอป Android หรือ iOS</Text> : <><Text style={styles.muted}>ขออนุญาตเฉพาะเมื่อคุณเลือกจะใช้การเตือนนี้</Text><PrimaryButton label="เปิดการแจ้งเตือนวันติดตาม" onPress={() => void requestReminderPermission()} variant="secondary" /></>}
              </View> : null}
            </FieldCard>
          </FormSection> : null}
          {activitySaveState.status === 'error' ? <FieldCard variant="alert"><Text style={styles.cardTitle}>{activitySaveState.message}</Text>{activitySaveState.errors?.map((error) => <Text key={error} style={styles.danger}>• {error}</Text>)}</FieldCard> : null}
          {activitySaveState.status === 'success' ? <FieldCard variant="summary"><Text style={styles.cardTitle}>บันทึกสำเร็จ</Text><Text style={styles.muted}>{activitySaveState.message}</Text><Text style={styles.receipt}>เลขที่บันทึก: {activitySaveState.activityId ?? '-'}</Text></FieldCard> : null}
          <StickySaveBar disabled={activitySaveState.status === 'saving'} label={activitySaveState.status === 'saving' ? 'กำลังบันทึก…' : 'บันทึกกิจกรรมลงเครื่อง'} onPress={() => void createActivity('field')} />
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
              onPress={openMaterialsLibrary}
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
              onPress={() => setView('plotList')}
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
          {materialCatalogMode === 'materialDetail' && selectedCatalogMaterial ? <>
            <FieldCard variant="raised">
              <Text style={styles.eyebrow}>{selectedCatalogMaterial.archivedAt ? 'อยู่ในคลัง' : 'ใช้เลือกในกิจกรรมใหม่ได้'}</Text>
              <Text style={styles.title}>{selectedCatalogMaterial.commonName || selectedCatalogMaterial.name}</Text>
              {selectedCatalogMaterial.brandName ? <Text style={styles.muted}>ยี่ห้อ {selectedCatalogMaterial.brandName}</Text> : null}
              <Text style={styles.muted}>{materialTypeLabel(selectedCatalogMaterial.type as MaterialInput['type'])} · {selectedCatalogMaterial.unit}</Text>
            </FieldCard>
            <SectionHeader title="ข้อมูลการใช้" />
            <View style={styles.list}>
              <RecordListItem title="อัตราเริ่มต้น" meta={selectedCatalogMaterial.referenceAmount != null ? `${selectedCatalogMaterial.referenceAmount} ${selectedCatalogMaterial.referenceUnit ?? selectedCatalogMaterial.unit} / น้ำ ${selectedCatalogMaterial.referenceWaterLitres ?? 200} L` : 'ยังไม่ได้ตั้งอัตรา ใช้ระบุปริมาณจริงตอนบันทึกกิจกรรม'} trailing="ค่าเริ่มต้น" variant="material" />
              <RecordListItem title="ประวัติการใช้" meta={selectedCatalogMaterial.lastUsedAt ? `ใช้ล่าสุด ${formatThaiShortDate(selectedCatalogMaterial.lastUsedAt)}` : 'ยังไม่เคยถูกบันทึกในกิจกรรม'} trailing={`${selectedCatalogMaterial.usageCount} ครั้ง`} variant="activity" />
              {selectedCatalogMaterial.notes ? <RecordListItem title="รายละเอียด" meta={selectedCatalogMaterial.notes} trailing="โน้ต" variant="material" /> : null}
            </View>
            <PrimaryButton label="แก้ไขวัสดุ" onPress={() => beginMaterialEdit(selectedCatalogMaterial)} />
            {selectedCatalogMaterial.archivedAt ? <>
              <Text style={styles.muted}>นำกลับมาใช้แล้ว วัสดุนี้จะกลับไปให้เลือกในกิจกรรมใหม่ ประวัติก่อนหน้ายังอยู่ครบ</Text>
              <PrimaryButton label="นำกลับมาใช้" onPress={() => void toggleMaterialArchive(selectedCatalogMaterial.id, selectedCatalogMaterial.archivedAt)} variant="secondary" />
            </> : archiveConfirmationMaterialId === selectedCatalogMaterial.id ? <FieldCard variant="alert">
              <Text style={styles.cardTitle}>เก็บวัสดุเข้าคลัง?</Text>
              <Text style={styles.muted}>วัสดุนี้จะหายจากตัวเลือกของกิจกรรมใหม่เท่านั้น ประวัติการใช้และ snapshot เดิมจะไม่ถูกลบ</Text>
              <PrimaryButton label="ยืนยันเก็บเข้าคลัง" onPress={() => void toggleMaterialArchive(selectedCatalogMaterial.id, null)} variant="tertiary" />
              <PrimaryButton label="ยังไม่เก็บ" onPress={() => setArchiveConfirmationMaterialId(null)} variant="secondary" />
            </FieldCard> : <PrimaryButton label="เก็บเข้าคลัง" onPress={() => setArchiveConfirmationMaterialId(selectedCatalogMaterial.id)} variant="tertiary" />}
            <PrimaryButton label="กลับคลังวัสดุ" onPress={() => { setMaterialCatalogMode('library'); setSelectedMaterialId(null); }} variant="secondary" />
          </> : <>
            <FieldCard variant="raised">
              <Text style={styles.eyebrow}>คลังวัสดุ</Text>
              <Text style={styles.cardTitle}>ยา ปุ๋ย และวัสดุที่เลือกใช้ซ้ำได้</Text>
              <Text style={styles.muted}>แตะรายการเพื่อดูรายละเอียด · เก็บเข้าคลังจะซ่อนจากบันทึกใหม่ แต่ประวัติยังอ่านได้ครบ</Text>
            </FieldCard>
            {materialCatalogMode !== 'materialCreate' && materialCatalogMode !== 'materialEdit' ? <PrimaryButton label="+ เพิ่มวัสดุ" onPress={() => beginMaterialCreate()} /> : null}
            <SectionHeader title={showArchivedMaterials ? 'วัสดุในคลัง' : 'วัสดุที่ใช้งาน'} />
            <View style={styles.catalogControls}>
              <TextInput onChangeText={setMaterialSearch} placeholder="ค้นหาชื่อ ชื่อสามัญ หรือโน้ต" placeholderTextColor={tokens.color.text.muted} style={styles.input} value={materialSearch} />
              <View style={styles.chipWrap}>
                <SelectPill active={!showArchivedMaterials} label="กำลังใช้" onPress={() => setShowArchivedMaterials(false)} />
                <SelectPill active={showArchivedMaterials} label="ในคลัง" onPress={() => setShowArchivedMaterials(true)} />
              </View>
              <View style={styles.chipWrap}>
                {([['all', 'ทั้งหมด'], ['chemical', 'สารเคมี'], ['fertilizer', 'ปุ๋ย'], ['other', 'อื่น ๆ']] as const).map(([filter, label]) => <SelectPill active={materialTypeFilter === filter} key={filter} label={label} onPress={() => setMaterialTypeFilter(filter)} />)}
              </View>
            </View>
            <View style={styles.list}>
              {visibleCatalogMaterials.map((material) => (
                <RecordListItem
                  key={material.id}
                  meta={`${materialTypeLabel(material.type as MaterialInput['type'])} · ${material.defaultRatePerTank ?? material.unit} · ใช้แล้ว ${material.usageCount} ครั้ง`}
                  onPress={() => beginMaterialDetail(material.id)}
                  title={material.commonName || material.name}
                  trailing="ดู"
                  variant="material"
                />
              ))}
              {visibleCatalogMaterials.length === 0 ? <RecordListItem title={materialSearch ? 'ไม่พบวัสดุที่ค้นหา' : showArchivedMaterials ? 'ยังไม่มีวัสดุในคลัง' : 'ยังไม่มีวัสดุที่ใช้งาน'} meta={materialSearch ? 'ลองค้นหาด้วยชื่อสามัญ ยี่ห้อ หรือโน้ต' : 'กด + เพิ่มวัสดุ เพื่อเริ่มสร้างคลัง'} trailing="" variant="material" /> : null}
            </View>
            <PrimaryButton label="บันทึกกิจกรรม" onPress={() => setView('activity')} variant="secondary" />
          </>}
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
          <SectionHeader title="วงจรต้นไม้" />
          <View style={styles.list}>
            {state.holeDetail.lifecycle.map((planting) => (
              <RecordListItem
                key={planting.id}
                title={`${planting.plantName}${planting.variety ? ` · ${planting.variety}` : ''}`}
                meta={planting.removedOn ? `ปลูก ${formatThaiShortDate(planting.plantedOn)} · จบ ${formatThaiShortDate(planting.removedOn)}${planting.removedReason ? ` · ${planting.removedReason}` : ''}` : `ปลูก ${formatThaiShortDate(planting.plantedOn)} · กำลังปลูก`}
                trailing={planting.status === 'dead' ? 'ตาย' : planting.status === 'retired' ? 'นำออก' : 'ปัจจุบัน'}
                variant="hole"
              />
            ))}
          </View>
          {state.holeDetail.plantName ? (
            <FormSection title="จบวงจรต้นนี้">
              <DatePickerField label="วันที่ตาย/นำออก" onChange={setRetirementDate} value={retirementDate} />
              <TextInput accessibilityLabel="เหตุผลที่ต้นตายหรือนำออก" onChangeText={setRetirementReason} placeholder="เหตุผล (ถ้ามี)" style={styles.input} value={retirementReason} />
              <View style={styles.inlineActions}>
                <PrimaryButton label="บันทึกว่าตาย" onPress={() => void retirePlanting('dead')} variant="tertiary" />
                <PrimaryButton label="นำต้นออก" onPress={() => void retirePlanting('retired')} variant="secondary" />
              </View>
            </FormSection>
          ) : (
            <FormSection title="ปลูกใหม่ในหลุมนี้">
              <TextInput accessibilityLabel="ชื่อต้นที่ปลูกใหม่" onChangeText={(plantName) => setPlantingDraft((draft) => ({ ...draft, plantName }))} placeholder="ชื่อต้น" style={styles.input} value={plantingDraft.plantName} />
              <TextInput accessibilityLabel="พันธุ์ต้นที่ปลูกใหม่" onChangeText={(variety) => setPlantingDraft((draft) => ({ ...draft, variety }))} placeholder="พันธุ์ (ถ้ามี)" style={styles.input} value={plantingDraft.variety ?? ''} />
              <DatePickerField label="วันที่ปลูก" onChange={(plantedOn) => setPlantingDraft((draft) => ({ ...draft, plantedOn }))} value={plantingDraft.plantedOn} />
              <PrimaryButton label="ปลูกต้นใหม่" onPress={() => void savePlanting()} />
            </FormSection>
          )}
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
      <Modal animationType="slide" onRequestClose={cancelMaterialForm} presentationStyle="pageSheet" transparent visible={(view === 'materials' || materialReturnIntent?.source === 'activity') && (materialCatalogMode === 'materialCreate' || materialCatalogMode === 'materialEdit')}>
        <View style={styles.materialSheetBackdrop}>
          <View style={styles.materialSheet}>
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>{materialCatalogMode === 'materialEdit' ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุ'}</Text><Text style={styles.muted}>{materialCatalogMode === 'materialEdit' ? 'แก้เฉพาะข้อมูลในคลัง ประวัติใช้เดิมไม่เปลี่ยน' : materialReturnIntent?.source === 'activity' ? 'เพิ่มแล้วจะกลับไปกำหนดปริมาณในกิจกรรมนี้' : 'เริ่มจากข้อมูลที่จำเป็นก่อน'}</Text></View>
              <Pressable accessibilityRole="button" onPress={cancelMaterialForm}><Text style={styles.close}>ยกเลิก</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <MaterialCatalogFormFields draft={materialDraft} onChange={setMaterialDraft} />
              {materialFormError ? <Text style={styles.danger}>{materialFormError}</Text> : null}
            </ScrollView>
            <StickySaveBar disabled={materialSaving} label={materialSaving ? 'กำลังบันทึก…' : materialCatalogMode === 'materialEdit' ? 'บันทึกการแก้ไข' : materialReturnIntent?.source === 'activity' ? 'เพิ่มและใช้กับกิจกรรมนี้' : 'เพิ่มวัสดุ'} onPress={() => void saveMaterial()} />
          </View>
        </View>
      </Modal>
      <Modal animationType="slide" onRequestClose={() => setMaterialDetailKey(null)} presentationStyle="pageSheet" transparent visible={Boolean(materialDetail && materialDetailItem)}>
        <View style={styles.materialSheetBackdrop}>
          <View style={styles.materialSheet}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>กำหนดปริมาณวัสดุ</Text><Pressable accessibilityRole="button" onPress={() => setMaterialDetailKey(null)}><Text style={styles.close}>ปิด</Text></Pressable></View>
            {materialDetail && materialDetailItem ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.chemicalTitle}>{[materialDetailItem.commonName, materialDetailItem.brandName].filter(Boolean).join(' · ') || materialDetailItem.name}</Text>
              <Text style={styles.muted}>อ้างอิง {materialDetailItem.referenceAmount ?? '—'} {materialDetailItem.referenceUnit ?? materialDetailItem.unit} / น้ำ {materialDetailItem.referenceWaterLitres ?? 200} L</Text>
              {materialDetailItem.referenceAmount != null ? <>
                <Text style={styles.inputLabel}>น้ำในถังครั้งนี้ (L)</Text>
                <TextInput keyboardType="decimal-pad" onChangeText={(actualTankLitres) => patchMaterialUsage(materialDetail.key, { actualTankLitres })} placeholder="เช่น 50" style={styles.input} value={materialDetail.actualTankLitres} />
                {materialDetailCalculatedDose != null && Number(materialDetail.actualTankLitres) > 0 ? <View style={styles.lockedDose}><Text style={styles.calculatedDose}>ปริมาณที่ต้องใช้: {materialDetailCalculatedDose} {materialDetailItem.referenceUnit ?? materialDetailItem.unit}</Text><Text style={styles.muted}>คำนวณจากอัตราอ้างอิงแล้ว · ปริมาณนี้ล็อกไว้</Text></View> : <Text style={styles.muted}>ต้องระบุน้ำในถังให้มากกว่า 0 L ก่อน ระบบจึงคำนวณปริมาณให้</Text>}
              </> : <>
                <Text style={styles.inputLabel}>ปริมาณที่ใช้ *</Text>
                <View style={styles.formRow}><TextInput keyboardType="decimal-pad" onChangeText={(amount) => patchMaterialUsage(materialDetail.key, { amount })} placeholder="เช่น 20" style={[styles.input, styles.formCell]} value={materialDetail.amount} /><TextInput onChangeText={(unit) => patchMaterialUsage(materialDetail.key, { unit })} placeholder={materialDetailItem.unit} style={[styles.input, styles.formCell]} value={materialDetail.unit} /></View>
              </>}
              <Text style={styles.inputLabel}>รายละเอียดเพิ่มเติม (ถ้ามี)</Text>
              <TextInput multiline onChangeText={(note) => patchMaterialUsage(materialDetail.key, { note })} placeholder="เช่น จุดที่ใช้ หรือข้อสังเกต" style={[styles.input, styles.textAreaSmall]} value={materialDetail.note} />
              {materialDetailError ? <Text style={styles.danger}>{materialDetailError}</Text> : null}
            </ScrollView> : null}
            <StickySaveBar disabled={Boolean(materialDetailError)} label={materialDetailError ? 'กรอกปริมาณให้ครบก่อน' : 'ยืนยันปริมาณ'} onPress={() => setMaterialDetailKey(null)} />
          </View>
        </View>
      </Modal>
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

function MaterialCatalogFormFields({ draft, onChange }: { draft: MaterialInput; onChange: (next: MaterialInput | ((current: MaterialInput) => MaterialInput)) => void }) {
  const [showRate, setShowRate] = useState(draft.referenceAmount != null);
  const [showDetail, setShowDetail] = useState(Boolean(draft.notes));
  const selectUnit = (unit: string) => onChange((current) => ({ ...current, unit, referenceUnit: unit }));
  return <>
    <Text style={styles.inputLabel}>ชื่อสามัญ / ชื่อเรียก *</Text>
    <TextInput autoFocus onChangeText={(name) => onChange((current) => ({ ...current, name }))} placeholder="เช่น แมนโคเซบ" style={styles.input} value={draft.name} />
    <Text style={styles.inputLabel}>ชื่อยี่ห้อ (ถ้ามี)</Text>
    <TextInput onChangeText={(brandName) => onChange((current) => ({ ...current, brandName }))} placeholder="เช่น ไดเทน" style={styles.input} value={draft.brandName ?? ''} />
    <Text style={styles.inputLabel}>ชนิด</Text>
    <View style={styles.unitChoiceRow}>{([['fungicide', 'สารป้องกัน'], ['fertilizer', 'ปุ๋ย'], ['other', 'อื่น ๆ']] as const).map(([type, label]) => <SelectPill active={draft.type === type} key={type} label={label} onPress={() => onChange((current) => ({ ...current, type }))} />)}</View>
    <Text style={styles.inputLabel}>หน่วย *</Text>
    <View style={styles.unitChoiceRow}>{['cc', 'ml', 'กรัม'].map((unit) => <SelectPill active={(draft.referenceUnit ?? draft.unit) === unit} key={unit} label={unit} onPress={() => selectUnit(unit)} />)}</View>
    <TextInput onChangeText={selectUnit} placeholder="หรือพิมพ์หน่วยเอง เช่น g" style={styles.input} value={draft.referenceUnit ?? draft.unit} />
    <Pressable accessibilityRole="button" onPress={() => setShowRate((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>อัตราอ้างอิง (ถ้ามี)</Text><Text style={styles.disclosureAction}>{showRate ? 'ซ่อน' : 'เพิ่มอัตรา'}</Text></Pressable>
    {showRate ? <View style={styles.inlineForm}>
      <Text style={styles.inputLabel}>อัตราอ้างอิง</Text>
      <TextInput keyboardType="decimal-pad" onChangeText={(value) => onChange((current) => ({ ...current, referenceAmount: positiveNumberOrNull(value), referenceWaterLitres: current.referenceWaterLitres ?? 200 }))} placeholder="เช่น 20" style={styles.input} value={draft.referenceAmount == null ? '' : String(draft.referenceAmount)} />
      <Text style={styles.inputLabel}>น้ำอ้างอิง (L)</Text>
      <TextInput keyboardType="decimal-pad" onChangeText={(value) => onChange((current) => ({ ...current, referenceWaterLitres: positiveNumberOrNull(value) ?? 200 }))} placeholder="200" style={styles.input} value={String(draft.referenceWaterLitres ?? 200)} />
      <Text style={styles.muted}>หากใส่อัตรา ระบบจะใช้ 200 L เป็นค่าเริ่มต้นและคำนวณจากน้ำในถังตอนบันทึกกิจกรรม</Text>
    </View> : null}
    <Pressable accessibilityRole="button" onPress={() => setShowDetail((value) => !value)} style={styles.disclosure}><Text style={styles.disclosureLabel}>รายละเอียด (ถ้ามี)</Text><Text style={styles.disclosureAction}>{showDetail ? 'ซ่อน' : 'เพิ่มโน้ต'}</Text></Pressable>
    {showDetail ? <TextInput multiline onChangeText={(notes) => onChange((current) => ({ ...current, notes }))} placeholder="เช่น ใช้พ่นป้องกันเชื้อรา" style={[styles.input, styles.textAreaSmall]} value={draft.notes ?? ''} /> : null}
  </>;
}

function MaterialSummary({ error, label, meta, onOpen, onRemove }: { error?: string | null; label: string; meta: string; onOpen: () => void; onRemove: () => void }) {
  return <View style={styles.materialSummary}>
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.materialSummaryMain}>
      <Text numberOfLines={1} style={styles.cardTitle}>{label}</Text>
      <Text numberOfLines={1} style={styles.muted}>{meta}</Text>
      {error ? <Text style={styles.danger}>{error}</Text> : null}
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onRemove} style={styles.materialSummaryRemove}><Text style={styles.removeText}>นำออก</Text></Pressable>
  </View>;
}

function positiveNumberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function materialUsageValidationError(usage: MaterialUsageDraft, material: { referenceAmount?: number | null; unit: string } | null | undefined): string | null {
  if (!material) return 'กรุณาเลือกวัสดุหรือกดนำออก';
  if (material.referenceAmount != null) {
    return Number(usage.actualTankLitres) > 0 ? null : 'กรุณาระบุน้ำในถังให้มากกว่า 0 L';
  }
  if (!(Number(usage.amount) > 0)) return 'กรุณาระบุปริมาณที่ใช้ให้มากกว่า 0';
  if (!usage.unit.trim()) return 'กรุณาระบุหน่วยของปริมาณที่ใช้';
  return null;
}

function materialInputForSave(draft: MaterialInput): MaterialInput {
  const unit = (draft.referenceUnit ?? draft.unit).trim();
  const referenceAmount = draft.referenceAmount != null && draft.referenceAmount > 0 ? draft.referenceAmount : null;
  const referenceWaterLitres = referenceAmount ? draft.referenceWaterLitres ?? 200 : null;
  return {
    ...draft,
    unit,
    commonName: draft.commonName?.trim() || draft.name.trim(),
    referenceAmount,
    referenceUnit: referenceAmount ? unit : null,
    referenceWaterLitres,
    defaultRatePerTank: referenceAmount ? `${referenceAmount} ${unit} / น้ำ ${referenceWaterLitres} L` : draft.defaultRatePerTank ?? null,
  };
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
  catalogControls: {
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
  inlineActions: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
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
  unitChoiceRow: {
    flexDirection: 'row',
    gap: tokens.spacing.control,
  },
  materialSummary: {
    alignItems: 'center',
    borderBottomColor: tokens.color.border.soft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
  },
  materialSummaryMain: {
    flex: 1,
    gap: 3,
    paddingVertical: tokens.spacing.control,
  },
  materialSummaryRemove: {
    paddingLeft: tokens.spacing.control,
  },
  materialSheetBackdrop: {
    backgroundColor: 'rgba(31,45,31,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  materialSheet: {
    backgroundColor: tokens.color.surface.sand,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: tokens.spacing.control,
    maxHeight: '84%',
    padding: tokens.spacing.page,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h2.size,
    fontWeight: '700',
  },
  close: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.body.size,
    fontWeight: '700',
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
  lockedDose: {
    backgroundColor: '#F2F8ED',
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    marginTop: tokens.spacing.control,
    padding: tokens.spacing.control,
  },
  followUpSummary: {
    backgroundColor: '#F2F8ED',
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    marginTop: tokens.spacing.control,
    padding: tokens.spacing.control,
  },
  receipt: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
    marginTop: tokens.spacing.control,
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
