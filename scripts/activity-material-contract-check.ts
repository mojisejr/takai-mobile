import assert from 'node:assert/strict';

import type { Material, Person } from '../src/domain';
import type { SqlExecutor } from '../src/data';
import { runMigrations } from '../src/data/migrations';
import { createActivity } from '../src/features/operations';

type Row = Record<string, unknown>;

class ActivityMaterialContractDb implements SqlExecutor {
  materials: Material[] = [
    {
      id: 'material-fungicide',
      name: 'สารป้องกันเชื้อรา',
      type: 'fungicide',
      unit: 'cc',
      defaultRatePerTank: null,
      photoUri: null,
      notes: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
    },
    {
      id: 'material-spreader',
      name: 'สารจับใบ',
      type: 'other',
      unit: 'cc',
      defaultRatePerTank: null,
      photoUri: null,
      notes: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
    },
  ];
  people: Person[] = [
    {
      id: 'person-self',
      displayName: 'เจ้าของสวน',
      role: 'owner',
      isSelf: true,
      specialty: '',
      phone: '',
      note: '',
      archivedAt: null,
    },
  ];
  writes: Array<{ sql: string; params: unknown[] }> = [];

  async execAsync(): Promise<void> {}

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM activity_categories WHERE id = ? AND archived_at IS NULL')) {
      return params[0] === 'cat-prune' ? ([{ id: 'cat-prune' }] as T[]) : [];
    }
    if (sql.includes('FROM people WHERE id = ? AND archived_at IS NULL')) {
      return this.people.filter((person) => person.id === params[0] && !person.archivedAt).map((person) => ({ id: person.id })) as T[];
    }
    if (sql.includes('FROM materials WHERE id = ? AND archived_at IS NULL')) {
      return this.materials
        .filter((material) => material.id === params[0] && !material.archivedAt)
        .map((material) => ({ id: material.id })) as T[];
    }
    if (sql.includes('FROM crop_cycles') && sql.includes('starts_on <= date')) {
      return [{ id: 'crop-2026-plot-a' }] as T[];
    }
    if (sql.includes('SELECT id, display_name, role, is_self, specialty, phone, note, archived_at FROM people')) {
      return this.people.map((person) => ({
        id: person.id,
        display_name: person.displayName,
        role: person.role,
        is_self: Number(person.isSelf),
        specialty: person.specialty,
        phone: person.phone,
        note: person.note,
        archived_at: person.archivedAt,
      })) as T[];
    }
    throw new Error(`Unhandled material contract SQL read: ${sql}`);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.writes.push({ sql, params });
  }
}

class MigrationContractDb implements SqlExecutor {
  appliedIds = new Set([1, 2]);
  statements: string[] = [];
  legacyMaterial = { id: 'legacy-material', unit: 'cc' };
  legacyUsage = { id: 'legacy-usage', material_id: 'legacy-material', amount: 20, unit: 'cc' };

  async execAsync(sql: string): Promise<void> {
    this.statements.push(sql);
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    assert.equal(sql, 'SELECT id FROM schema_migrations ORDER BY id ASC');
    return [...this.appliedIds].map((id) => ({ id }) as T);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.startsWith('INSERT INTO schema_migrations')) this.appliedIds.add(Number(params[0]));
  }
}

const createInput = (id: string) => ({
  id,
  plotId: 'plot-a',
  categoryId: 'cat-prune',
  performedAt: '2026-07-23T06:00:00.000Z',
  note: 'บันทึกงานสวน',
  targetType: 'plot' as const,
  targetId: 'plot-a',
  participants: [{ personId: 'person-self', payType: 'none' as const, amountDue: 0 }],
});

const main = async (): Promise<void> => {
  const migrationDb = new MigrationContractDb();
  assert.deepEqual(await runMigrations(migrationDb), [3], 'an existing migration 2 database must receive only migration 3');
  assert.deepEqual(migrationDb.legacyMaterial, { id: 'legacy-material', unit: 'cc' }, 'migration must not rewrite existing material data');
  assert.deepEqual(migrationDb.legacyUsage, { id: 'legacy-usage', material_id: 'legacy-material', amount: 20, unit: 'cc' }, 'migration must not lose historical usage data');
  assert.equal(migrationDb.statements.some((statement) => /DROP TABLE|DELETE FROM/i.test(statement)), false, 'migration 3 must be additive');

  const db = new ActivityMaterialContractDb();
  await createActivity(db, { ...createInput('activity-no-material'), materials: [] });
  assert.equal(
    db.writes.some((write) => write.sql.includes('INSERT INTO activity_materials')),
    false,
    'a pruning or note activity with no materials must not create a fake usage row',
  );

  await createActivity(db, {
    ...createInput('activity-two-materials'),
    materials: [
      {
        materialId: 'material-fungicide',
        amount: 20,
        unit: 'cc',
        waterVolume: 20,
        waterUnit: 'L',
        dilutionText: '20 cc / 20 L',
        note: 'พ่นโคนต้น',
        sortOrder: 2,
      },
      {
        materialId: 'material-spreader',
        amount: 10,
        unit: 'cc',
        waterVolume: 20,
        waterUnit: 'L',
        dilutionText: '10 cc / 20 L',
        note: 'ผสมพร้อมกัน',
        sortOrder: 3,
      },
    ],
  });
  const usages = db.writes.filter((write) => write.sql.includes('INSERT INTO activity_materials'));
  assert.equal(usages.length, 2, 'two selected materials must create two historical usage rows');
  assert.deepEqual(usages[0]?.params.slice(2), ['material-fungicide', 20, 'cc', 20, 'L', '20 cc / 20 L', 'พ่นโคนต้น', 2]);
  assert.deepEqual(usages[1]?.params.slice(2), ['material-spreader', 10, 'cc', 20, 'L', '10 cc / 20 L', 'ผสมพร้อมกัน', 3]);

  db.materials = db.materials.map((material) =>
    material.id === 'material-fungicide' ? { ...material, unit: 'ml', archivedAt: '2026-07-23T07:00:00.000Z' } : material,
  );
  assert.equal(usages[0]?.params[4], 'cc', 'the historical usage preserves its original unit snapshot after catalog edits');
  assert.equal(usages[0]?.params[2], 'material-fungicide', 'archiving a material must not remove its historical usage reference');
  await assert.rejects(
    createActivity(db, {
      ...createInput('activity-archived-material'),
      materials: [{ materialId: 'material-fungicide', amount: 1, unit: 'cc' }],
    }),
    /material is unavailable/,
  );
  await assert.rejects(
    createActivity(db, {
      ...createInput('activity-zero-material'),
      materials: [{ materialId: 'material-spreader', amount: 0, unit: 'cc' }],
    }),
    /amount must be positive/,
  );

  console.log('ACTIVITY_MATERIAL_CONTRACT_PASS: optional, ordered, snapshot-safe material usage is valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
