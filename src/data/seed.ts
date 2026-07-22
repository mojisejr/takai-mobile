import { TAKAI_DEMO_SEED } from '../domain/seed';
import type { SqlExecutor } from './migrations';

type SeedRow = Record<string, string | number | boolean | null | undefined>;

const insertOrIgnore = async (db: SqlExecutor, table: string, row: SeedRow): Promise<void> => {
  const entries = Object.entries(row).map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]);
  const columns = entries.map(([key]) => key);
  const placeholders = columns.map(() => '?');
  const values = entries.map(([, value]) => value ?? null);

  await db.runAsync(
    `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  );
};

export const seedDemoGarden = async (db: SqlExecutor): Promise<void> => {
  for (const garden of TAKAI_DEMO_SEED.gardens) {
    await insertOrIgnore(db, 'gardens', {
      id: garden.id,
      name: garden.name,
      created_at: garden.createdAt,
      archived_at: garden.archivedAt,
    });
  }

  for (const plot of TAKAI_DEMO_SEED.plots) {
    await insertOrIgnore(db, 'plots', {
      id: plot.id,
      garden_id: plot.gardenId,
      name: plot.name,
      area_rai: plot.areaRai,
      sort_order: plot.sortOrder,
    });
  }

  for (const crop of TAKAI_DEMO_SEED.cropCycles) {
    await insertOrIgnore(db, 'crop_cycles', {
      id: crop.id,
      plot_id: crop.plotId,
      label: crop.label,
      starts_on: crop.startsOn,
      ends_on: crop.endsOn,
      status: crop.status,
    });
  }

  for (const hole of TAKAI_DEMO_SEED.holes) {
    await insertOrIgnore(db, 'holes', {
      id: hole.id,
      plot_id: hole.plotId,
      marker: hole.marker,
      sort_key: hole.sortKey,
      status: hole.status,
    });
  }

  for (const planting of TAKAI_DEMO_SEED.plantings) {
    await insertOrIgnore(db, 'plantings', {
      id: planting.id,
      hole_id: planting.holeId,
      crop_cycle_id: planting.cropCycleId,
      plant_name: planting.plantName,
      planted_on: planting.plantedOn,
      removed_on: planting.removedOn,
    });
  }

  for (const category of TAKAI_DEMO_SEED.activityCategories) {
    await insertOrIgnore(db, 'activity_categories', {
      id: category.id,
      name: category.name,
      kind: category.kind,
      track_by_default: category.trackByDefault,
      sort_order: category.sortOrder,
      archived_at: category.archivedAt,
    });
  }

  for (const tracker of TAKAI_DEMO_SEED.plotTrackers) {
    // INSERT OR IGNORE preserves a manually archived plot/category relation; seed never re-pins it.
    await insertOrIgnore(db, 'plot_trackers', {
      plot_id: tracker.plotId,
      category_id: tracker.categoryId,
      created_at: tracker.createdAt,
      archived_at: tracker.archivedAt,
    });
  }

  for (const caseRecord of TAKAI_DEMO_SEED.cases) {
    await insertOrIgnore(db, 'cases', {
      id: caseRecord.id,
      plot_id: caseRecord.plotId,
      hole_id: caseRecord.holeId,
      title: caseRecord.title,
      status: caseRecord.status,
      opened_at: caseRecord.openedAt,
      closed_at: caseRecord.closedAt,
    });
  }

  for (const person of TAKAI_DEMO_SEED.people) {
    await insertOrIgnore(db, 'people', {
      id: person.id,
      display_name: person.displayName,
      role: person.role,
      is_self: person.isSelf,
      specialty: person.specialty,
      phone: person.phone,
      note: person.note,
      archived_at: person.archivedAt,
    });
  }

  for (const material of TAKAI_DEMO_SEED.materials) {
    await insertOrIgnore(db, 'materials', {
      id: material.id,
      name: material.name,
      type: material.type,
      unit: material.unit,
      default_rate_per_tank: material.defaultRatePerTank,
      photo_uri: material.photoUri,
      notes: material.notes,
    });
  }
};
