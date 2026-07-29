import type { ActivityCategory, Material } from '../../domain';
import { laborEntriesForParticipants } from '../../domain';
import type { SqlExecutor } from '../../data';
import { currentTimestamp, diffDays, formatThaiShortDate, nextDateFrom } from './date';
import { followUpDueState, formatFollowUpDueLabel } from './followUp';
import { normalizeActivityTemporal } from './temporal';
import type {
  ActivityCaptureOption,
  CaseTimeline,
  CaseListItem,
  ActiveCaseSummary,
  CategoryInput,
  CreateActivityInput,
  CreatedActivityResult,
  HoleDetail,
  LaborLedger,
  MenuDashboard,
  MaterialInput,
  MaterialLibraryItem,
  PlotDashboard,
  PlotDetail,
  PlotInput,
  PlotSummary,
  HoleInput,
  PlantingInput,
  PlantingLifecycle,
  RetirePlantingInput,
  SetupPlot,
  PersonDirectoryItem,
  PersonInput,
  TodayActivityItem,
  TodayDashboard,
  TodayScope,
  TrackerSummary,
} from './types';

type PlotRow = {
  id: string;
  garden_name: string;
  name: string;
  area_rai: number;
};

type CropRow = {
  id: string;
  label: string;
  starts_on: string;
};

type CountRow = {
  count: number;
};

type HoleCountRow = {
  total: number;
  planted: number;
  empty: number;
};

type CaseRow = {
  id: string;
  title: string;
  status: string;
  marker: string | null;
};

type CaseListRow = {
  id: string;
  title: string;
  status: 'tracking' | 'closed' | 'archived';
  opened_at: string;
  closed_at: string | null;
  marker: string | null;
  plot_name: string;
  entry_count: number;
  latest_activity_at: string | null;
};

type CaseStatusCountRow = {
  status: 'tracking' | 'closed' | 'archived';
  count: number;
};

type TrackerRow = {
  category_id: string;
  title: string;
  count: number;
  latest_performed_at: string | null;
  latest_follow_up_on: string | null;
};

type ActivityItemRow = {
  id: string;
  category_name: string;
  note: string;
  performed_at: string;
  follow_up_on: string | null;
  plot_name?: string;
  material_names: string | null;
};

type MaterialRow = {
  id: string;
  name: string;
  type: string;
  unit: string;
  default_rate_per_tank: string | null;
  photo_uri: string | null;
  last_used_at: string | null;
  usage_count: number;
  archived_at: string | null;
  common_name: string | null;
  brand_name: string | null;
  chemical_group: string | null;
  usage_label: string | null;
  reference_amount: number | null;
  reference_unit: string | null;
  reference_water_litres: number | null;
};

type CapturePlotRow = {
  id: string;
  name: string;
};

type CaptureHoleRow = {
  id: string;
  plot_id: string;
  marker: string;
  status: 'empty' | 'planted';
};

type CaptureCaseRow = {
  id: string;
  plot_id: string;
  hole_id: string | null;
  title: string;
};

type LaborPersonRow = {
  person_id: string;
  display_name: string;
  unpaid_total: number;
  unpaid_count: number;
  latest_work_date: string | null;
};

type RecentPaidRow = {
  id: string;
  display_name: string;
  amount_paid: number;
  paid_at: string;
};

type CaseTimelineRow = {
  id: string;
  title: string;
  status: 'tracking' | 'closed' | 'archived';
  opened_at: string;
  closed_at: string | null;
  marker: string | null;
  plot_name: string;
};

type CaseEntryRow = {
  id: string;
  category_name: string;
  note: string;
  performed_at: string;
  thumbnail_uri: string | null;
};

type HoleDetailRow = {
  id: string;
  marker: string;
  status: string;
  plot_name: string;
  plant_name: string | null;
  variety: string | null;
  planted_on: string | null;
  planting_id: string | null;
};

type PlantingLifecycleRow = {
  id: string;
  plant_name: string;
  variety: string | null;
  planted_on: string;
  removed_on: string | null;
  removed_reason: string | null;
  status: 'active' | 'dead' | 'retired';
};

type PersonRow = {
  id: string;
  display_name: string;
  role: 'owner' | 'worker';
  is_self: number;
  specialty: string;
  phone: string;
  note: string;
  archived_at: string | null;
};

type ParticipantForLabor = {
  id: string;
  activityId: string;
  personId: string;
  payType: 'none' | 'daily' | 'hourly' | 'piece' | 'contract';
  amountDue: number;
};

const generatedId = (prefix: string, performedAt: string): string => {
  const compact = performedAt.replace(/[^0-9]/g, '').slice(0, 14);
  return `${prefix}-${compact}`;
};

const requireName = (displayName: string): string => {
  const normalized = displayName.trim();
  if (!normalized) {
    throw new Error('TAKAI requires a person display name');
  }
  return normalized;
};

const requireMaterialName = (name: string): string => {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error('TAKAI requires a material name');
  }
  return normalized;
};

const requireMaterialUnit = (unit: string): string => {
  const normalized = unit.trim();
  if (!normalized) {
    throw new Error('TAKAI requires a material unit');
  }
  return normalized;
};

const requireSetupName = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`TAKAI requires a ${label}`);
  return normalized;
};

const requireDateOnly = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T12:00:00Z`))) {
    throw new Error(`TAKAI requires a valid ${label}`);
  }
  return normalized;
};

const toPersonDirectoryItem = (person: PersonRow): PersonDirectoryItem => ({
  id: person.id,
  displayName: person.display_name,
  role: person.role,
  isSelf: Boolean(person.is_self),
  specialty: person.specialty,
  phone: person.phone,
  note: person.note,
  archivedAt: person.archived_at,
});

const first = <T>(rows: T[]): T => {
  if (!rows[0]) {
    throw new Error('TAKAI local seed is missing required data');
  }
  return rows[0];
};

const caseStatusLabel = (status: 'tracking' | 'closed' | 'archived'): string => {
  if (status === 'tracking') return 'ติดตามอยู่';
  if (status === 'closed') return 'ปิดเคส';
  return 'เก็บเข้าแฟ้ม';
};

export const listActivityCategories = async (db: SqlExecutor, includeArchived = false): Promise<ActivityCategory[]> => {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    kind: ActivityCategory['kind'];
    track_by_default: number;
    sort_order: number;
    archived_at: string | null;
  }>(
    `SELECT id, name, kind, track_by_default, sort_order, archived_at
     FROM activity_categories
     ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY sort_order ASC, name ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    trackByDefault: Boolean(row.track_by_default),
    sortOrder: Number(row.sort_order),
    archivedAt: row.archived_at,
  }));
};

