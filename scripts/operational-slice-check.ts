import assert from 'node:assert/strict';

import { TAKAI_DEMO_SEED } from '../src/domain';
import type { ActivityCategory, CaseRecord, CropCycle, Garden, Hole, Material, Person, Plot, PlotTracker } from '../src/domain';
import type { SqlExecutor } from '../src/data';
import {
  archiveActivityCategory,
  archivePerson,
  createActivity,
  createActivityCategory,
  createDemoSprayActivity,
  createPerson,
  closeCase,
  getActivityCaptureOptions,
  getCaseList,
  getCaseTimeline,
  getHoleDetail,
  getLaborLedger,
  getMenuDashboard,
  getMaterialLibrary,
  getPlotDashboard,
  getTodayDashboard,
  listActivityCategories,
  listPeople,
  listPlotTrackers,
  pinPlotTracker,
  restoreActivityCategory,
  restorePerson,
  settleUnpaidLaborForPerson,
  unpinPlotTracker,
  updateActivityCategory,
  updatePerson,
} from '../src/features/operations';

type Row = Record<string, unknown>;

class OperationalFakeSqlite implements SqlExecutor {
  gardens: Garden[] = TAKAI_DEMO_SEED.gardens.map((garden) => ({ ...garden }));
  plots: Plot[] = TAKAI_DEMO_SEED.plots.map((plot) => ({ ...plot }));
  cropCycles: CropCycle[] = TAKAI_DEMO_SEED.cropCycles.map((crop) => ({ ...crop }));
  holes: Hole[] = TAKAI_DEMO_SEED.holes.map((hole) => ({ ...hole }));
  categories: ActivityCategory[] = TAKAI_DEMO_SEED.activityCategories.map((category) => ({ ...category }));
  plotTrackers: PlotTracker[] = TAKAI_DEMO_SEED.plotTrackers.map((tracker) => ({ ...tracker }));
  people: Person[] = TAKAI_DEMO_SEED.people.map((person) => ({ ...person }));
  materials: Material[] = TAKAI_DEMO_SEED.materials.map((material) => ({ ...material }));
  cases: CaseRecord[] = TAKAI_DEMO_SEED.cases.map((caseRecord) => ({ ...caseRecord }));
  activities: Row[] = [];
  activityTargets: Row[] = [];
  activityMaterials: Row[] = [];
  activityParticipants: Row[] = [];
  laborEntries: Row[] = [];

