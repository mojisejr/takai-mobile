import type { ActivityCategory, Material } from '../../domain';
import { laborEntriesForParticipants } from '../../domain';
import type { SqlExecutor } from '../../data';
import { DEMO_NOW, diffDays, formatThaiShortDate, nextDateFrom } from './date';
import type {
  ActivityCaptureOption,
  ActiveCaseSummary,
  CreateActivityInput,
  CreatedActivityResult,
  PlotDashboard,
  TodayActivityItem,
  TodayDashboard,
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
  material_names: string | null;
};

type PersonRow = {
  id: string;
  display_name: string;
  role: 'owner' | 'worker';
  is_self: number;
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

const first = <T>(rows: T[]): T => {
  if (!rows[0]) {
    throw new Error('TAKAI local seed is missing required data');
  }
  return rows[0];
};

export const getActivityCaptureOptions = async (db: SqlExecutor): Promise<ActivityCaptureOption> => {
  const [plot] = await db.getAllAsync<{ id: string }>('SELECT id FROM plots ORDER BY sort_order ASC LIMIT 1');
  const [hole] = await db.getAllAsync<{ id: string }>('SELECT id FROM holes WHERE plot_id = ? ORDER BY sort_key ASC LIMIT 1', [
    plot?.id,
  ]);
  const categories = await db.getAllAsync<ActivityCategory>(
    `SELECT id, name, kind, track_by_default AS trackByDefault, sort_order AS sortOrder
     FROM activity_categories
     ORDER BY sort_order ASC`,
  );
  const materials = await db.getAllAsync<Material>(
    `SELECT id, name, type, unit, default_rate_per_tank AS defaultRatePerTank, photo_uri AS photoUri, notes
     FROM materials
     ORDER BY name ASC`,
  );
  const people = await db.getAllAsync<PersonRow>('SELECT id, display_name, role, is_self FROM people ORDER BY is_self DESC');

  return {
    categories,
    materials,
    defaultPlotId: first([plot]).id,
    defaultHoleId: hole?.id ?? null,
    defaultSelfId: people.find((person) => Boolean(person.is_self))?.id ?? null,
    defaultWorkerId: people.find((person) => !person.is_self)?.id ?? null,
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
  const activityId = input.id ?? generatedId('activity', input.performedAt);
  const cropCycleId = await resolveActiveCropId(db, input.plotId, input.performedAt);

  await db.runAsync(
    `INSERT INTO activities (id, plot_id, crop_cycle_id, category_id, performed_at, note, follow_up_on, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'done')`,
    [activityId, input.plotId, cropCycleId, input.categoryId, input.performedAt, input.note, input.followUpOn ?? null],
  );

  await db.runAsync(
    `INSERT INTO activity_targets (id, activity_id, target_type, target_id)
     VALUES (?, ?, ?, ?)`,
    [`target-${activityId}`, activityId, input.targetType, input.targetId],
  );

  for (const [index, material] of input.materials.entries()) {
    await db.runAsync(
      `INSERT INTO activity_materials (id, activity_id, material_id, amount, unit)
       VALUES (?, ?, ?, ?, ?)`,
      [`activity-material-${activityId}-${index + 1}`, activityId, material.materialId, material.amount, material.unit],
    );
  }

  const people = await db.getAllAsync<PersonRow>('SELECT id, display_name, role, is_self FROM people');
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
    { performedAt: input.performedAt },
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
  const nextDue = row.latest_follow_up_on ?? (row.latest_performed_at ? nextDateFrom(row.latest_performed_at, 7) : null);

  return {
    categoryId: row.category_id,
    title: row.title,
    count: Number(row.count),
    latestPerformedAt: row.latest_performed_at,
    elapsedDays: elapsed,
    nextDueOn: nextDue,
    progress: elapsed === null ? 0 : Math.min(1, elapsed / 7),
  };
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
  const trackerRows = await db.getAllAsync<TrackerRow>(
    `SELECT
       activity_categories.id AS category_id,
       activity_categories.name AS title,
       COUNT(activities.id) AS count,
       MAX(activities.performed_at) AS latest_performed_at,
       MAX(activities.follow_up_on) AS latest_follow_up_on
     FROM activity_categories
     LEFT JOIN activities
       ON activities.category_id = activity_categories.id
      AND activities.plot_id = ?
      AND activities.status = 'done'
      AND (? IS NULL OR activities.crop_cycle_id = ?)
     WHERE activity_categories.track_by_default = 1
     GROUP BY activity_categories.id
     ORDER BY activity_categories.sort_order ASC`,
    [plot.id, crop?.id ?? null, crop?.id ?? null],
  );
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

export const getTodayDashboard = async (db: SqlExecutor): Promise<TodayDashboard> => {
  const plot = await getPlotDashboard(db);
  const [garden] = await db.getAllAsync<{ name: string }>('SELECT name FROM gardens ORDER BY created_at ASC LIMIT 1');
  const activityRows = await db.getAllAsync<ActivityItemRow>(
    `SELECT
       activities.id,
       activity_categories.name AS category_name,
       activities.note,
       activities.performed_at,
       activities.follow_up_on,
       GROUP_CONCAT(materials.name, ', ') AS material_names
     FROM activities
     JOIN activity_categories ON activity_categories.id = activities.category_id
     LEFT JOIN activity_materials ON activity_materials.activity_id = activities.id
     LEFT JOIN materials ON materials.id = activity_materials.material_id
     WHERE activities.plot_id = ?
     GROUP BY activities.id
     ORDER BY activities.performed_at DESC
     LIMIT 5`,
    [plot.id],
  );
  const [labor] = await db.getAllAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS total
     FROM labor_entries
     WHERE status = 'unpaid'`,
  );

  const recentItems: TodayActivityItem[] = activityRows.map((row) => ({
    id: row.id,
    title: `${row.category_name} ${plot.name}`,
    meta: row.material_names ? `${row.note} · ${row.material_names}` : row.note,
    trailing: row.follow_up_on ? formatThaiShortDate(row.follow_up_on) : formatThaiShortDate(row.performed_at),
    variant: 'activity',
  }));

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
    plot,
    recentItems,
    unpaidLaborTotal: Number(labor?.total ?? 0),
  };
};

export const createDemoSprayActivity = async (db: SqlExecutor): Promise<CreatedActivityResult> => {
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
    performedAt: DEMO_NOW,
    note: 'พ่นยาเชื้อราที่โคนต้นและรอบทรงพุ่ม',
    followUpOn: nextDateFrom(DEMO_NOW, 4),
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