export const createActivityCategory = async (
  db: SqlExecutor,
  input: CategoryInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  const id = input.id ?? generatedId('category', createdAt);
  const name = requireName(input.name);
  await db.runAsync(
    `INSERT INTO activity_categories (id, name, kind, track_by_default, sort_order, archived_at)
     VALUES (?, ?, ?, 0, ?, NULL)`,
    [id, name, input.kind, input.sortOrder ?? 0],
  );
  return id;
};

export const updateActivityCategory = async (db: SqlExecutor, categoryId: string, input: CategoryInput): Promise<void> => {
  await db.runAsync(
    `UPDATE activity_categories
     SET name = ?, kind = ?, sort_order = ?
     WHERE id = ?`,
    [requireName(input.name), input.kind, input.sortOrder ?? 0, categoryId],
  );
};

export const archiveActivityCategory = async (
  db: SqlExecutor,
  categoryId: string,
  archivedAt = currentTimestamp(),
): Promise<void> => {
  await db.runAsync('UPDATE activity_categories SET archived_at = ? WHERE id = ?', [archivedAt, categoryId]);
};

export const restoreActivityCategory = async (db: SqlExecutor, categoryId: string): Promise<void> => {
  await db.runAsync('UPDATE activity_categories SET archived_at = NULL WHERE id = ?', [categoryId]);
};

export const listPeople = async (db: SqlExecutor, includeArchived = false): Promise<PersonDirectoryItem[]> => {
  const people = await db.getAllAsync<PersonRow>(
    `SELECT id, display_name, role, is_self, specialty, phone, note, archived_at
     FROM people
     ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY is_self DESC, display_name ASC`,
  );
  return people.map(toPersonDirectoryItem);
};

export const createPerson = async (
  db: SqlExecutor,
  input: PersonInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  const id = input.id ?? generatedId('person', createdAt);
  await db.runAsync(
    `INSERT INTO people (id, display_name, role, is_self, specialty, phone, note, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      id,
      requireName(input.displayName),
      input.role ?? 'worker',
      Number(input.isSelf ?? false),
      input.specialty?.trim() ?? '',
      input.phone?.trim() ?? '',
      input.note?.trim() ?? '',
    ],
  );
  return id;
};

export const updatePerson = async (db: SqlExecutor, personId: string, input: PersonInput): Promise<void> => {
  await db.runAsync(
    `UPDATE people
     SET display_name = ?, role = ?, is_self = ?, specialty = ?, phone = ?, note = ?
     WHERE id = ?`,
    [
      requireName(input.displayName),
      input.role ?? 'worker',
      Number(input.isSelf ?? false),
      input.specialty?.trim() ?? '',
      input.phone?.trim() ?? '',
      input.note?.trim() ?? '',
      personId,
    ],
  );
};

export const archivePerson = async (db: SqlExecutor, personId: string, archivedAt = currentTimestamp()): Promise<void> => {
  await db.runAsync('UPDATE people SET archived_at = ? WHERE id = ?', [archivedAt, personId]);
};

export const restorePerson = async (db: SqlExecutor, personId: string): Promise<void> => {
  await db.runAsync('UPDATE people SET archived_at = NULL WHERE id = ?', [personId]);
};

export const listMaterials = async (db: SqlExecutor, includeArchived = false): Promise<MaterialLibraryItem[]> => {
  const rows = await db.getAllAsync<MaterialRow>(
    `SELECT
       materials.id,
       materials.name,
       materials.type,
       materials.unit,
       materials.default_rate_per_tank,
       materials.photo_uri,
       materials.archived_at,
       materials.common_name,
       materials.brand_name,
       materials.chemical_group,
       materials.usage_label,
       materials.reference_amount,
       materials.reference_unit,
       materials.reference_water_litres,
       MAX(activities.performed_at) AS last_used_at,
       COUNT(activity_materials.id) AS usage_count
     FROM materials
     LEFT JOIN activity_materials ON activity_materials.material_id = materials.id
     LEFT JOIN activities ON activities.id = activity_materials.activity_id
     ${includeArchived ? '' : 'WHERE materials.archived_at IS NULL'}
     GROUP BY materials.id
     ORDER BY materials.archived_at IS NOT NULL ASC, materials.name ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    unit: row.unit,
    defaultRatePerTank: row.default_rate_per_tank,
    photoUri: row.photo_uri,
    lastUsedAt: row.last_used_at,
    usageCount: Number(row.usage_count),
    archivedAt: row.archived_at,
    commonName: row.common_name,
    brandName: row.brand_name,
    chemicalGroup: row.chemical_group,
    usageLabel: row.usage_label,
    referenceAmount: row.reference_amount == null ? null : Number(row.reference_amount),
    referenceUnit: row.reference_unit,
    referenceWaterLitres: row.reference_water_litres == null ? null : Number(row.reference_water_litres),
  }));
};

