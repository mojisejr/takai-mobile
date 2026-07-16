import * as SQLite from 'expo-sqlite';

import { runMigrations, type SqlExecutor } from './migrations';
import { TAKAI_DB_NAME } from './schema';
import { seedDemoGarden } from './seed';

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
