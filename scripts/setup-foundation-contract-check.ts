import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SqlExecutor } from '../src/data';
import { runMigrations } from '../src/data/migrations';
import { createHole, createPlanting, createPlot, getActivityCaptureOptions, listSetupPlots } from '../src/features/operations';

type Plot = { id: string; gardenId: string; name: string; areaRai: number; sortOrder: number };
type Hole = { id: string; plotId: string; marker: string; sortKey: string; status: 'empty' | 'planted' };
type Planting = { id: string; holeId: string; plantName: string; variety: string | null; plantedOn: string };

class SetupContractDb implements SqlExecutor {
  appliedIds = new Set([1, 2, 3]);
  migrationStatements: string[] = [];
  plots: Plot[] = [{ id: 'plot-legacy', gardenId: 'garden-1', name: 'แปลงเดิม', areaRai: 2, sortOrder: 0 }];
  holes: Hole[] = [];
  plantings: Planting[] = [];

  async execAsync(sql: string): Promise<void> {
    this.migrationStatements.push(sql);
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql === 'SELECT id FROM schema_migrations ORDER BY id ASC') return [...this.appliedIds].map((id) => ({ id }) as T);
    if (sql.includes('FROM gardens WHERE archived_at IS NULL')) return [{ id: 'garden-1' }] as T[];
    if (sql.includes('SELECT id, garden_id, name, area_rai, sort_order FROM plots')) {
      return [...this.plots].sort((a, b) => a.sortOrder - b.sortOrder).map((plot) => ({ id: plot.id, garden_id: plot.gardenId, name: plot.name, area_rai: plot.areaRai, sort_order: plot.sortOrder })) as T[];
    }
    if (sql.includes('SELECT id, name FROM plots')) return this.plots.map((plot) => ({ id: plot.id, name: plot.name })) as T[];
    if (sql.includes('SELECT id FROM plots WHERE id = ?')) return this.plots.filter((plot) => plot.id === params[0]).map((plot) => ({ id: plot.id })) as T[];
    if (sql.includes("SELECT id FROM holes WHERE id = ? AND status = 'empty'")) return this.holes.filter((hole) => hole.id === params[0] && hole.status === 'empty').map((hole) => ({ id: hole.id })) as T[];
    if (sql.includes("FROM holes\n       WHERE status IN ('empty', 'planted')")) return this.holes.map((hole) => ({ id: hole.id, plot_id: hole.plotId, marker: hole.marker, status: hole.status })) as T[];
    if (sql.includes("FROM cases\n       WHERE status = 'tracking'")) return [];
    if (sql.includes('FROM activity_categories')) return [{ id: 'cat-note', name: 'บันทึก', kind: 'note', trackByDefault: 0, sortOrder: 0, archivedAt: null }] as T[];
    if (sql.includes('FROM materials')) return [];
    if (sql.includes('FROM people')) return [];
    throw new Error(`Unhandled setup contract SQL read: ${sql}`);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.appliedIds.add(Number(params[0]));
      return;
    }
    if (sql.startsWith('INSERT INTO plots')) {
      this.plots.push({ id: String(params[0]), gardenId: String(params[1]), name: String(params[2]), areaRai: Number(params[3]), sortOrder: Number(params[4]) });
      return;
    }
    if (sql.startsWith('INSERT INTO holes')) {
      this.holes.push({ id: String(params[0]), plotId: String(params[1]), marker: String(params[2]), sortKey: String(params[3]), status: 'empty' });
      return;
    }
    if (sql.startsWith('INSERT INTO plantings')) {
      this.plantings.push({ id: String(params[0]), holeId: String(params[1]), plantName: String(params[2]), variety: params[3] == null ? null : String(params[3]), plantedOn: String(params[4]) });
      return;
    }
    if (sql.startsWith("UPDATE holes SET status = 'planted'")) {
      const hole = this.holes.find((item) => item.id === params[0] && item.status === 'empty');
      if (hole) hole.status = 'planted';
      return;
    }
    throw new Error(`Unhandled setup contract SQL write: ${sql}`);
  }
}

const main = async (): Promise<void> => {
  const db = new SetupContractDb();
  assert.deepEqual(await runMigrations(db), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], 'a migrations 1–3 database must receive only later forward migrations');
  assert.ok(db.migrationStatements.some((sql) => sql.includes('ADD COLUMN variety')), 'migration 4 must add planting variety');
  assert.ok(db.migrationStatements.some((sql) => sql.includes('ADD COLUMN activity_date')), 'migration 5 must preserve legacy activity history while adding truthful date fields');
  assert.equal(db.migrationStatements.some((sql) => /DROP TABLE|DELETE FROM/i.test(sql)), false, 'migration 4 must preserve legacy data');

  const plotId = await createPlot(db, { name: 'แปลงหลังบ้าน', areaRai: 1.5 }, '2026-07-28T10:00:00.000Z');
  const holeId = await createHole(db, { plotId, marker: 'B-001' }, '2026-07-28T10:01:00.000Z');
  const plantingId = await createPlanting(db, { holeId, plantName: 'ทุเรียน', variety: 'หมอนทอง', plantedOn: '2026-07-28' }, '2026-07-28T10:02:00.000Z');

  assert.equal(plotId, 'plot-20260728100000');
  assert.equal(db.plots.find((plot) => plot.id === plotId)?.gardenId, 'garden-1');
  assert.equal(db.holes.find((hole) => hole.id === holeId)?.plotId, plotId);
  assert.equal(db.holes.find((hole) => hole.id === holeId)?.status, 'planted');
  assert.deepEqual(db.plantings.find((planting) => planting.id === plantingId), { id: plantingId, holeId, plantName: 'ทุเรียน', variety: 'หมอนทอง', plantedOn: '2026-07-28' });
  assert.equal((await listSetupPlots(db)).some((plot) => plot.id === plotId), true, 'new plot must remain selectable');
  const capture = await getActivityCaptureOptions(db);
  assert.equal(capture.plots.some((plot) => plot.id === plotId), true, 'new plot must be available to Activity');
  assert.equal(capture.holes.some((hole) => hole.id === holeId && hole.plotId === plotId && hole.status === 'planted'), true, 'new planting target must be available to Activity');
  await assert.rejects(createPlanting(db, { holeId, plantName: 'ซ้ำ', plantedOn: '2026-07-28' }), /unavailable for planting/);
  await assert.rejects(createHole(db, { plotId, marker: '   ' }), /hole marker/);
  await assert.rejects(createPlanting(db, { holeId: 'missing', plantName: 'ทุเรียน', plantedOn: '2026-99-99' }), /valid planting date/);

  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  assert.ok(screen.includes("view === 'plotList'") && screen.includes("view === 'plotCreate'") && screen.includes("view === 'plotDetail'"), 'plot navigation must split list, create, and detail surfaces');
  assert.ok(screen.includes('ขอบเขตวันนี้') && screen.includes('ทุกแปลง'), 'Today must expose an aggregate scope separate from Activity');
  assert.ok(screen.includes('บันทึกกิจกรรมแปลงนี้') && screen.includes('startPlotActivity(plot.id)'), 'plot quick record must intentionally preselect its plot');
  assert.equal((screen.match(/<TopBar title=\{plot\.name\}/g) ?? []).length, 0, 'plot view must not render a second top bar inside AppShell');

  console.log('SETUP_FOUNDATION_CONTRACT_PASS: plot, hole, planting, migration preservation, and Activity selection are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