export const createMaterial = async (
  db: SqlExecutor,
  input: MaterialInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  const id = input.id ?? generatedId('material', createdAt);
  await db.runAsync(
    `INSERT INTO materials (id, name, type, unit, default_rate_per_tank, photo_uri, notes, created_at, archived_at, common_name, brand_name, chemical_group, usage_label, reference_amount, reference_unit, reference_water_litres)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      requireMaterialName(input.name),
      input.type,
      requireMaterialUnit(input.unit),
      input.defaultRatePerTank?.trim() || null,
      input.notes?.trim() || null,
      createdAt,
      input.commonName?.trim() || null,
      input.brandName?.trim() || null,
      input.chemicalGroup?.trim() || null,
      input.usageLabel?.trim() || null,
      input.referenceAmount ?? null,
      input.referenceUnit?.trim() || null,
      input.referenceWaterLitres ?? null,
    ],
  );
  return id;
};

export const updateMaterial = async (db: SqlExecutor, materialId: string, input: MaterialInput): Promise<void> => {
  await db.runAsync(
    `UPDATE materials
     SET name = ?, type = ?, unit = ?, default_rate_per_tank = ?, notes = ?, common_name = ?, brand_name = ?, chemical_group = ?, usage_label = ?, reference_amount = ?, reference_unit = ?, reference_water_litres = ?
     WHERE id = ?`,
    [
      requireMaterialName(input.name),
      input.type,
      requireMaterialUnit(input.unit),
      input.defaultRatePerTank?.trim() || null,
      input.notes?.trim() || null,
      input.commonName?.trim() || null,
      input.brandName?.trim() || null,
      input.chemicalGroup?.trim() || null,
      input.usageLabel?.trim() || null,
      input.referenceAmount ?? null,
      input.referenceUnit?.trim() || null,
      input.referenceWaterLitres ?? null,
      materialId,
    ],
  );
};

export const archiveMaterial = async (db: SqlExecutor, materialId: string, archivedAt = currentTimestamp()): Promise<void> => {
  await db.runAsync('UPDATE materials SET archived_at = ? WHERE id = ?', [archivedAt, materialId]);
};

export const restoreMaterial = async (db: SqlExecutor, materialId: string): Promise<void> => {
  await db.runAsync('UPDATE materials SET archived_at = NULL WHERE id = ?', [materialId]);
};

const assertActiveCategory = async (db: SqlExecutor, categoryId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM activity_categories WHERE id = ? AND archived_at IS NULL LIMIT 1',
    [categoryId],
  );
  if (!rows[0]) {
    throw new Error(`TAKAI activity category is unavailable: ${categoryId}`);
  }
};

const assertActivePerson = async (db: SqlExecutor, personId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM people WHERE id = ? AND archived_at IS NULL LIMIT 1', [personId]);
  if (!rows[0]) {
    throw new Error(`TAKAI activity participant is unavailable: ${personId}`);
  }
};

const assertActiveMaterial = async (db: SqlExecutor, materialId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM materials WHERE id = ? AND archived_at IS NULL LIMIT 1',
    [materialId],
  );
  if (!rows[0]) {
    throw new Error(`TAKAI activity material is unavailable: ${materialId}`);
  }
};

const materialUsageValues = (material: CreateActivityInput['materials'][number], index: number) => {
  const amount = Number(material.amount);
  const unit = material.unit.trim();
  const waterVolume = material.waterVolume == null ? null : Number(material.waterVolume);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`TAKAI activity material amount must be positive: ${material.materialId}`);
  }
  if (!unit) {
    throw new Error(`TAKAI activity material unit is required: ${material.materialId}`);
  }
  if (waterVolume != null && (!Number.isFinite(waterVolume) || waterVolume <= 0)) {
    throw new Error(`TAKAI activity material water volume must be positive: ${material.materialId}`);
  }

  return {
    amount,
    unit,
    waterVolume,
    waterUnit: material.waterUnit?.trim() || null,
    dilutionText: material.dilutionText?.trim() || null,
    note: material.note?.trim() || null,
    sortOrder: material.sortOrder ?? index,
  };
};

export const pinPlotTracker = async (
  db: SqlExecutor,
  plotId: string,
  categoryId: string,
  createdAt = currentTimestamp(),
): Promise<void> => {
  await assertActiveCategory(db, categoryId);
  await db.runAsync(
    `INSERT INTO plot_trackers (plot_id, category_id, created_at, archived_at)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(plot_id, category_id) DO UPDATE SET archived_at = NULL`,
    [plotId, categoryId, createdAt],
  );
};

export const unpinPlotTracker = async (
  db: SqlExecutor,
  plotId: string,
  categoryId: string,
  archivedAt = currentTimestamp(),
): Promise<void> => {
  await db.runAsync(
    'UPDATE plot_trackers SET archived_at = ? WHERE plot_id = ? AND category_id = ?',
    [archivedAt, plotId, categoryId],
  );
};

const currentGardenId = async (db: SqlExecutor): Promise<string> => {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM gardens WHERE archived_at IS NULL ORDER BY created_at ASC LIMIT 1',
  );
  if (!rows[0]?.id) throw new Error('TAKAI requires an active garden before adding a plot');
  return rows[0].id;
};

const assertPlotExists = async (db: SqlExecutor, plotId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM plots WHERE id = ? LIMIT 1', [plotId]);
  if (!rows[0]) throw new Error(`TAKAI plot is unavailable: ${plotId}`);
};

const assertEmptyHole = async (db: SqlExecutor, holeId: string): Promise<void> => {
  const rows = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM holes WHERE id = ? AND status = 'empty' LIMIT 1",
    [holeId],
  );
  if (!rows[0]) throw new Error(`TAKAI hole is unavailable for planting: ${holeId}`);
};

const currentPlantingForHole = async (db: SqlExecutor, holeId: string): Promise<{ id: string } | null> => {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM plantings
     WHERE hole_id = ? AND status = 'active' AND removed_on IS NULL
     ORDER BY planted_on DESC, id DESC
     LIMIT 1`,
    [holeId],
  );
  return rows[0] ?? null;
};

