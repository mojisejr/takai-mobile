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
  {
    id: 9,
    name: 'labor_mvp_core_ledger_and_timeline',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        work_date TEXT NOT NULL,
        plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL CHECK (kind IN ('normal', 'contract', 'legacy_import')),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
        cancellation_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_job_participants (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL REFERENCES labor_jobs(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        pay_type TEXT NOT NULL CHECK (pay_type IN ('none', 'daily', 'hourly', 'piece', 'contract')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        UNIQUE(labor_job_id, person_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payables (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL REFERENCES labor_jobs(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL REFERENCES labor_job_participants(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        due_satang INTEGER NOT NULL CHECK (typeof(due_satang) = 'integer' AND due_satang > 0),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
        cancellation_reason TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(participant_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payment_batches (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES people(id),
        payment_date TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        total_satang INTEGER NOT NULL CHECK (typeof(total_satang) = 'integer' AND total_satang > 0),
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payment_allocations (
        id TEXT PRIMARY KEY,
        payment_batch_id TEXT NOT NULL REFERENCES labor_payment_batches(id) ON DELETE CASCADE,
        payable_id TEXT NOT NULL REFERENCES labor_payables(id),
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        UNIQUE(payment_batch_id, payable_id)
      )`,
      `CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'labor_job', 'labor_payment')),
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        reason TEXT,
        before_json TEXT,
        after_json TEXT NOT NULL,
        person_id TEXT REFERENCES people(id),
        labor_job_id TEXT REFERENCES labor_jobs(id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_jobs_work_date ON labor_jobs(work_date DESC, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_participants_person ON labor_job_participants(person_id, labor_job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payables_person_open ON labor_payables(person_id, status, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_batches_person_date ON labor_payment_batches(person_id, payment_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_allocations_payable ON labor_payment_allocations(payable_id)`,
      `CREATE INDEX IF NOT EXISTS idx_timeline_events_entity ON timeline_events(entity_type, entity_id, occurred_at DESC)`,
      `CREATE TRIGGER IF NOT EXISTS prevent_timeline_event_update
        BEFORE UPDATE ON timeline_events
        BEGIN SELECT RAISE(ABORT, 'timeline events are immutable'); END`,
      `CREATE TRIGGER IF NOT EXISTS prevent_timeline_event_delete
        BEFORE DELETE ON timeline_events
        BEGIN SELECT RAISE(ABORT, 'timeline events are immutable'); END`,
    ],
  },
  {
    id: 10,
    name: 'labor_mvp_contract_detail_surfaces',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_contract_details (
        labor_job_id TEXT PRIMARY KEY REFERENCES labor_jobs(id) ON DELETE CASCADE,
        starts_on TEXT,
        deadline_on TEXT,
        completed_on TEXT,
        status TEXT NOT NULL DEFAULT 'awaiting_amount' CHECK (status IN ('in_progress', 'awaiting_amount', 'completed', 'cancelled')),
        agreed_total_satang INTEGER CHECK (agreed_total_satang IS NULL OR (typeof(agreed_total_satang) = 'integer' AND agreed_total_satang > 0)),
        final_total_satang INTEGER CHECK (final_total_satang IS NULL OR (typeof(final_total_satang) = 'integer' AND final_total_satang > 0))
      )`,
      `CREATE TABLE IF NOT EXISTS labor_job_progress (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL REFERENCES labor_jobs(id) ON DELETE CASCADE,
        progress_date TEXT NOT NULL,
        note TEXT NOT NULL,
        plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_job_progress_job_date ON labor_job_progress(labor_job_id, progress_date DESC)`,
    ],
  },
  {
    id: 11,
    name: 'labor_mvp_legacy_carry_forward_surfaces',
    statements: [
      `CREATE TABLE IF NOT EXISTS legacy_labor_import_batches (
        id TEXT PRIMARY KEY,
        imported_at TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_by_person_id TEXT REFERENCES people(id)
      )`,
      `CREATE TABLE IF NOT EXISTS legacy_labor_import_links (
        id TEXT PRIMARY KEY,
        import_batch_id TEXT NOT NULL REFERENCES legacy_labor_import_batches(id) ON DELETE CASCADE,
        legacy_labor_entry_id TEXT NOT NULL REFERENCES labor_entries(id),
        labor_payable_id TEXT NOT NULL REFERENCES labor_payables(id),
        source_work_date TEXT NOT NULL,
        source_due_satang INTEGER NOT NULL CHECK (typeof(source_due_satang) = 'integer' AND source_due_satang > 0),
        created_at TEXT NOT NULL,
        UNIQUE(legacy_labor_entry_id),
        UNIQUE(labor_payable_id)
      )`,
    ],
  },
  {
    id: 12,
    name: 'labor_settlement_group_ledger',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_settlement_groups (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL UNIQUE REFERENCES labor_jobs(id) ON DELETE CASCADE,
        original_due_satang INTEGER NOT NULL CHECK (typeof(original_due_satang) = 'integer' AND original_due_satang > 0),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
        collector_person_id TEXT REFERENCES people(id),
        collector_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_settlement_group_members (
        id TEXT PRIMARY KEY,
        settlement_group_id TEXT NOT NULL REFERENCES labor_settlement_groups(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL UNIQUE REFERENCES labor_job_participants(id) ON DELETE RESTRICT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_settlement_group_receipts (
        id TEXT PRIMARY KEY,
        settlement_group_id TEXT NOT NULL REFERENCES labor_settlement_groups(id) ON DELETE CASCADE,
        receipt_date TEXT NOT NULL,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        method TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'revised', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_settlement_groups_job ON labor_settlement_groups(labor_job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_settlement_group_members_group ON labor_settlement_group_members(settlement_group_id, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_settlement_group_receipts_group ON labor_settlement_group_receipts(settlement_group_id, receipt_date DESC, created_at DESC)`,
    ],
  },
  {
    id: 13,
    name: 'labor_work_basis_and_settlement_route_snapshots',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_work_basis_snapshots (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL REFERENCES labor_jobs(id) ON DELETE CASCADE,
        settlement_route TEXT NOT NULL CHECK (settlement_route IN ('individual', 'group')),
        basis_kind TEXT NOT NULL CHECK (basis_kind IN ('daily', 'piece', 'contract')),
        stage TEXT NOT NULL CHECK (stage IN ('recorded', 'started', 'progress', 'completed')),
        person_id TEXT REFERENCES people(id),
        rate_satang INTEGER CHECK (rate_satang IS NULL OR (typeof(rate_satang) = 'integer' AND rate_satang > 0)),
        quantity_milli INTEGER CHECK (quantity_milli IS NULL OR (typeof(quantity_milli) = 'integer' AND quantity_milli > 0)),
        unit_label TEXT NOT NULL DEFAULT '',
        total_satang INTEGER CHECK (total_satang IS NULL OR (typeof(total_satang) = 'integer' AND total_satang > 0)),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_work_basis_job ON labor_work_basis_snapshots(labor_job_id, created_at ASC, id ASC)`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_work_basis_snapshot_update
        BEFORE UPDATE ON labor_work_basis_snapshots
        BEGIN SELECT RAISE(ABORT, 'labor work-basis snapshots are immutable'); END`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_work_basis_snapshot_delete
        BEFORE DELETE ON labor_work_basis_snapshots
        BEGIN SELECT RAISE(ABORT, 'labor work-basis snapshots are immutable'); END`,
    ],
  },
  {
    id: 14,
    name: 'labor_hourly_work_basis_duration',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_hourly_work_basis_snapshots (
        id TEXT PRIMARY KEY,
        labor_job_id TEXT NOT NULL REFERENCES labor_jobs(id) ON DELETE CASCADE,
        settlement_route TEXT NOT NULL CHECK (settlement_route IN ('individual', 'group')),
        stage TEXT NOT NULL CHECK (stage IN ('recorded', 'started', 'progress', 'completed')),
        person_id TEXT REFERENCES people(id),
        rate_satang INTEGER NOT NULL CHECK (typeof(rate_satang) = 'integer' AND rate_satang > 0),
        duration_minutes INTEGER NOT NULL CHECK (typeof(duration_minutes) = 'integer' AND duration_minutes > 0),
        unit_label TEXT NOT NULL DEFAULT 'ชั่วโมง',
        total_satang INTEGER NOT NULL CHECK (typeof(total_satang) = 'integer' AND total_satang > 0),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_hourly_work_basis_job ON labor_hourly_work_basis_snapshots(labor_job_id, created_at ASC, id ASC)`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_hourly_work_basis_snapshot_update
        BEFORE UPDATE ON labor_hourly_work_basis_snapshots
        BEGIN SELECT RAISE(ABORT, 'labor hourly work-basis snapshots are immutable'); END`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_hourly_work_basis_snapshot_delete
        BEFORE DELETE ON labor_hourly_work_basis_snapshots
        BEGIN SELECT RAISE(ABORT, 'labor hourly work-basis snapshots are immutable'); END`,
    ],
  },
];
