import { TAKAI_MIGRATIONS } from './schema';

export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface AppliedMigration {
  id: number;
}

export const ensureMigrationTable = async (db: SqlExecutor): Promise<void> => {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
};

export const runMigrations = async (db: SqlExecutor): Promise<number[]> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await ensureMigrationTable(db);

  const rows = await db.getAllAsync<AppliedMigration>('SELECT id FROM schema_migrations ORDER BY id ASC');
  const appliedIds = new Set(rows.map((row) => row.id));
  const appliedNow: number[] = [];

  for (const migration of TAKAI_MIGRATIONS) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    for (const statement of migration.statements) {
      await db.execAsync(statement);
    }

    await db.runAsync(
      'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
      [migration.id, migration.name, new Date().toISOString()],
    );
    appliedNow.push(migration.id);
  }

  return appliedNow;
};