const withTransaction = async <T>(db: SqlExecutor, operation: () => Promise<T>): Promise<T> => {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    const value = await operation();
    await db.execAsync('COMMIT');
    return value;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const listSetupPlots = async (db: SqlExecutor): Promise<SetupPlot[]> => {
  const rows = await db.getAllAsync<{
    id: string;
    garden_id: string;
    name: string;
    area_rai: number;
    sort_order: number;
  }>(
    'SELECT id, garden_id, name, area_rai, sort_order FROM plots ORDER BY sort_order ASC, name ASC',
  );
  return rows.map((row) => ({
    id: row.id,
    gardenId: row.garden_id,
    name: row.name,
    areaRai: Number(row.area_rai),
    sortOrder: Number(row.sort_order),
  }));
};

export const createPlot = async (
  db: SqlExecutor,
  input: PlotInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  const gardenId = input.gardenId ?? await currentGardenId(db);
  const name = requireSetupName(input.name, 'plot name');
  const areaRai = Number(input.areaRai ?? 0);
  if (!Number.isFinite(areaRai) || areaRai < 0) throw new Error('TAKAI plot area must be zero or greater');
  const id = `plot-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
  const sortOrder = input.sortOrder ?? (await listSetupPlots(db)).length;
  await db.runAsync(
    'INSERT INTO plots (id, garden_id, name, area_rai, sort_order) VALUES (?, ?, ?, ?, ?)',
    [id, gardenId, name, areaRai, sortOrder],
  );
  return id;
};

export const createHole = async (
  db: SqlExecutor,
  input: HoleInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  await assertPlotExists(db, input.plotId);
  const marker = requireSetupName(input.marker, 'hole marker');
  const id = `hole-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
  await db.runAsync(
    "INSERT INTO holes (id, plot_id, marker, sort_key, status) VALUES (?, ?, ?, ?, 'empty')",
    [id, input.plotId, marker, input.sortKey?.trim() || marker],
  );
  return id;
};

export const createPlanting = async (
  db: SqlExecutor,
  input: PlantingInput,
  createdAt = new Date().toISOString(),
): Promise<string> => {
  const plantName = requireSetupName(input.plantName, 'plant name');
  const plantedOn = requireDateOnly(input.plantedOn, 'planting date');
  const id = `planting-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
  await withTransaction(db, async () => {
    await assertEmptyHole(db, input.holeId);
    await db.runAsync(
      `INSERT INTO plantings (id, hole_id, crop_cycle_id, plant_name, variety, planted_on, removed_on, status, removed_reason)
       VALUES (?, ?, NULL, ?, ?, ?, NULL, 'active', NULL)`,
      [id, input.holeId, plantName, input.variety?.trim() || null, plantedOn],
    );
    await db.runAsync("UPDATE holes SET status = 'planted' WHERE id = ? AND status = 'empty'", [input.holeId]);
  });
  return id;
};

export const retireCurrentPlanting = async (
  db: SqlExecutor,
  input: RetirePlantingInput,
): Promise<string> => {
  const removedOn = requireDateOnly(input.removedOn, 'retirement date');
  const reason = input.removedReason?.trim() || null;
  return withTransaction(db, async () => {
    const current = await currentPlantingForHole(db, input.holeId);
    if (!current) throw new Error(`TAKAI hole has no current planting to retire: ${input.holeId}`);
    await db.runAsync(
      `UPDATE plantings
       SET status = ?, removed_on = ?, removed_reason = ?
       WHERE id = ? AND status = 'active' AND removed_on IS NULL`,
      [input.status, removedOn, reason, current.id],
    );
    await db.runAsync("UPDATE holes SET status = 'empty' WHERE id = ? AND status = 'planted'", [input.holeId]);
    return current.id;
  });
};

export const getActivityCaptureOptions = async (db: SqlExecutor): Promise<ActivityCaptureOption> => {
  const [plots, holes, activeCases, categories, materials, people] = await Promise.all([
    db.getAllAsync<CapturePlotRow>('SELECT id, name FROM plots ORDER BY sort_order ASC, name ASC'),
    db.getAllAsync<CaptureHoleRow>(
      `SELECT id, plot_id, marker, status
       FROM holes
       WHERE status IN ('empty', 'planted')
       ORDER BY plot_id ASC, sort_key ASC`,
    ),
    db.getAllAsync<CaptureCaseRow>(
      `SELECT id, plot_id, hole_id, title
       FROM cases
       WHERE status = 'tracking'
       ORDER BY opened_at DESC`,
    ),
    db.getAllAsync<ActivityCategory>(
    `SELECT id, name, kind, track_by_default AS trackByDefault, sort_order AS sortOrder, archived_at AS archivedAt
     FROM activity_categories
     WHERE archived_at IS NULL
     ORDER BY sort_order ASC`,
    ),
    db.getAllAsync<Material>(
    `SELECT id, name, type, unit, default_rate_per_tank AS defaultRatePerTank, photo_uri AS photoUri, notes,
            created_at AS createdAt, archived_at AS archivedAt,
            common_name AS commonName, brand_name AS brandName, chemical_group AS chemicalGroup, usage_label AS usageLabel,
            reference_amount AS referenceAmount, reference_unit AS referenceUnit, reference_water_litres AS referenceWaterLitres
     FROM materials
     WHERE archived_at IS NULL
     ORDER BY name ASC`,
    ),
    db.getAllAsync<PersonRow>(
    `SELECT id, display_name, role, is_self, specialty, phone, note, archived_at
     FROM people
     WHERE archived_at IS NULL
     ORDER BY is_self DESC`,
    ),
  ]);
  const defaultPlot = first(plots);
  const defaultCase = activeCases.find((caseRecord) => caseRecord.plot_id === defaultPlot.id && caseRecord.hole_id);
  const defaultHole = holes.find((hole) => hole.id === defaultCase?.hole_id) ?? holes.find((hole) => hole.plot_id === defaultPlot.id);

  return {
    categories,
    materials,
    plots: plots.map((plot) => ({ id: plot.id, name: plot.name })),
    holes: holes.map((hole) => ({ id: hole.id, plotId: hole.plot_id, marker: hole.marker, status: hole.status })),
    activeCases: activeCases.map((caseRecord) => ({
      id: caseRecord.id,
      plotId: caseRecord.plot_id,
      holeId: caseRecord.hole_id,
      title: caseRecord.title,
    })),
    people: people.map((person) => ({
      id: person.id,
      displayName: person.display_name,
      role: person.role,
      isSelf: Boolean(person.is_self),
    })),
    defaultPlotId: defaultPlot.id,
    defaultHoleId: defaultHole?.id ?? null,
    defaultSelfId: people.find((person) => Boolean(person.is_self))?.id ?? null,
    defaultWorkerId: people.find((person) => !person.is_self)?.id ?? null,
    defaultPerformedAt: currentTimestamp(),
  };
};

export const resolveActiveCropId = async (
  db: SqlExecutor,
  plotId: string,
  performedAt: string,
): Promise<string | null> => {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id
     FROM crop_cycles
     WHERE plot_id = ?
       AND starts_on <= date(?)
       AND (ends_on IS NULL OR ends_on >= date(?))
     ORDER BY starts_on DESC
     LIMIT 1`,
    [plotId, performedAt, performedAt],
  );
  return rows[0]?.id ?? null;
};

