import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { seedDemoGarden } from '../src/data/seed';
import {
  emptyMaterialDraft,
  materialDraftFromLibrary,
  validateMaterialCatalogDraft,
} from '../src/features/operations/materialCatalogFlow';
import { createMaterial, getMaterialLibrary, updateMaterial } from '../src/features/operations/repository';

class NodeSqliteExecutor implements SqlExecutor {
  constructor(private readonly database: DatabaseSync) {}
  async execAsync(sql: string): Promise<void> { this.database.exec(sql); }
  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }
  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.database.prepare(sql).run(...(params as SQLInputValue[]));
  }
}

const main = async (): Promise<void> => {
  const connection = new DatabaseSync(':memory:');
  const db = new NodeSqliteExecutor(connection);
  try {
    await runMigrations(db);
    await seedDemoGarden(db);
    const editedId = await createMaterial(db, {
      id: 'material-edit-source', name: 'สารเดิม', type: 'fungicide', unit: 'cc',
      notes: 'โน้ตเดิมต้องอยู่ครบ', commonName: 'แมนโคเซบ', brandName: 'ยี่ห้อเดิม',
      referenceAmount: 20, referenceUnit: 'cc', referenceWaterLitres: 200,
    }, '2026-07-29T12:00:00.000Z');
    const beforeEdit = (await getMaterialLibrary(db)).find((material) => material.id === editedId);
    assert.ok(beforeEdit, 'created catalog record must be hydrated from the library');
    const editDraft = materialDraftFromLibrary(beforeEdit);
    assert.equal(editDraft.notes, 'โน้ตเดิมต้องอยู่ครบ', 'library -> edit hydration must preserve notes');
    await updateMaterial(db, editedId, { ...editDraft, name: 'สารเดิมที่แก้ชื่อ' });
    assert.equal((await getMaterialLibrary(db)).find((material) => material.id === editedId)?.notes, 'โน้ตเดิมต้องอยู่ครบ', 'an untouched optional note must survive edit');

    const addDraft = emptyMaterialDraft();
    assert.equal(addDraft.id, '', 'a fresh Add flow has no stale edit ID');
    addDraft.name = 'สารใหม่';
    const createdId = await createMaterial(db, addDraft, '2026-07-29T12:01:00.000Z');
    assert.notEqual(createdId, editedId, 'edit -> add must create a distinct catalog ID');
    assert.equal(validateMaterialCatalogDraft({ ...emptyMaterialDraft(), name: '' }), 'กรุณาระบุชื่อวัสดุหรือชื่อสามัญ');
    assert.equal(validateMaterialCatalogDraft({ ...emptyMaterialDraft(), name: 'มีชื่อ', unit: '', referenceUnit: '' }), 'กรุณาระบุหน่วยของวัสดุ');
    console.log('MATERIAL_CATALOG_INTEGRITY_PASS: explicit add/edit drafts keep IDs distinct and preserve notes');
  } finally {
    connection.close();
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
