import * as SQLite from 'expo-sqlite';

import { runMigrations, type SqlExecutor } from './migrations';
import { TAKAI_DB_NAME } from './schema';
import { seedDemoGarden } from './seed';
import { createLaborV2NotebookAdapter, type LaborV2Adapter } from '../features/labor-mvp/previewV2Adapter';

export type TakaiDatabase = SQLite.SQLiteDatabase & SqlExecutor;

export const openTakaiDatabase = async (): Promise<TakaiDatabase> => {
  return SQLite.openDatabaseAsync(TAKAI_DB_NAME) as Promise<TakaiDatabase>;
};

export const initializeTakaiDatabase = async (): Promise<TakaiDatabase> => {
  const db = await openTakaiDatabase();
  await runMigrations(db);
  await seedDemoGarden(db);
  return db;
};

export const initializeTakaiLaborPreview = async (): Promise<LaborV2Adapter> => {
  const db = await SQLite.openDatabaseAsync('takai-labor-preview-v1.db') as TakaiDatabase;
  await runMigrations(db);
  return createLaborV2NotebookAdapter(db);
};

/** Product boot path. Existing proof data remains untouched in its own database. */
export const initializeTakaiLaborNotebook = async (): Promise<LaborV2Adapter> => {
  const db = await openTakaiDatabase();
  await runMigrations(db);
  return createLaborV2NotebookAdapter(db);
};
