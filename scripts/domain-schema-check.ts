import assert from 'node:assert/strict';

import {
  assertNoCropOverlap,
  assertOneActiveCropPerPlot,
  laborEntriesForParticipants,
  resolveCropForActivity,
  TAKAI_DEMO_SEED,
  type Activity,
  type ActivityParticipant,
  type CropCycle,
} from '../src/domain';
import { runMigrations, type SqlExecutor } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';

class FakeSqlite implements SqlExecutor {
  appliedIds = new Set<number>();
  execStatements: string[] = [];
  runStatements: string[] = [];

  async execAsync(sql: string): Promise<void> {
    this.execStatements.push(sql);
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    assert.equal(sql, 'SELECT id FROM schema_migrations ORDER BY id ASC');
    return Array.from(this.appliedIds)
      .sort((left, right) => left - right)
      .map((id) => ({ id }) as T);
  }

  async runAsync(sql: string, params?: unknown[]): Promise<void> {
    this.runStatements.push(sql);
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.appliedIds.add(Number(params?.[0]));
    }
  }
}

const requireTable = (tableName: string): void => {
  const found = TAKAI_MIGRATIONS.some((migration) =>
    migration.statements.some((statement) => statement.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`)),
  );
  assert.equal(found, true, `missing table ${tableName}`);
};

const requiredTables = [
  'gardens',
  'plots',
  'crop_cycles',
  'holes',
  'plantings',
  'activity_categories',
  'activities',
  'activity_targets',
  'cases',
  'people',
  'activity_participants',
  'labor_entries',
  'contract_jobs',
  'materials',
  'activity_materials',
  'media_assets',
];

for (const tableName of requiredTables) {
  requireTable(tableName);
}

assert.equal(TAKAI_DEMO_SEED.plots[0]?.name, 'แปลง A');
assert.equal(TAKAI_DEMO_SEED.cropCycles[0]?.status, 'active');
assert.ok(TAKAI_DEMO_SEED.holes.length >= 3);
assert.ok(TAKAI_DEMO_SEED.activityCategories.some((category) => category.id === 'cat-spray'));
assert.ok(TAKAI_DEMO_SEED.people.some((person) => person.isSelf));
assert.ok(TAKAI_DEMO_SEED.people.some((person) => !person.isSelf));
assert.ok(TAKAI_DEMO_SEED.materials.some((material) => material.type === 'fungicide'));

const crop2025: CropCycle = {
  id: 'crop-2025',
  plotId: 'plot-a',
  label: 'Crop 2025',
  startsOn: '2025-01-01',
  endsOn: '2025-12-31',
  status: 'closed',
};
const crop2026: CropCycle = TAKAI_DEMO_SEED.cropCycles[0];
const overlappingCrop: CropCycle = {
  id: 'crop-overlap',
  plotId: 'plot-a',
  label: 'Overlap',
  startsOn: '2026-02-01',
  endsOn: null,
  status: 'planned',
};

assert.doesNotThrow(() => assertNoCropOverlap([crop2025], crop2026));
assert.throws(() => assertNoCropOverlap([crop2026], overlappingCrop), /overlaps/);
assert.doesNotThrow(() => assertOneActiveCropPerPlot([crop2025, crop2026]));
assert.throws(
  () => assertOneActiveCropPerPlot([crop2026, { ...overlappingCrop, status: 'active' }]),
  /multiple active crop cycles/,
);

assert.equal(resolveCropForActivity([crop2025, crop2026], 'plot-a', '2025-06-01T09:00:00.000Z')?.id, 'crop-2025');
assert.equal(resolveCropForActivity([crop2025, crop2026], 'plot-a', '2026-07-16T09:00:00.000Z')?.id, 'crop-2026-plot-a');
assert.equal(resolveCropForActivity([crop2025, crop2026], 'plot-a', '2024-01-01T09:00:00.000Z'), null);

const activity: Activity = {
  id: 'activity-1',
  plotId: 'plot-a',
  cropCycleId: 'crop-2026-plot-a',
  categoryId: 'cat-prune',
  performedAt: '2026-07-16T08:30:00.000Z',
  note: 'แต่งกิ่งรอบเช้า',
  followUpOn: null,
  status: 'done',
};
const participants: ActivityParticipant[] = [
  {
    id: 'participant-self',
    activityId: activity.id,
    personId: 'person-self',
    payType: 'none',
    amountDue: 0,
  },
  {
    id: 'participant-worker',
    activityId: activity.id,
    personId: 'person-worker-somchai',
    payType: 'daily',
    amountDue: 600,
  },
];

const laborEntries = laborEntriesForParticipants(activity, participants, TAKAI_DEMO_SEED.people);
assert.equal(laborEntries.length, 1);
assert.equal(laborEntries[0]?.personId, 'person-worker-somchai');
assert.equal(laborEntries[0]?.status, 'unpaid');
assert.equal(laborEntries[0]?.amountDue, 600);

const main = async (): Promise<void> => {
  const db = new FakeSqlite();
  const firstRun = await runMigrations(db);
  const secondRun = await runMigrations(db);

  assert.deepEqual(firstRun, [1], 'empty database should apply first migration');
  assert.deepEqual(secondRun, [], 'rerunning migrations should be idempotent');
  assert.ok(db.execStatements.some((statement) => statement.includes('PRAGMA foreign_keys = ON')));
  assert.ok(
    db.execStatements.some((statement) =>
      statement.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_cycles_one_active_per_plot'),
    ),
  );

  console.log('DOMAIN_SCHEMA_PASS: migrations, seed data, crop rules, and labor derivation are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