  async execAsync(): Promise<void> {}

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('SELECT id FROM plots ORDER BY sort_order ASC LIMIT 1')) {
      return [{ id: this.plots[0]?.id }] as T[];
    }

    if (sql.includes('JOIN cases ON cases.hole_id = holes.id')) {
      const caseItem = this.cases.find((item) => item.plotId === params[0] && item.status === 'tracking');
      return caseItem?.holeId ? ([{ id: caseItem.holeId }] as T[]) : [];
    }

    if (sql.includes('SELECT id FROM holes WHERE plot_id = ? ORDER BY sort_key ASC LIMIT 1')) {
      return this.holes.filter((hole) => hole.plotId === params[0]).slice(0, 1).map((hole) => ({ id: hole.id })) as T[];
    }

    if (sql.includes('SELECT id FROM activity_categories WHERE id = ? AND archived_at IS NULL')) {
      return this.categories
        .filter((category) => category.id === params[0] && !category.archivedAt)
        .map((category) => ({ id: category.id })) as T[];
    }

    if (sql.includes('FROM activity_categories') && sql.includes('ORDER BY sort_order ASC') && !sql.includes('LEFT JOIN')) {
      const activeOnly = sql.includes('WHERE archived_at IS NULL');
      return this.categories
        .filter((category) => !activeOnly || !category.archivedAt)
        .map((category) => ({
        id: category.id,
        name: category.name,
        kind: category.kind,
        trackByDefault: category.trackByDefault,
        sortOrder: category.sortOrder,
        track_by_default: Number(category.trackByDefault),
        sort_order: category.sortOrder,
        archivedAt: category.archivedAt ?? null,
        archived_at: category.archivedAt ?? null,
      })) as T[];
    }

    if (sql.includes('FROM materials') && sql.includes('ORDER BY name ASC')) {
      const activeOnly = sql.includes('WHERE archived_at IS NULL');
      return this.materials
        .filter((material) => !activeOnly || !material.archivedAt)
        .map((material) => ({
          id: material.id,
          name: material.name,
          type: material.type,
          unit: material.unit,
          defaultRatePerTank: material.defaultRatePerTank,
          photoUri: material.photoUri,
          notes: material.notes,
          createdAt: material.createdAt,
          archivedAt: material.archivedAt,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)) as T[];
    }

    if (sql.includes('MAX(activities.performed_at) AS last_used_at')) {
      return this.materials
        .map((material) => {
          const usages = this.activityMaterials.filter((row) => row.material_id === material.id);
          const activityDates = usages
            .map((usage) => this.activities.find((activity) => activity.id === usage.activity_id)?.performed_at)
            .filter(Boolean)
            .map(String)
            .sort();
          return {
            id: material.id,
            name: material.name,
            type: material.type,
            unit: material.unit,
            default_rate_per_tank: material.defaultRatePerTank,
            photo_uri: material.photoUri,
            last_used_at: activityDates.at(-1) ?? null,
            usage_count: usages.length,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)) as T[];
    }

    if (sql.includes('SELECT id FROM people WHERE id = ? AND archived_at IS NULL')) {
      return this.people
        .filter((person) => person.id === params[0] && !person.archivedAt)
        .map((person) => ({ id: person.id })) as T[];
    }

    if (sql.includes('SELECT id FROM materials WHERE id = ? AND archived_at IS NULL')) {
      return this.materials
        .filter((material) => material.id === params[0] && !material.archivedAt)
        .map((material) => ({ id: material.id })) as T[];
    }

    if (sql.includes('FROM people') && sql.includes('ORDER BY is_self DESC')) {
      const activeOnly = sql.includes('WHERE archived_at IS NULL');
      return this.people
        .filter((person) => !activeOnly || !person.archivedAt)
        .map((person) => ({
          id: person.id,
          display_name: person.displayName,
          role: person.role,
          is_self: Number(person.isSelf),
          specialty: person.specialty ?? '',
          phone: person.phone ?? '',
          note: person.note ?? '',
          archived_at: person.archivedAt ?? null,
        }))
        .sort((left, right) => {
          const selfOrder = right.is_self - left.is_self;
          return selfOrder || (sql.includes('display_name ASC') ? left.display_name.localeCompare(right.display_name) : 0);
        }) as T[];
    }

    if (sql.trim() === 'SELECT id, display_name, role, is_self, specialty, phone, note, archived_at FROM people') {
      return this.people.map((person) => ({
        id: person.id,
        display_name: person.displayName,
        role: person.role,
        is_self: Number(person.isSelf),
        specialty: person.specialty ?? '',
        phone: person.phone ?? '',
        note: person.note ?? '',
        archived_at: person.archivedAt ?? null,
      })) as T[];
    }

    if (sql.includes('FROM crop_cycles') && sql.includes('starts_on <= date')) {
      const [plotId, performedAt] = params as string[];
      return this.cropCycles
        .filter(
          (crop) =>
            crop.plotId === plotId &&
            crop.startsOn <= performedAt.slice(0, 10) &&
            (!crop.endsOn || crop.endsOn >= performedAt.slice(0, 10)),
        )
        .map((crop) => ({ id: crop.id })) as T[];
    }

    if (sql.includes('FROM plots') && sql.includes('JOIN gardens')) {
      const plot = this.plots.find((item) => item.id === params[0]);
      const garden = this.gardens.find((item) => item.id === plot?.gardenId);
      return plot && garden
        ? ([{ id: plot.id, garden_name: garden.name, name: plot.name, area_rai: plot.areaRai }] as T[])
        : [];
    }

    if (sql.includes("WHERE plot_id = ? AND status = 'active'")) {
      return this.cropCycles
        .filter((crop) => crop.plotId === params[0] && crop.status === 'active')
        .map((crop) => ({ id: crop.id, label: crop.label, starts_on: crop.startsOn })) as T[];
    }

    if (sql.includes('SUM(CASE WHEN status =')) {
      const holes = this.holes.filter((hole) => hole.plotId === params[0]);
      return [
        {
          total: holes.length,
          planted: holes.filter((hole) => hole.status === 'planted').length,
          empty: holes.filter((hole) => hole.status === 'empty').length,
        },
      ] as T[];
    }

    if (sql.includes('FROM plot_trackers')) {
      const [maybeCropId, , plotId] = params as [string | null, string | null, string];
      return this.plotTrackers
        .filter((tracker) => tracker.plotId === plotId && !tracker.archivedAt)
        .map((tracker) => this.categories.find((category) => category.id === tracker.categoryId))
        .filter((category): category is ActivityCategory => category !== undefined && !category.archivedAt)
        .map((category) => {
          const activities = this.activities.filter(
            (activity) =>
              activity.category_id === category.id &&
              activity.plot_id === plotId &&
              activity.status === 'done' &&
              (!maybeCropId || activity.crop_cycle_id === maybeCropId),
          );
          const latest = activities.map((activity) => String(activity.performed_at)).sort().at(-1) ?? null;
          const latestFollowUp =
            activities
              .filter((activity) => Boolean(activity.follow_up_on))
              .map((activity) => String(activity.follow_up_on))
              .sort()
              .at(-1) ?? null;
          return {
            category_id: category.id,
            title: category.name,
            count: activities.length,
            latest_performed_at: latest,
            latest_follow_up_on: latestFollowUp,
          };
        })
        .sort((left, right) => {
          const leftCategory = this.categories.find((category) => category.id === left.category_id);
          const rightCategory = this.categories.find((category) => category.id === right.category_id);
          return (leftCategory?.sortOrder ?? 0) - (rightCategory?.sortOrder ?? 0);
        }) as T[];
    }

    if (sql.includes('FROM cases') && sql.includes("cases.status = 'tracking'") && sql.includes('cases.plot_id = ?')) {
      return this.cases
        .filter((caseItem) => caseItem.plotId === params[0] && caseItem.status === 'tracking')
        .map((caseItem) => ({
          id: caseItem.id,
          title: caseItem.title,
          status: caseItem.status,
          marker: this.holes.find((hole) => hole.id === caseItem.holeId)?.marker ?? null,
        })) as T[];
    }

    if (sql.includes('SELECT name FROM gardens')) {
      return [{ name: this.gardens[0]?.name }] as T[];
    }

    if (sql.trim() === 'SELECT COUNT(*) AS count FROM materials') {
      return [{ count: this.materials.length }] as T[];
    }

    if (sql.trim() === 'SELECT COUNT(*) AS count FROM plots') {
      return [{ count: this.plots.length }] as T[];
    }

    if (sql.trim() === 'SELECT COUNT(*) AS count FROM holes') {
      return [{ count: this.holes.length }] as T[];
    }

    if (sql.includes('FROM cases') && sql.includes('GROUP BY status')) {
      const counts = new Map<string, number>();
      for (const caseItem of this.cases) {
        counts.set(caseItem.status, (counts.get(caseItem.status) ?? 0) + 1);
      }
      return [...counts.entries()].map(([status, count]) => ({ status, count })) as T[];
    }

    if (sql.includes('COUNT(activity_targets.id) AS entry_count')) {
      const statusFilter = params[0] as string | null;
      return this.cases
        .filter((caseItem) => !statusFilter || caseItem.status === statusFilter)
        .map((caseItem) => {
          const targets = this.activityTargets.filter(
            (target) => target.target_type === 'case' && target.target_id === caseItem.id,
          );
          const activityDates = targets
            .map((target) => this.activities.find((activity) => activity.id === target.activity_id)?.performed_at)
            .filter(Boolean)
            .map(String)
            .sort();
          const plot = this.plots.find((item) => item.id === caseItem.plotId);
          const hole = this.holes.find((item) => item.id === caseItem.holeId);
          return {
            id: caseItem.id,
            title: caseItem.title,
            status: caseItem.status,
            opened_at: caseItem.openedAt,
            closed_at: caseItem.closedAt,
            marker: hole?.marker ?? null,
            plot_name: plot?.name ?? 'แปลง',
            entry_count: targets.length,
            latest_activity_at: activityDates.at(-1) ?? null,
          };
        })
        .sort((left, right) => {
          const order = { tracking: 0, closed: 1, archived: 2 } as Record<string, number>;
          return order[String(left.status)] - order[String(right.status)] || String(right.opened_at).localeCompare(String(left.opened_at));
        }) as T[];
    }

    if (sql.includes('GROUP_CONCAT(materials.name') && !sql.includes("activity_targets.target_type = 'hole'")) {
      return this.activities
        .filter((activity) => activity.plot_id === params[0])
        .map((activity) => {
          const category = this.categories.find((item) => item.id === activity.category_id);
          const materialNames = this.activityMaterials
            .filter((row) => row.activity_id === activity.id)
            .map((row) => this.materials.find((material) => material.id === row.material_id)?.name)
            .filter(Boolean)
            .join(', ');
          return {
            id: activity.id,
            category_name: category?.name ?? 'กิจกรรม',
            note: activity.note,
            performed_at: activity.performed_at,
            follow_up_on: activity.follow_up_on,
            material_names: materialNames || null,
          };
        })
        .sort((left, right) => String(right.performed_at).localeCompare(String(left.performed_at)))
        .slice(0, 5) as T[];
    }

    if (sql.includes('COALESCE(SUM(amount_due - amount_paid), 0) AS total')) {
      return [
        {
          total: this.laborEntries
            .filter((entry) => entry.status === 'unpaid')
            .reduce((sum, entry) => sum + Number(entry.amount_due) - Number(entry.amount_paid), 0),
        },
      ] as T[];
    }

    if (sql.includes('people.id AS person_id') && sql.includes("labor_entries.status = 'unpaid'")) {
      return this.people
        .map((person) => {
          const entries = this.laborEntries.filter((entry) => entry.person_id === person.id && entry.status === 'unpaid');
          return {
            person_id: person.id,
            display_name: person.displayName,
            unpaid_total: entries.reduce((sum, entry) => sum + Number(entry.amount_due) - Number(entry.amount_paid), 0),
            unpaid_count: entries.length,
            latest_work_date: entries.map((entry) => String(entry.work_date)).sort().at(-1) ?? null,
          };
        })
        .filter((person) => person.unpaid_count > 0)
        .sort((left, right) => right.unpaid_total - left.unpaid_total) as T[];
    }

    if (sql.includes("labor_entries.status = 'paid'")) {
      return this.laborEntries
        .filter((entry) => entry.status === 'paid')
        .map((entry) => ({
          id: entry.id,
          display_name: this.people.find((person) => person.id === entry.person_id)?.displayName ?? 'คนงาน',
          amount_paid: entry.amount_paid,
          paid_at: entry.work_date,
        })) as T[];
    }

    if (sql.includes('plots.name AS plot_name') && sql.includes('WHERE cases.id = ?')) {
      const caseItem = this.cases.find((item) => item.id === params[0]);
      const plot = this.plots.find((item) => item.id === caseItem?.plotId);
      const hole = this.holes.find((item) => item.id === caseItem?.holeId);
      return caseItem && plot
        ? ([
            {
              id: caseItem.id,
              title: caseItem.title,
              status: caseItem.status,
              opened_at: caseItem.openedAt,
              closed_at: caseItem.closedAt,
              marker: hole?.marker ?? null,
              plot_name: plot.name,
            },
          ] as T[])
        : [];
    }

    if (sql.includes("activity_targets.target_type = 'case'")) {
      return this.activities
        .filter((activity) =>
          this.activityTargets.some(
            (target) => target.activity_id === activity.id && target.target_type === 'case' && target.target_id === params[0],
          ),
        )
        .map((activity) => ({
          id: activity.id,
          category_name: this.categories.find((category) => category.id === activity.category_id)?.name ?? 'กิจกรรม',
          note: activity.note,
          performed_at: activity.performed_at,
          thumbnail_uri: null,
        }))
        .sort((left, right) => String(left.performed_at).localeCompare(String(right.performed_at))) as T[];
    }

    if (sql.includes('plantings.plant_name') && sql.includes('WHERE holes.id = ?')) {
      const hole = this.holes.find((item) => item.id === params[0]);
      const plot = this.plots.find((item) => item.id === hole?.plotId);
      const planting = TAKAI_DEMO_SEED.plantings.find((item) => item.holeId === hole?.id && !item.removedOn);
      return hole && plot
        ? ([
            {
              id: hole.id,
              marker: hole.marker,
              status: hole.status,
              plot_name: plot.name,
              plant_name: planting?.plantName ?? null,
              planted_on: planting?.plantedOn ?? null,
            },
          ] as T[])
        : [];
    }

    if (sql.includes("activity_targets.target_type = 'hole'")) {
      return this.activities
        .filter((activity) =>
          this.activityTargets.some(
            (target) => target.activity_id === activity.id && target.target_type === 'hole' && target.target_id === params[0],
          ),
        )
        .map((activity) => {
          const category = this.categories.find((item) => item.id === activity.category_id);
          const materialNames = this.activityMaterials
            .filter((row) => row.activity_id === activity.id)
            .map((row) => this.materials.find((material) => material.id === row.material_id)?.name)
            .filter(Boolean)
            .join(', ');
          return {
            id: activity.id,
            category_name: category?.name ?? 'กิจกรรม',
            note: activity.note,
            performed_at: activity.performed_at,
            follow_up_on: activity.follow_up_on,
            material_names: materialNames || null,
          };
        }) as T[];
    }

    if (sql.includes('WHERE cases.hole_id = ?')) {
      return this.cases
        .filter((caseItem) => caseItem.holeId === params[0] && caseItem.status === 'tracking')
        .map((caseItem) => ({
          id: caseItem.id,
          title: caseItem.title,
          status: caseItem.status,
          marker: this.holes.find((hole) => hole.id === caseItem.holeId)?.marker ?? null,
        })) as T[];
    }

    throw new Error(`Unhandled fake SQL: ${sql}`);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes('INSERT INTO activity_categories')) {
      const [id, name, kind, sortOrder] = params as [string, string, ActivityCategory['kind'], number];
      this.categories.push({ id, name, kind, trackByDefault: false, sortOrder, archivedAt: null });
      return;
    }

    if (sql.includes('UPDATE activity_categories SET archived_at = ?')) {
      const [archivedAt, categoryId] = params as [string, string];
      this.categories = this.categories.map((category) =>
        category.id === categoryId ? { ...category, archivedAt } : category,
      );
      return;
    }

    if (sql.includes('UPDATE activity_categories SET archived_at = NULL')) {
      const [categoryId] = params as [string];
      this.categories = this.categories.map((category) =>
        category.id === categoryId ? { ...category, archivedAt: null } : category,
      );
      return;
    }

    if (sql.includes('UPDATE activity_categories')) {
      const [name, kind, sortOrder, categoryId] = params as [string, ActivityCategory['kind'], number, string];
      this.categories = this.categories.map((category) =>
        category.id === categoryId ? { ...category, name, kind, sortOrder } : category,
      );
      return;
    }

    if (sql.includes('INSERT INTO people')) {
      const [id, displayName, role, isSelf, specialty, phone, note] = params as [
        string,
        string,
        Person['role'],
        number,
        string,
        string,
        string,
      ];
      this.people.push({
        id,
        displayName,
        role,
        isSelf: Boolean(isSelf),
        specialty,
        phone,
        note,
        archivedAt: null,
      });
      return;
    }

    if (sql.includes('UPDATE people SET archived_at = ?')) {
      const [archivedAt, personId] = params as [string, string];
      this.people = this.people.map((person) => (person.id === personId ? { ...person, archivedAt } : person));
      return;
    }

    if (sql.includes('UPDATE people SET archived_at = NULL')) {
      const [personId] = params as [string];
      this.people = this.people.map((person) => (person.id === personId ? { ...person, archivedAt: null } : person));
      return;
    }

    if (sql.includes('UPDATE people')) {
      const [displayName, role, isSelf, specialty, phone, note, personId] = params as [
        string,
        Person['role'],
        number,
        string,
        string,
        string,
        string,
      ];
      this.people = this.people.map((person) =>
        person.id === personId
          ? { ...person, displayName, role, isSelf: Boolean(isSelf), specialty, phone, note }
          : person,
      );
      return;
    }

    if (sql.includes('INSERT INTO plot_trackers')) {
      const [plotId, categoryId, createdAt] = params as [string, string, string];
      const existing = this.plotTrackers.find((tracker) => tracker.plotId === plotId && tracker.categoryId === categoryId);
      if (existing) {
        this.plotTrackers = this.plotTrackers.map((tracker) =>
          tracker === existing ? { ...tracker, archivedAt: null } : tracker,
        );
      } else {
        this.plotTrackers.push({ plotId, categoryId, createdAt, archivedAt: null });
      }
      return;
    }

    if (sql.includes('UPDATE plot_trackers')) {
      const [archivedAt, plotId, categoryId] = params as [string, string, string];
      this.plotTrackers = this.plotTrackers.map((tracker) =>
        tracker.plotId === plotId && tracker.categoryId === categoryId ? { ...tracker, archivedAt } : tracker,
      );
      return;
    }

    if (sql.includes('INSERT INTO activities')) {
      const [id, plot_id, crop_cycle_id, category_id, performed_at, note, follow_up_on] = params;
      this.activities.push({ id, plot_id, crop_cycle_id, category_id, performed_at, note, follow_up_on, status: 'done' });
      return;
    }

    if (sql.includes('INSERT INTO activity_targets')) {
      const [id, activity_id, target_type, target_id] = params;
      this.activityTargets.push({ id, activity_id, target_type, target_id });
      return;
    }

    if (sql.includes('INSERT INTO activity_materials')) {
      const [id, activity_id, material_id, amount, unit, water_volume, water_unit, dilution_text, note, sort_order] = params;
      this.activityMaterials.push({
        id,
        activity_id,
        material_id,
        amount,
        unit,
        water_volume,
        water_unit,
        dilution_text,
        note,
        sort_order,
      });
      return;
    }

    if (sql.includes('INSERT INTO activity_participants')) {
      const [id, activity_id, person_id, pay_type, amount_due] = params;
      this.activityParticipants.push({ id, activity_id, person_id, pay_type, amount_due, contract_job_id: null, paid_at: null });
      return;
    }

    if (sql.includes('INSERT INTO labor_entries')) {
      const [id, activity_participant_id, person_id, work_date, amount_due, amount_paid, status] = params;
      this.laborEntries.push({ id, activity_participant_id, person_id, work_date, amount_due, amount_paid, status });
      return;
    }

    if (sql.includes('UPDATE labor_entries')) {
      const [personId] = params;
      this.laborEntries = this.laborEntries.map((entry) =>
        entry.person_id === personId && entry.status === 'unpaid'
          ? { ...entry, amount_paid: entry.amount_due, status: 'paid' }
          : entry,
      );
      return;
    }

    if (sql.includes('UPDATE activity_participants')) {
      const [paidAt, personId] = params;
      this.activityParticipants = this.activityParticipants.map((participant) =>
        participant.person_id === personId && !participant.paid_at ? { ...participant, paid_at: paidAt } : participant,
      );
      return;
    }

    if (sql.includes('UPDATE cases')) {
      const [closedAt, caseId] = params;
      this.cases = this.cases.map((caseItem) =>
        caseItem.id === caseId && caseItem.status === 'tracking'
          ? { ...caseItem, status: 'closed', closedAt: String(closedAt) }
          : caseItem,
      );
      return;
    }

    throw new Error(`Unhandled fake SQL write: ${sql}`);
  }
}