export const createActivity = async (db: SqlExecutor, input: CreateActivityInput): Promise<CreatedActivityResult> => {
  const temporal = normalizeActivityTemporal(input);
  const activityId = input.id ?? generatedId('activity', temporal.performedAt);
  await assertActiveCategory(db, input.categoryId);
  for (const participant of input.participants) {
    await assertActivePerson(db, participant.personId);
  }
  const materialUsages = input.materials.map(materialUsageValues);
  for (const material of input.materials) {
    await assertActiveMaterial(db, material.materialId);
  }
  const cropCycleId = await resolveActiveCropId(db, input.plotId, temporal.performedAt);
  const plantingId = input.targetType === 'hole'
    ? (await currentPlantingForHole(db, input.targetId))?.id ?? null
    : null;

  await db.runAsync(
    `INSERT INTO activities (
       id, plot_id, crop_cycle_id, planting_id, category_id, performed_at, activity_date, time_mode, started_at, ended_at, duration_minutes, note, follow_up_on, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done')`,
    [activityId, input.plotId, cropCycleId, plantingId, input.categoryId, temporal.performedAt, temporal.activityDate, temporal.timeMode, temporal.startedAt, temporal.endedAt, temporal.durationMinutes, input.note, input.followUpOn ?? null],
  );

  await db.runAsync(
    `INSERT INTO activity_targets (id, activity_id, target_type, target_id)
     VALUES (?, ?, ?, ?)`,
    [`target-${activityId}`, activityId, input.targetType, input.targetId],
  );

  for (const [index, material] of input.materials.entries()) {
    const usage = materialUsages[index];
    await db.runAsync(
      `INSERT INTO activity_materials (
         id, activity_id, material_id, amount, unit, water_volume, water_unit, dilution_text, note, sort_order,
         material_name_snapshot, common_name_snapshot, brand_name_snapshot, reference_amount_snapshot, reference_unit_snapshot, reference_water_litres_snapshot,
         actual_tank_litres, calculated_amount, manual_amount
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `activity-material-${activityId}-${index + 1}`,
        activityId,
        material.materialId,
        usage.amount,
        usage.unit,
        usage.waterVolume,
        usage.waterUnit,
        usage.dilutionText,
        usage.note,
        usage.sortOrder,
        material.materialNameSnapshot ?? null,
        material.commonNameSnapshot ?? null,
        material.brandNameSnapshot ?? null,
        material.referenceAmountSnapshot ?? null,
        material.referenceUnitSnapshot ?? null,
        material.referenceWaterLitresSnapshot ?? null,
        material.actualTankLitres ?? null,
        material.calculatedAmount ?? null,
        material.manualAmount ?? null,
      ],
    );
  }

  const people = await db.getAllAsync<PersonRow>(
    'SELECT id, display_name, role, is_self, specialty, phone, note, archived_at FROM people',
  );
  const participantsForLabor: ParticipantForLabor[] = [];

  for (const [index, participant] of input.participants.entries()) {
    const participantId = `participant-${activityId}-${index + 1}`;
    await db.runAsync(
      `INSERT INTO activity_participants (id, activity_id, person_id, pay_type, amount_due, contract_job_id, paid_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      [participantId, activityId, participant.personId, participant.payType, participant.amountDue],
    );
    participantsForLabor.push({
      id: participantId,
      activityId,
      personId: participant.personId,
      payType: participant.payType,
      amountDue: participant.amountDue,
    });
  }

  const laborEntries = laborEntriesForParticipants(
    { performedAt: temporal.performedAt },
    participantsForLabor.map((participant) => ({
      id: participant.id,
      activityId: participant.activityId,
      personId: participant.personId,
      payType: participant.payType,
      amountDue: participant.amountDue,
    })),
    people.map((person) => ({
      id: person.id,
      displayName: person.display_name,
      role: person.role,
      isSelf: Boolean(person.is_self),
    })),
  );

  for (const entry of laborEntries) {
    await db.runAsync(
      `INSERT INTO labor_entries (id, activity_participant_id, person_id, work_date, amount_due, amount_paid, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.activityParticipantId,
        entry.personId,
        entry.workDate,
        entry.amountDue,
        entry.amountPaid,
        entry.status,
      ],
    );
  }

  return {
    activityId,
    cropCycleId,
    laborEntryIds: laborEntries.map((entry) => entry.id),
  };
};

const buildTracker = (row: TrackerRow): TrackerSummary => {
  const elapsed = row.latest_performed_at ? diffDays(row.latest_performed_at) : null;
  const nextDue = row.latest_follow_up_on;

  return {
    categoryId: row.category_id,
    title: row.title,
    count: Number(row.count),
    latestPerformedAt: row.latest_performed_at,
    elapsedDays: elapsed,
    nextDueOn: nextDue,
    dueState: followUpDueState(nextDue),
    progress: elapsed === null ? 0 : Math.min(1, elapsed / 7),
  };
};

const getTrackerRows = async (
  db: SqlExecutor,
  plotId: string,
  cropCycleId: string | null,
): Promise<TrackerRow[]> => {
  return db.getAllAsync<TrackerRow>(
    `SELECT
       activity_categories.id AS category_id,
       activity_categories.name AS title,
       COUNT(activities.id) AS count,
       MAX(activities.performed_at) AS latest_performed_at,
       MAX(activities.follow_up_on) AS latest_follow_up_on
     FROM plot_trackers
     JOIN activity_categories ON activity_categories.id = plot_trackers.category_id
     LEFT JOIN activities
       ON activities.category_id = activity_categories.id
      AND activities.plot_id = plot_trackers.plot_id
      AND activities.status = 'done'
      AND (? IS NULL OR activities.crop_cycle_id = ?)
     WHERE plot_trackers.plot_id = ?
       AND plot_trackers.archived_at IS NULL
       AND activity_categories.archived_at IS NULL
     GROUP BY activity_categories.id
     ORDER BY activity_categories.sort_order ASC, activity_categories.name ASC`,
    [cropCycleId, cropCycleId, plotId],
  );
};

export const listPlotTrackers = async (db: SqlExecutor, plotId: string): Promise<TrackerSummary[]> => {
  const rows = await getTrackerRows(db, plotId, null);
  return rows.map(buildTracker);
};

export const getPlotDashboard = async (db: SqlExecutor, plotId = 'plot-a'): Promise<PlotDashboard> => {
  const plot = first(
    await db.getAllAsync<PlotRow>(
      `SELECT plots.id, gardens.name AS garden_name, plots.name, plots.area_rai
       FROM plots
       JOIN gardens ON gardens.id = plots.garden_id
       WHERE plots.id = ?`,
      [plotId],
    ),
  );
  const crop = (
    await db.getAllAsync<CropRow>(
      `SELECT id, label, starts_on
       FROM crop_cycles
       WHERE plot_id = ? AND status = 'active'
       ORDER BY starts_on DESC
       LIMIT 1`,
      [plot.id],
    )
  )[0];
  const holeCounts = first(
    await db.getAllAsync<HoleCountRow>(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'planted' THEN 1 ELSE 0 END) AS planted,
        SUM(CASE WHEN status = 'empty' THEN 1 ELSE 0 END) AS empty
       FROM holes
       WHERE plot_id = ?`,
      [plot.id],
    ),
  );
  const trackerRows = await getTrackerRows(db, plot.id, crop?.id ?? null);
  const cases = await db.getAllAsync<CaseRow>(
    `SELECT cases.id, cases.title, cases.status, holes.marker
     FROM cases
     LEFT JOIN holes ON holes.id = cases.hole_id
     WHERE cases.plot_id = ? AND cases.status = 'tracking'
     ORDER BY cases.opened_at DESC
     LIMIT 4`,
    [plot.id],
  );

  return {
    id: plot.id,
    name: plot.name,
    areaRai: Number(plot.area_rai),
    activeCrop: crop
      ? {
          id: crop.id,
          label: crop.label,
          startsOn: crop.starts_on,
          activeDays: diffDays(crop.starts_on),
        }
      : null,
    totalHoles: Number(holeCounts.total),
    plantedHoles: Number(holeCounts.planted ?? 0),
    emptyHoles: Number(holeCounts.empty ?? 0),
    trackers: trackerRows.map(buildTracker),
    activeCases: cases.map((row): ActiveCaseSummary => ({
      id: row.id,
      title: row.title,
      statusLabel: 'ติดตามอยู่',
      targetLabel: row.marker ?? plot.name,
    })),
  };
};

export const listPlotSummaries = async (db: SqlExecutor): Promise<PlotSummary[]> => {
  const plots = await listSetupPlots(db);
  const dashboards = await Promise.all(plots.map((plot) => getPlotDashboard(db, plot.id)));
  return dashboards.map((plot) => ({
    id: plot.id,
    name: plot.name,
    areaRai: plot.areaRai,
    totalHoles: plot.totalHoles,
    plantedHoles: plot.plantedHoles,
    emptyHoles: plot.emptyHoles,
    dueTrackerCount: plot.trackers.filter((tracker) => tracker.dueState === 'overdue' || tracker.dueState === 'due_today').length,
    activeCaseCount: plot.activeCases.length,
  }));
};

export const getPlotDetail = async (db: SqlExecutor, plotId: string): Promise<PlotDetail> => {
  const plot = await getPlotDashboard(db, plotId);
  const [holes, recentItems] = await Promise.all([
    db.getAllAsync<{ id: string; marker: string; status: 'empty' | 'planted' }>(
      'SELECT id, marker, status FROM holes WHERE plot_id = ? ORDER BY sort_key ASC',
      [plotId],
    ),
    getTodayDashboard(db, plotId).then((dashboard) => dashboard.recentItems),
  ]);
  return { plot, holes, recentItems };
};

export const getTodayDashboard = async (db: SqlExecutor, scope: TodayScope = 'all'): Promise<TodayDashboard> => {
  const allPlots = await listSetupPlots(db);
  if (allPlots.length === 0) throw new Error('TAKAI requires at least one plot');
  const scopedPlots = scope === 'all' ? allPlots : allPlots.filter((plot) => plot.id === scope);
  if (scopedPlots.length === 0) throw new Error(`TAKAI plot is unavailable: ${scope}`);
  const plots = await Promise.all(scopedPlots.map((item) => getPlotDashboard(db, item.id)));
  const plot = plots[0];
  const [garden] = await db.getAllAsync<{ name: string }>('SELECT name FROM gardens ORDER BY created_at ASC LIMIT 1');
  const activityRows = await db.getAllAsync<ActivityItemRow>(
    `SELECT
       activities.id,
       activity_categories.name AS category_name,
       activities.note,
       activities.performed_at,
       activities.follow_up_on,
       plots.name AS plot_name,
       GROUP_CONCAT(materials.name, ', ') AS material_names
     FROM activities
     JOIN activity_categories ON activity_categories.id = activities.category_id
     JOIN plots ON plots.id = activities.plot_id
     LEFT JOIN activity_materials ON activity_materials.activity_id = activities.id
     LEFT JOIN materials ON materials.id = activity_materials.material_id
     WHERE (? = 'all' OR activities.plot_id = ?)
     GROUP BY activities.id
     ORDER BY activities.performed_at DESC
     LIMIT 5`,
    [scope, scope],
  );
  const [labor] = await db.getAllAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS total
     FROM labor_entries
     WHERE status = 'unpaid'`,
  );

  const recentItems: TodayActivityItem[] = activityRows
    .map((row) => ({
      id: row.id,
      title: `${row.category_name} ${row.plot_name ?? plot.name}`,
      meta: row.material_names ? `${row.note} · ${row.material_names}` : row.note,
      trailing: formatFollowUpDueLabel(row.follow_up_on) ?? formatThaiShortDate(row.performed_at),
      variant: 'activity' as const,
      dueState: followUpDueState(row.follow_up_on),
    }))
    .sort((left, right) => {
      const priority = { overdue: 0, due_today: 1, upcoming: 2, none: 3 } as const;
      return priority[left.dueState] - priority[right.dueState];
    })
    .map(({ dueState: _dueState, ...item }) => item);

  if (recentItems.length === 0) {
    recentItems.push({
      id: 'empty-today',
      title: 'ยังไม่มีบันทึกวันนี้',
      meta: 'กดบันทึกเพื่อสร้างกิจกรรมแรกของแปลง',
      trailing: 'เริ่ม',
      variant: 'activity',
    });
  }

  return {
    gardenName: garden?.name ?? 'สวนตาไก๊',
    scope,
    plots,
    plot,
    recentItems,
    unpaidLaborTotal: Number(labor?.total ?? 0),
  };
};

export const getCaseList = async (
  db: SqlExecutor,
  statusFilter?: 'tracking' | 'closed' | 'archived',
): Promise<CaseListItem[]> => {
  const rows = await db.getAllAsync<CaseListRow>(
    `SELECT
       cases.id,
       cases.title,
       cases.status,
       cases.opened_at,
       cases.closed_at,
       holes.marker,
       plots.name AS plot_name,
       COUNT(activity_targets.id) AS entry_count,
       MAX(activities.performed_at) AS latest_activity_at
     FROM cases
     JOIN plots ON plots.id = cases.plot_id
     LEFT JOIN holes ON holes.id = cases.hole_id
     LEFT JOIN activity_targets
       ON activity_targets.target_type = 'case'
      AND activity_targets.target_id = cases.id
     LEFT JOIN activities ON activities.id = activity_targets.activity_id
     WHERE (? IS NULL OR cases.status = ?)
     GROUP BY cases.id
     ORDER BY
       CASE cases.status
         WHEN 'tracking' THEN 0
         WHEN 'closed' THEN 1
         ELSE 2
       END,
       cases.opened_at DESC`,
    [statusFilter ?? null, statusFilter ?? null],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    targetLabel: row.marker ? `${row.marker} · ${row.plot_name}` : row.plot_name,
    status: row.status,
    statusLabel: caseStatusLabel(row.status),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    latestActivityAt: row.latest_activity_at,
    entryCount: Number(row.entry_count),
  }));
};

export const getMenuDashboard = async (db: SqlExecutor): Promise<MenuDashboard> => {
  const [garden] = await db.getAllAsync<{ name: string }>('SELECT name FROM gardens ORDER BY created_at ASC LIMIT 1');
  const [labor] = await db.getAllAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS total
     FROM labor_entries
     WHERE status = 'unpaid'`,
  );
  const caseRows = await db.getAllAsync<CaseStatusCountRow>(
    `SELECT status, COUNT(*) AS count
     FROM cases
     GROUP BY status`,
  );
  const [materials] = await db.getAllAsync<CountRow>('SELECT COUNT(*) AS count FROM materials');
  const [plots] = await db.getAllAsync<CountRow>('SELECT COUNT(*) AS count FROM plots');
  const [holes] = await db.getAllAsync<CountRow>('SELECT COUNT(*) AS count FROM holes');

  const caseCount = (status: CaseStatusCountRow['status']) =>
    Number(caseRows.find((row) => row.status === status)?.count ?? 0);

  return {
    gardenName: garden?.name ?? 'สวนตาไก๊',
    activeCaseCount: caseCount('tracking'),
    closedCaseCount: caseCount('closed') + caseCount('archived'),
    unpaidLaborTotal: Number(labor?.total ?? 0),
    materialCount: Number(materials?.count ?? 0),
    plotCount: Number(plots?.count ?? 0),
    holeCount: Number(holes?.count ?? 0),
    localStatusLabel: 'ออฟไลน์ 100%',
  };
};

