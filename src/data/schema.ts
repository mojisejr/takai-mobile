export interface Migration {
  id: number;
  name: string;
  statements: string[];
}

export const TAKAI_DB_NAME = 'takai-local-v1.db';

export const TAKAI_MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_local_domain',
    statements: [
      `CREATE TABLE IF NOT EXISTS gardens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY,
        garden_id TEXT NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        area_rai REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS crop_cycles (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        ends_on TEXT,
        status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'closed'))
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_cycles_one_active_per_plot
        ON crop_cycles(plot_id)
        WHERE status = 'active'`,
      `CREATE TABLE IF NOT EXISTS holes (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        marker TEXT NOT NULL,
        sort_key TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('empty', 'planted', 'archived')),
        UNIQUE(plot_id, marker)
      )`,
      `CREATE TABLE IF NOT EXISTS plantings (
        id TEXT PRIMARY KEY,
        hole_id TEXT NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
        crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
        plant_name TEXT NOT NULL,
        planted_on TEXT NOT NULL,
        removed_on TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS activity_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        track_by_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
        category_id TEXT NOT NULL REFERENCES activity_categories(id),
        performed_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        follow_up_on TEXT,
        status TEXT NOT NULL CHECK (status IN ('done', 'planned', 'cancelled'))
      )`,
      `CREATE TABLE IF NOT EXISTS activity_targets (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL CHECK (target_type IN ('plot', 'hole', 'case')),
        target_id TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        hole_id TEXT REFERENCES holes(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('tracking', 'closed', 'archived')),
        opened_at TEXT NOT NULL,
        closed_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'worker')),
        is_self INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS contract_jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
        agreed_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('open', 'settled', 'cancelled')),
        settled_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS activity_participants (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        pay_type TEXT NOT NULL CHECK (pay_type IN ('none', 'daily', 'hourly', 'piece', 'contract')),
        amount_due REAL NOT NULL DEFAULT 0,
        contract_job_id TEXT REFERENCES contract_jobs(id) ON DELETE SET NULL,
        paid_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS labor_entries (
        id TEXT PRIMARY KEY,
        activity_participant_id TEXT NOT NULL REFERENCES activity_participants(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        work_date TEXT NOT NULL,
        amount_due REAL NOT NULL DEFAULT 0,
        amount_paid REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'cancelled'))
      )`,
      `CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        unit TEXT NOT NULL,
        default_rate_per_tank TEXT,
        photo_uri TEXT,
        notes TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS activity_materials (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        material_id TEXT NOT NULL REFERENCES materials(id),
        amount REAL NOT NULL,
        unit TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('activity', 'case', 'material', 'hole', 'plot')),
        owner_id TEXT NOT NULL,
        uri TEXT NOT NULL,
        caption TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_activities_plot_performed_at
        ON activities(plot_id, performed_at)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_materials_activity
        ON activity_materials(activity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_entries_person_status
        ON labor_entries(person_id, status, work_date)`,
    ],
  },
  {
    id: 2,
    name: 'workers_trackers_and_archives',
    statements: [
      `ALTER TABLE activity_categories ADD COLUMN archived_at TEXT`,
      `ALTER TABLE people ADD COLUMN specialty TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE people ADD COLUMN phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE people ADD COLUMN note TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE people ADD COLUMN archived_at TEXT`,
      `CREATE TABLE IF NOT EXISTS plot_trackers (
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES activity_categories(id),
        created_at TEXT NOT NULL,
        archived_at TEXT,
        PRIMARY KEY (plot_id, category_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_plot_trackers_plot_active
        ON plot_trackers(plot_id, archived_at)`,
    ],
  },
  {
    id: 3,
    name: 'truthful_activity_materials',
    statements: [
      `ALTER TABLE materials ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE materials ADD COLUMN archived_at TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN water_volume REAL`,
      `ALTER TABLE activity_materials ADD COLUMN water_unit TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN dilution_text TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN note TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS idx_materials_active_created
        ON materials(archived_at, created_at, name)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_materials_activity_sort
        ON activity_materials(activity_id, sort_order)`,
    ],
  },
  {
    id: 4,
    name: 'planting_identity_variety',
    statements: [
      `ALTER TABLE plantings ADD COLUMN variety TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_holes_plot_sort_active
        ON holes(plot_id, sort_key, status)`,
      `CREATE INDEX IF NOT EXISTS idx_plantings_hole_current
        ON plantings(hole_id, removed_on)`,
    ],
  },
  {
    id: 5,
    name: 'truthful_activity_time',
    statements: [
      `ALTER TABLE activities ADD COLUMN activity_date TEXT`,
      `ALTER TABLE activities ADD COLUMN time_mode TEXT CHECK (time_mode IN ('all_day', 'time_range', 'duration_only'))`,
      `ALTER TABLE activities ADD COLUMN started_at TEXT`,
      `ALTER TABLE activities ADD COLUMN ended_at TEXT`,
      `ALTER TABLE activities ADD COLUMN duration_minutes INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_activities_plot_date
        ON activities(plot_id, activity_date)`,
    ],
  },
  {
    id: 6,
    name: 'chemical_catalog_and_use_snapshots',
    statements: [
      `ALTER TABLE materials ADD COLUMN common_name TEXT`,
      `ALTER TABLE materials ADD COLUMN brand_name TEXT`,
      `ALTER TABLE materials ADD COLUMN chemical_group TEXT`,
      `ALTER TABLE materials ADD COLUMN usage_label TEXT`,
      `ALTER TABLE materials ADD COLUMN reference_amount REAL`,
      `ALTER TABLE materials ADD COLUMN reference_unit TEXT`,
      `ALTER TABLE materials ADD COLUMN reference_water_litres REAL`,
      `ALTER TABLE activity_materials ADD COLUMN material_name_snapshot TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN common_name_snapshot TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN brand_name_snapshot TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN reference_amount_snapshot REAL`,
      `ALTER TABLE activity_materials ADD COLUMN reference_unit_snapshot TEXT`,
      `ALTER TABLE activity_materials ADD COLUMN reference_water_litres_snapshot REAL`,
      `ALTER TABLE activity_materials ADD COLUMN actual_tank_litres REAL`,
      `ALTER TABLE activity_materials ADD COLUMN calculated_amount REAL`,
      `ALTER TABLE activity_materials ADD COLUMN manual_amount REAL`,
    ],
  },
  {
    id: 7,
    name: 'follow_up_notification_reminders',
    statements: [
      `CREATE TABLE IF NOT EXISTS notification_reminders (
        activity_id TEXT PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
        notification_id TEXT NOT NULL,
        follow_up_on TEXT NOT NULL,
        scheduled_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notification_reminders_follow_up
        ON notification_reminders(follow_up_on)`,
    ],
  },
  {
    id: 8,
    name: 'planting_lifecycle_and_activity_identity',
    statements: [
      `ALTER TABLE plantings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'dead', 'retired'))`,
      `ALTER TABLE plantings ADD COLUMN removed_reason TEXT`,
      `UPDATE plantings SET status = 'retired' WHERE removed_on IS NOT NULL`,
      `ALTER TABLE activities ADD COLUMN planting_id TEXT REFERENCES plantings(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_plantings_hole_lifecycle
        ON plantings(hole_id, status, planted_on DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activities_planting_performed_at
        ON activities(planting_id, performed_at DESC)`,
    ],
  },
];
