import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { createLaborNotebookAdapter, LABOR_PREVIEW_FIXTURE } from '../src/features/labor-mvp/preview';
import { createWebLaborNotebookAdapter } from '../src/features/labor-mvp/preview.web';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[]; }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> { this.database.prepare(sql).run(...(params as SQLInputValue[])); }
}

const main = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-notebook-'));
  let connection: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(join(directory, 'notebook.db'));
    const db = new NodeSqliteExecutor(connection);
    await runMigrations(db);
    const notebook = createLaborNotebookAdapter(db);

    assert.equal((await notebook.getReadModel()).people.length, 0, 'normal notebook boot must not seed proof workers');
    assert.equal((await notebook.workers.list()).some((worker) => worker.id === LABOR_PREVIEW_FIXTURE.people.suda.id), false, 'normal notebook must not surface fixture records');
    const workerId = await notebook.workers.create({ displayName: 'น้าทดสอบ', specialty: 'ตัดหญ้า' });
    await notebook.commands.createNormalWork({ title: 'ตัดหญ้า', workDate: '2026-08-02', participants: [{ personId: workerId, payType: 'daily', dueSatang: 35_000 }] });
    await notebook.workers.update(workerId, { phone: '0800000000', reason: 'เพิ่มเบอร์ติดต่อ' });
    await notebook.workers.archive(workerId, 'หยุดทำงานแล้ว');

    assert.equal((await notebook.workers.list()).some((worker) => worker.id === workerId), false, 'new work pickers must receive active workers only');
    assert.equal((await notebook.workers.list({ includeArchived: true })).find((worker) => worker.id === workerId)?.archivedAt !== null, true, 'archive must remain available to historical reads');
    assert.equal((await notebook.getReadModel()).people.find((person) => person.id === workerId)?.wageRemainingSatang, 35_000, 'archiving must not erase a worker balance or job history');

    const web = createWebLaborNotebookAdapter();
    await assert.rejects(web.workers.create({ displayName: 'ห้ามเขียนจากเว็บ' }), /ยังไม่รองรับ/, 'web notebook must reject worker writes honestly');
    assert.deepEqual(await web.getReadModel(), { people: [], payables: [], payments: [], timeline: [], contracts: [], legacySources: [], legacyBalances: [], settlementGroups: [], workBasisSnapshots: [], advances: [], advanceDeductions: [] }, 'web notebook must not manufacture proof records');

    const ui = await readFile(join(process.cwd(), 'src/features/labor-mvp/LaborMvpApp.tsx'), 'utf8');
    for (const forbidden of ['Labor MVP', 'Labor Preview', 'Labor ledger', 'LABOR MVP', 'บันทึก Labor']) assert.equal(ui.includes(forbidden), false, `product UI must not expose developer wording: ${forbidden}`);
    assert.ok(ui.includes('activePeople'), 'new record pickers must select active people only');
    assert.ok(ui.includes('NotebookEmptyState') && ui.includes('takai-mascot-bust.png'), 'mascot must be limited to intentional empty/about states');
    assert.ok(ui.includes('monthRequest') && ui.includes('RetryState') && ui.includes('skeletonLine'), 'root, detail, and calendar reads need typed loading, retry, and latest-request handling');
    console.log('LABOR_NOTEBOOK_BOUNDARY_PASS: clean notebook boot, native worker seam, archived history, web read-only truth, and product-copy/loading contracts are aligned');
  } finally {
    connection?.close();
    await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