export const createDemoSprayActivity = async (db: SqlExecutor, now = currentTimestamp()): Promise<CreatedActivityResult> => {
  const options = await getActivityCaptureOptions(db);
  const spray = first(options.categories.filter((category) => category.id === 'cat-spray'));
  const materials = options.materials.slice(0, 2);
  const participants = [
    options.defaultSelfId
      ? { personId: options.defaultSelfId, payType: 'none' as const, amountDue: 0 }
      : null,
    options.defaultWorkerId
      ? { personId: options.defaultWorkerId, payType: 'daily' as const, amountDue: 600 }
      : null,
  ].filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));

  return createActivity(db, {
    id: 'activity-demo-spray',
    plotId: options.defaultPlotId,
    categoryId: spray.id,
    performedAt: now,
    note: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม',
    followUpOn: nextDateFrom(now, 4),
    targetType: options.defaultHoleId ? 'hole' : 'plot',
    targetId: options.defaultHoleId ?? options.defaultPlotId,
    materials: materials.map((material, index) => ({
      materialId: material.id,
      amount: index === 0 ? 20 : 10,
      unit: material.unit,
    })),
    participants,
  });
};

export const createFieldActivity = async (
  db: SqlExecutor,
  input: Omit<CreateActivityInput, 'id'> & { idSeed: string },
): Promise<CreatedActivityResult> => {
  return createActivity(db, {
    ...input,
    id: `activity-${input.idSeed}`,
  });
};

