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
import { seedDemoGarden } from '../src/data/seed';
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

class SeedFakeSqlite implements SqlExecutor {
  insertedTables: string[] = [];
  runStatements: string[] = [];

  async execAsync(): Promise<void> {}

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  async runAsync(sql: string): Promise<void> {
    this.runStatements.push(sql);
    const match = sql.match(/^INSERT OR IGNORE INTO ([a-z_]+)/);
    if (match?.[1]) {
      this.insertedTables.push(match[1]);
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
  'plot_trackers',
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
assert.ok(TAKAI_DEMO_SEED.plotTrackers.some((tracker) => tracker.plotId === 'plot-a' && tracker.categoryId === 'cat-spray'));
assert.ok(TAKAI_DEMO_SEED.plotTrackers.every((tracker) => tracker.archivedAt === null));
assert.ok(TAKAI_DEMO_SEED.cases.some((caseRecord) => caseRecord.id === 'case-a-014'));
assert.ok(TAKAI_DEMO_SEED.people.some((person) => person.isSelf));
assert.ok(TAKAI_DEMO_SEED.people.some((person) => !person.isSelf));
assert.ok(TAKAI_DEMO_SEED.people.every((person) => person.role === 'owner' || person.role === 'worker'));
assert.equal(TAKAI_DEMO_SEED.people.find((person) => person.id === 'person-worker-somchai')?.specialty, 'แต่งกิ่ง');
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
  const upgradeDb = new FakeSqlite();
  upgradeDb.appliedIds.add(1);
  const upgradeRun = await runMigrations(upgradeDb);
  const seedDb = new SeedFakeSqlite();
  await seedDemoGarden(seedDb);

  assert.deepEqual(firstRun, [1, 2], 'empty database should apply every ordered migration');
  assert.deepEqual(secondRun, [], 'rerunning migrations should be idempotent');
  assert.deepEqual(upgradeRun, [2], 'a migration 1 database must upgrade without replaying its original schema');
  assert.ok(seedDb.insertedTables.includes('cases'), 'demo seed must include the case timeline record');
  assert.ok(seedDb.insertedTables.includes('plot_trackers'), 'demo seed must include per-plot tracker defaults');
  assert.ok(
    seedDb.runStatements.some((statement) => statement.startsWith('INSERT OR IGNORE INTO plot_trackers')),
    'seed must not re-pin a tracker that was manually archived',
  );
  assert.ok(db.execStatements.some((statement) => statement.includes('PRAGMA foreign_keys = ON')));
  assert.ok(
    db.execStatements.some((statement) =>
      statement.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_cycles_one_active_per_plot'),
    ),
  );
  assert.ok(
    TAKAI_MIGRATIONS[1]?.statements.some((statement) => statement.includes('ALTER TABLE activity_categories ADD COLUMN archived_at')),
    'migration 2 must archive categories without rewriting migration 1',
  );
  assert.ok(
    TAKAI_MIGRATIONS[1]?.statements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS plot_trackers')),
    'migration 2 must create history-safe per-plot trackers',
  );

  console.log('DOMAIN_SCHEMA_PASS: migrations, seed data, crop rules, and labor derivation are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
