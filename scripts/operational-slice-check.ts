import assert from 'node:assert/strict';

import { TAKAI_DEMO_SEED } from '../src/domain';
import type { ActivityCategory, CaseRecord, CropCycle, Garden, Hole, Material, Person, Plot } from '../src/domain';
import type { SqlExecutor } from '../src/data';
import {
  createActivity,
  createDemoSprayActivity,
  closeCase,
  getActivityCaptureOptions,
  getCaseTimeline,
  getHoleDetail,
  getLaborLedger,
  getMaterialLibrary,
  getPlotDashboard,
  getTodayDashboard,
  settleUnpaidLaborForPerson,
} from '../src/features/operations';

type Row = Record<string, unknown>;

class OperationalFakeSqlite implements SqlExecutor {
  gardens: Garden[] = TAKAI_DEMO_SEED.gardens.map((garden) => ({ ...garden }));
  plots: Plot[] = TAKAI_DEMO_SEED.plots.map((plot) => ({ ...plot }));
  cropCycles: CropCycle[] = TAKAI_DEMO_SEED.cropCycles.map((crop) => ({ ...crop }));
  holes: Hole[] = TAKAI_DEMO_SEED.holes.map((hole) => ({ ...hole }));
  categories: ActivityCategory[] = TAKAI_DEMO_SEED.activityCategories.map((category) => ({ ...category }));
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

    if (sql.includes('FROM activity_categories') && sql.includes('ORDER BY sort_order ASC') && !sql.includes('LEFT JOIN')) {
      return this.categories.map((category) => ({
        id: category.id,
        name: category.name,
        kind: category.kind,
        trackByDefault: category.trackByDefault,
        sortOrder: category.sortOrder,
      })) as T[];
    }

    if (sql.includes('FROM materials') && sql.includes('ORDER BY name ASC')) {
      return this.materials
        .map((material) => ({
          id: material.id,
          name: material.name,
          type: material.type,
          unit: material.unit,
          defaultRatePerTank: material.defaultRatePerTank,
          photoUri: material.photoUri,
          notes: material.notes,
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

    if (sql.includes('FROM people ORDER BY is_self DESC')) {
      return this.people
        .map((person) => ({
          id: person.id,
          display_name: person.displayName,
          role: person.role,
          is_self: Number(person.isSelf),
        }))
        .sort((left, right) => right.is_self - left.is_self) as T[];
    }

    if (sql.trim() === 'SELECT id, display_name, role, is_self FROM people') {
      return this.people.map((person) => ({
        id: person.id,
        display_name: person.displayName,
        role: person.role,
        is_self: Number(person.isSelf),
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

    if (sql.includes('LEFT JOIN activities') && sql.includes('activity_categories.track_by_default = 1')) {
      const [plotId, maybeCropId] = params as [string, string | null, string | null];
      return this.categories
        .filter((category) => category.trackByDefault)
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
      const [id, activity_id, material_id, amount, unit] = params;
      this.activityMaterials.push({ id, activity_id, material_id, amount, unit });
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

  const created = await createDemoSprayActivity(db);
  assert.equal(created.activityId, 'activity-demo-spray');
  assert.equal(created.cropCycleId, 'crop-2026-plot-a');
  assert.deepEqual(created.laborEntryIds, ['labor-participant-activity-demo-spray-2']);
  assert.equal(db.activityMaterials.length, 2, 'spray activity should store two material usages');
  assert.equal(db.laborEntries.length, 1, 'self participant must not create labor entry; worker must');

  const reloadedToday = await getTodayDashboard(db);
  assert.equal(reloadedToday.recentItems[0]?.title, 'พ่นยา แปลง A');
  assert.equal(reloadedToday.unpaidLaborTotal, 600);
  assert.equal(reloadedToday.plot.trackers.find((tracker) => tracker.categoryId === 'cat-spray')?.count, 1);
  assert.equal(reloadedToday.plot.trackers.find((tracker) => tracker.categoryId === 'cat-spray')?.nextDueOn, '2026-07-20');

  const plotDashboard = await getPlotDashboard(db);
  assert.equal(plotDashboard.activeCases[0]?.title, 'A-014 เชื้อราโคนต้น');

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
  assert.equal(db.laborEntries.length, 1, 'self-only activity should not create new unpaid labor');

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

  console.log('OPERATIONAL_SLICE_PASS: local activity create/read/tracker/labor contracts are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