export const getMaterialLibrary = async (db: SqlExecutor): Promise<MaterialLibraryItem[]> => listMaterials(db, true);

export const getLaborLedger = async (db: SqlExecutor): Promise<LaborLedger> => {
  const people = await db.getAllAsync<LaborPersonRow>(
    `SELECT
       people.id AS person_id,
       people.display_name,
       COALESCE(SUM(labor_entries.amount_due - labor_entries.amount_paid), 0) AS unpaid_total,
       COUNT(labor_entries.id) AS unpaid_count,
       MAX(labor_entries.work_date) AS latest_work_date
     FROM people
     JOIN labor_entries ON labor_entries.person_id = people.id
     WHERE labor_entries.status = 'unpaid'
     GROUP BY people.id
     ORDER BY unpaid_total DESC`,
  );
  const recentPaid = await db.getAllAsync<RecentPaidRow>(
    `SELECT
       labor_entries.id,
       people.display_name,
       labor_entries.amount_paid,
       labor_entries.work_date AS paid_at
     FROM labor_entries
     JOIN people ON people.id = labor_entries.person_id
     WHERE labor_entries.status = 'paid'
     ORDER BY labor_entries.work_date DESC
     LIMIT 5`,
  );

  return {
    unpaidTotal: people.reduce((sum, person) => sum + Number(person.unpaid_total), 0),
    unpaidPeople: people.map((person) => ({
      personId: person.person_id,
      displayName: person.display_name,
      unpaidTotal: Number(person.unpaid_total),
      unpaidCount: Number(person.unpaid_count),
      sourceCount: Number(person.unpaid_count),
      latestWorkDate: person.latest_work_date,
    })),
    recentPaid: recentPaid.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      amountPaid: Number(row.amount_paid),
      paidAt: row.paid_at,
    })),
  };
};

