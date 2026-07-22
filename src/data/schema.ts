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
];
