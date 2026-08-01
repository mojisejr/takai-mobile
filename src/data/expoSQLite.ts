import * as SQLite from 'expo-sqlite';

import { runMigrations, type SqlExecutor } from './migrations';
import { TAKAI_DB_NAME } from './schema';
import { seedDemoGarden } from './seed';
import { createLaborPreviewAdapter, type LaborPreviewAdapter } from '../features/labor-mvp/preview';

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

export const initializeTakaiLaborPreview = async (): Promise<LaborPreviewAdapter> => {
  const db = await SQLite.openDatabaseAsync('takai-labor-preview-v1.db') as TakaiDatabase;
  await runMigrations(db);
  return createLaborPreviewAdapter(db, 'native-preview');
};