export const settleUnpaidLaborForPerson = async (
  db: SqlExecutor,
  personId: string,
  paidAt = currentTimestamp(),
): Promise<void> => {
  await db.runAsync(
    `UPDATE labor_entries
     SET amount_paid = amount_due, status = 'paid'
     WHERE person_id = ? AND status = 'unpaid'`,
    [personId],
  );

  await db.runAsync(
    `UPDATE activity_participants
     SET paid_at = ?
     WHERE person_id = ? AND paid_at IS NULL`,
    [paidAt, personId],
  );
};

export const getCaseTimeline = async (db: SqlExecutor, caseId = 'case-a-014'): Promise<CaseTimeline> => {
  const row = first(
    await db.getAllAsync<CaseTimelineRow>(
      `SELECT
         cases.id,
         cases.title,
         cases.status,
         cases.opened_at,
         cases.closed_at,
         holes.marker,
         plots.name AS plot_name
       FROM cases
       JOIN plots ON plots.id = cases.plot_id
       LEFT JOIN holes ON holes.id = cases.hole_id
       WHERE cases.id = ?
       LIMIT 1`,
      [caseId],
    ),
  );
  const entryRows = await db.getAllAsync<CaseEntryRow>(
    `SELECT
       activities.id,
       activity_categories.name AS category_name,
       activities.note,
       activities.performed_at,
       MIN(media_assets.uri) AS thumbnail_uri
     FROM activities
     JOIN activity_targets ON activity_targets.activity_id = activities.id
     JOIN activity_categories ON activity_categories.id = activities.category_id
     LEFT JOIN media_assets ON media_assets.owner_type = 'activity' AND media_assets.owner_id = activities.id
     WHERE activity_targets.target_type = 'case'
       AND activity_targets.target_id = ?
     GROUP BY activities.id
     ORDER BY activities.performed_at ASC`,
    [caseId],
  );

  const entries = [
    {
      id: `${row.id}-opened`,
      title: 'เปิดเคส',
      meta: row.title,
      performedAt: row.opened_at,
      dayLabel: 'Day 0',
      thumbnailUri: null,
    },
    ...entryRows.map((entry) => ({
      id: entry.id,
      title: entry.category_name,
      meta: entry.note,
      performedAt: entry.performed_at,
      dayLabel: `Day ${diffDays(row.opened_at, entry.performed_at)}`,
      thumbnailUri: entry.thumbnail_uri,
    })),
  ];

  return {
    id: row.id,
    title: row.title,
    targetLabel: row.marker ? `${row.marker} · ${row.plot_name}` : row.plot_name,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    entries,
  };
};

export const closeCase = async (db: SqlExecutor, caseId: string, closedAt = currentTimestamp()): Promise<void> => {
  await db.runAsync(
    `UPDATE cases
     SET status = 'closed', closed_at = ?
     WHERE id = ? AND status = 'tracking'`,
    [closedAt, caseId],
  );
};

export const getHoleDetail = async (db: SqlExecutor, holeId = 'hole-a-014'): Promise<HoleDetail> => {
  const row = first(
    await db.getAllAsync<HoleDetailRow>(
      `SELECT
         holes.id,
         holes.marker,
         holes.status,
         plots.name AS plot_name,
         plantings.id AS planting_id,
         plantings.plant_name,
         plantings.variety,
         plantings.planted_on
       FROM holes
       JOIN plots ON plots.id = holes.plot_id
       LEFT JOIN plantings ON plantings.hole_id = holes.id AND plantings.status = 'active' AND plantings.removed_on IS NULL
       WHERE holes.id = ?
       LIMIT 1`,
      [holeId],
    ),
  );
  const activityRows = await db.getAllAsync<ActivityItemRow>(
    `SELECT
       activities.id,
       activity_categories.name AS category_name,
       activities.note,
       activities.performed_at,
       activities.follow_up_on,
       GROUP_CONCAT(materials.name, ', ') AS material_names
     FROM activities
     JOIN activity_targets ON activity_targets.activity_id = activities.id
     JOIN activity_categories ON activity_categories.id = activities.category_id
     LEFT JOIN activity_materials ON activity_materials.activity_id = activities.id
     LEFT JOIN materials ON materials.id = activity_materials.material_id
     WHERE activity_targets.target_type = 'hole'
       AND activity_targets.target_id = ?
       AND activities.planting_id = ?
     GROUP BY activities.id
     ORDER BY activities.performed_at DESC
     LIMIT 8`,
    [holeId, row.planting_id],
  );
  const lifecycleRows = await db.getAllAsync<PlantingLifecycleRow>(
    `SELECT id, plant_name, variety, planted_on, removed_on, removed_reason, status
     FROM plantings
     WHERE hole_id = ?
     ORDER BY planted_on DESC, id DESC`,
    [holeId],
  );
  const cases = await db.getAllAsync<CaseRow>(
    `SELECT cases.id, cases.title, cases.status, holes.marker
     FROM cases
     LEFT JOIN holes ON holes.id = cases.hole_id
     WHERE cases.hole_id = ? AND cases.status = 'tracking'
     ORDER BY cases.opened_at DESC`,
    [holeId],
  );

  return {
    id: row.id,
    marker: row.marker,
    status: row.status,
    plotName: row.plot_name,
    plantName: row.plant_name,
    variety: row.variety,
    plantedOn: row.planted_on,
    ageDays: row.planted_on ? diffDays(row.planted_on) : null,
    lifecycle: lifecycleRows.map((planting): PlantingLifecycle => ({
      id: planting.id,
      plantName: planting.plant_name,
      variety: planting.variety,
      plantedOn: planting.planted_on,
      removedOn: planting.removed_on,
      removedReason: planting.removed_reason,
      status: planting.status,
    })),
    activities: activityRows.map((activity) => ({
      id: activity.id,
      title: activity.category_name,
      meta: activity.material_names ? `${activity.note} · ${activity.material_names}` : activity.note,
      trailing: activity.follow_up_on ? formatThaiShortDate(activity.follow_up_on) : formatThaiShortDate(activity.performed_at),
      variant: 'activity',
    })),
    activeCases: cases.map((caseItem) => ({
      id: caseItem.id,
      title: caseItem.title,
      statusLabel: 'ติดตามอยู่',
      targetLabel: caseItem.marker ?? row.marker,
    })),
  };
};