const main = async (): Promise<void> => {
  const db = new OperationalFakeSqlite();

  const emptyToday = await getTodayDashboard(db);
  assert.equal(emptyToday.plot.name, 'แปลง A');
  assert.equal(emptyToday.plot.activeCrop?.id, 'crop-2026-plot-a');
  assert.equal(emptyToday.plot.trackers.find((tracker) => tracker.categoryId === 'cat-spray')?.count, 0);
  assert.equal(emptyToday.recentItems[0]?.id, 'empty-today');

  const options = await getActivityCaptureOptions(db);
  assert.equal(options.materials.length >= 2, true, 'Phase 3 requires two selectable materials');
  assert.equal(options.defaultWorkerId, 'person-worker-somchai');

  const categoryId = await createActivityCategory(db, {
    id: 'cat-irrigate',
    name: 'รดน้ำ',
    kind: 'other',
    sortOrder: 9,
  });
  await updateActivityCategory(db, categoryId, { name: 'ให้น้ำ', kind: 'other', sortOrder: 5 });
  assert.equal((await listActivityCategories(db)).find((category) => category.id === categoryId)?.name, 'ให้น้ำ');
  await createActivity(db, {
    id: 'activity-category-before-archive',
    plotId: options.defaultPlotId,
    categoryId,
    performedAt: '2026-07-11T06:00:00.000Z',
    note: 'ให้น้ำก่อนเก็บหมวดงาน',
    targetType: 'plot',
    targetId: options.defaultPlotId,
    materials: [],
    participants: [{ personId: 'person-self', payType: 'none', amountDue: 0 }],
  });
  await archiveActivityCategory(db, categoryId);
  assert.equal((await getActivityCaptureOptions(db)).categories.some((category) => category.id === categoryId), false);
  assert.equal(
    (await getTodayDashboard(db)).recentItems.some((item) => item.id === 'activity-category-before-archive'),
    true,
    'archiving a category must not hide its existing activity history',
  );
  await assert.rejects(
    createActivity(db, {
      id: 'activity-archived-category',
      plotId: options.defaultPlotId,
      categoryId,
      performedAt: '2026-07-11T08:00:00.000Z',
      note: '',
      targetType: 'plot',
      targetId: options.defaultPlotId,
      materials: [],
      participants: [],
    }),
    /category is unavailable/,
  );
  await restoreActivityCategory(db, categoryId);
  assert.equal((await getActivityCaptureOptions(db)).categories.some((category) => category.id === categoryId), true);

  await assert.rejects(createPerson(db, { id: 'person-invalid', displayName: '   ' }), /requires a person display name/);
  const oneTimeWorkerId = await createPerson(db, {
    id: 'person-worker-malee',
    displayName: 'มาลี',
    specialty: 'เก็บผล',
    phone: '0812345678',
    note: 'โทรนัดล่วงหน้า',
  });
  await updatePerson(db, oneTimeWorkerId, {
    displayName: 'มาลี',
    specialty: 'เก็บผลและคัดแยก',
    phone: '0812345678',
    note: 'โทรนัดล่วงหน้า',
  });
  assert.equal((await listPeople(db)).find((person) => person.id === oneTimeWorkerId)?.specialty, 'เก็บผลและคัดแยก');
  const quickAddActivity = await createActivity(db, {
    id: 'activity-one-time-worker',
    plotId: options.defaultPlotId,
    categoryId: 'cat-fertilizer',
    performedAt: '2026-07-11T08:00:00.000Z',
    note: 'เก็บผลรอบเช้า',
    targetType: 'plot',
    targetId: options.defaultPlotId,
    materials: [],
    participants: [{ personId: oneTimeWorkerId, payType: 'daily', amountDue: 450 }],
  });
  assert.equal(quickAddActivity.laborEntryIds.length, 1, 'a selected worker creates exactly one unpaid labor entry');
  await archivePerson(db, oneTimeWorkerId);
  assert.equal((await getActivityCaptureOptions(db)).people.some((person) => person.id === oneTimeWorkerId), false);
  const archivedWorkerLedger = await getLaborLedger(db);
  assert.equal(archivedWorkerLedger.unpaidPeople.find((person) => person.personId === oneTimeWorkerId)?.unpaidTotal, 450);
  await settleUnpaidLaborForPerson(db, oneTimeWorkerId);
  assert.equal((await getLaborLedger(db)).recentPaid.some((record) => record.displayName === 'มาลี'), true);
  await restorePerson(db, oneTimeWorkerId);
  assert.equal((await listPeople(db)).some((person) => person.id === oneTimeWorkerId), true, 'a quick-added worker is reusable later');
  await createActivity(db, {
    id: 'activity-returning-worker',
    plotId: options.defaultPlotId,
    categoryId: 'cat-fertilizer',
    performedAt: '2026-07-11T09:00:00.000Z',
    note: 'เลือกคนงานเดิมจากคลังรายชื่อ',
    targetType: 'plot',
    targetId: options.defaultPlotId,
    materials: [],
    participants: [{ personId: oneTimeWorkerId, payType: 'none', amountDue: 0 }],
  });

  db.plots.push({ id: 'plot-b', gardenId: 'garden-main', name: 'แปลง B', areaRai: 1, sortOrder: 2 });
  await pinPlotTracker(db, 'plot-b', 'cat-spray');
  assert.equal((await listPlotTrackers(db, 'plot-b')).some((tracker) => tracker.categoryId === 'cat-spray'), true);
  assert.equal((await listPlotTrackers(db, options.defaultPlotId)).some((tracker) => tracker.categoryId === 'cat-spray'), true);
  assert.equal(
    (await listPlotTrackers(db, 'plot-b')).some((tracker) => tracker.categoryId === 'cat-fertilizer'),
    false,
    'a tracker pinned only on plot A must never appear on plot B',
  );
  await createActivity(db, {
    id: 'activity-prune-before-unpin',
    plotId: options.defaultPlotId,
    categoryId: 'cat-prune',
    performedAt: '2026-07-11T07:00:00.000Z',
    note: 'แต่งกิ่งก่อนถอด tracker',
    targetType: 'plot',
    targetId: options.defaultPlotId,
    materials: [],
    participants: [{ personId: 'person-self', payType: 'none', amountDue: 0 }],
  });
  await unpinPlotTracker(db, options.defaultPlotId, 'cat-prune');
  assert.equal((await listPlotTrackers(db, options.defaultPlotId)).some((tracker) => tracker.categoryId === 'cat-prune'), false);
  assert.equal((await getTodayDashboard(db)).recentItems.some((item) => item.id === 'activity-prune-before-unpin'), true);
  assert.equal(
    db.plotTrackers.some((tracker) => tracker.plotId === options.defaultPlotId && tracker.categoryId === 'cat-prune' && tracker.archivedAt),
    true,
    'unpin archives the relation instead of deleting tracker history',
  );

  const created = await createDemoSprayActivity(db);
  assert.equal(created.activityId, 'activity-demo-spray');
  assert.equal(created.cropCycleId, 'crop-2026-plot-a');
  assert.deepEqual(created.laborEntryIds, ['labor-participant-activity-demo-spray-2']);
  assert.equal(db.activityMaterials.length, 2, 'spray activity should store two material usages');
  assert.equal(db.laborEntries.length, 2, 'self participants create no labor; each selected worker creates one entry');

  const reloadedToday = await getTodayDashboard(db);
  assert.equal(reloadedToday.recentItems[0]?.title, 'พ่นยา แปลง A');
  assert.equal(reloadedToday.unpaidLaborTotal, 600);
  assert.equal(reloadedToday.plot.trackers.find((tracker) => tracker.categoryId === 'cat-spray')?.count, 1);
  assert.equal(reloadedToday.plot.trackers.find((tracker) => tracker.categoryId === 'cat-spray')?.nextDueOn, '2026-07-20');

  const plotDashboard = await getPlotDashboard(db);
  assert.equal(plotDashboard.activeCases[0]?.title, 'A-014 เชื้อราโคนต้น');

  const initialCases = await getCaseList(db);
  assert.equal(initialCases.length, TAKAI_DEMO_SEED.cases.length, 'case list should derive from canonical seed');
  assert.equal(initialCases[0]?.status, 'tracking');
  assert.equal(initialCases[0]?.targetLabel, 'A-014 · แปลง A');

  const initialMenu = await getMenuDashboard(db);
  assert.equal(initialMenu.gardenName, 'สวนตาไก๊');
  assert.equal(initialMenu.activeCaseCount, 1);
  assert.equal(initialMenu.materialCount, TAKAI_DEMO_SEED.materials.length);
  assert.equal(initialMenu.localStatusLabel, 'ออฟไลน์ 100%');

  const manual = await createActivity(db, {
    id: 'activity-manual-fertilizer',
    plotId: options.defaultPlotId,
    categoryId: 'cat-fertilizer',
    performedAt: '2026-07-16T09:00:00.000Z',
    note: 'ใส่ปุ๋ยหลังฝน',
    followUpOn: null,
    targetType: 'plot',
    targetId: options.defaultPlotId,
    materials: [{ materialId: options.materials[0].id, amount: 50, unit: 'กรัม' }],
    participants: [{ personId: 'person-self', payType: 'none', amountDue: 0 }],
  });
  assert.equal(manual.cropCycleId, 'crop-2026-plot-a', 'activity should default to active crop by performed date');
  assert.equal(db.laborEntries.length, 2, 'self-only activity should not create new unpaid labor');

  const caseActivity = await createActivity(db, {
    id: 'activity-case-follow-up',
    plotId: options.defaultPlotId,
    categoryId: 'cat-case',
    performedAt: '2026-07-17T07:00:00.000Z',
    note: 'แผลเริ่มแห้ง ขูดและทายาซ้ำ',
    followUpOn: '2026-07-21',
    targetType: 'case',
    targetId: 'case-a-014',
    materials: [{ materialId: options.materials[0].id, amount: 10, unit: 'cc' }],
    participants: [],
  });
  assert.equal(caseActivity.cropCycleId, 'crop-2026-plot-a');

  const caseTimeline = await getCaseTimeline(db);
  assert.equal(caseTimeline.entries.length, 2, 'case timeline should include open event and follow-up activity');
  assert.equal(caseTimeline.entries[1]?.dayLabel, 'Day 7');

  const activeCasesAfterFollowUp = await getCaseList(db, 'tracking');
  assert.equal(activeCasesAfterFollowUp[0]?.entryCount, 1, 'selected case list should count follow-up evidence');
  assert.equal(activeCasesAfterFollowUp[0]?.latestActivityAt, '2026-07-17T07:00:00.000Z');

  const materialLibrary = await getMaterialLibrary(db);
  assert.equal(materialLibrary.find((material) => material.id === options.materials[0].id)?.usageCount, 3);

  const holeDetail = await getHoleDetail(db);
  assert.equal(holeDetail.marker, 'A-014');
  assert.equal(holeDetail.activeCases[0]?.title, 'A-014 เชื้อราโคนต้น');
  assert.equal(holeDetail.activities.some((activity) => activity.id === 'activity-demo-spray'), true);

  const laborLedger = await getLaborLedger(db);
  assert.equal(laborLedger.unpaidTotal, 600);
  await settleUnpaidLaborForPerson(db, 'person-worker-somchai');
  const settledLedger = await getLaborLedger(db);
  assert.equal(settledLedger.unpaidTotal, 0, 'settled worker should no longer appear as unpaid');

  await closeCase(db, 'case-a-014');
  const closedCase = await getCaseTimeline(db);
  assert.equal(closedCase.status, 'closed');
  const activeCasesAfterClose = await getCaseList(db, 'tracking');
  assert.equal(activeCasesAfterClose.length, 0, 'closed case should leave the active case list');
  const closedCases = await getCaseList(db, 'closed');
  assert.equal(closedCases[0]?.id, 'case-a-014', 'closed case should remain readable in history');
  const menuAfterClose = await getMenuDashboard(db);
  assert.equal(menuAfterClose.activeCaseCount, 0);
  assert.equal(menuAfterClose.closedCaseCount, 1);

  console.log('OPERATIONAL_SLICE_PASS: local activity create/read/tracker/labor contracts are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
