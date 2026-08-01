import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtemp } from 'node:fs/promises';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { createLaborPreviewAdapter, LABOR_PREVIEW_FIXTURE, normalizeLaborPreviewReadModel, seedLaborPreviewFixture } from '../src/features/labor-mvp/preview';
import { LABOR_PREVIEW_WEB_READ_MODEL } from '../src/features/labor-mvp/preview.web.fixture';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-preview-'));
  const databasePath = join(directory, 'preview.db');
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    await runMigrations(db);
    const initial = await seedLaborPreviewFixture(db);
    const adapter = await createLaborPreviewAdapter(db, 'web-preview');
    const adapterRead = await adapter.getReadModel();
    const repeated = await seedLaborPreviewFixture(db);

    assert.equal(adapter.fixtureVersion, LABOR_PREVIEW_FIXTURE.version, 'adapter must expose the shared fixture version');
    assert.equal(adapter.platform, 'web-preview', 'test must exercise the web adapter lane');
    assert.deepEqual(adapterRead, normalizeLaborPreviewReadModel(initial), 'adapter read model must be repository-derived fixture truth');
    assert.deepEqual(LABOR_PREVIEW_WEB_READ_MODEL, adapterRead, 'web materialized fixture must match the repository-generated preview exactly');
    assert.deepEqual(repeated, initial, 'fixture seed must be idempotent');
    assert.equal(initial.people.length, 3, 'shared fixture must create Labor workers');
    assert.equal(initial.payables.length, 1, 'only individual work creates a personal payable');
    assert.equal(initial.settlementGroups.length, 1, 'group work must retain one settlement owner');
    assert.equal(initial.settlementGroups[0]?.remainingSatang, 0, 'group receipt must settle the group without worker shares');
    assert.equal(initial.payments[0]?.totalSatang, 35_000, 'individual payment must remain a person wage payment');
    assert.equal(initial.advances[0]?.remainingSatang, 100_000, 'advance remains person-scoped');
    console.log('LABOR_PREVIEW_ADAPTER_PASS: shared repository seed, idempotent web adapter, group receipt, wage payment, and advance truth are aligned');
  } finally {
    connection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
