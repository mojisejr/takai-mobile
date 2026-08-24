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
  {
    id: 15,
    name: 'labor_worker_advances_and_recoveries',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_worker_advances (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES people(id),
        advance_date TEXT NOT NULL,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        method TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'revised', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_advance_deductions (
        id TEXT PRIMARY KEY,
        labor_worker_advance_id TEXT NOT NULL REFERENCES labor_worker_advances(id) ON DELETE RESTRICT,
        labor_payable_id TEXT NOT NULL REFERENCES labor_payables(id) ON DELETE RESTRICT,
        person_id TEXT NOT NULL REFERENCES people(id),
        recovery_date TEXT NOT NULL,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(labor_worker_advance_id, labor_payable_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_worker_advances_person_date
        ON labor_worker_advances(person_id, advance_date DESC, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_advance_deductions_advance
        ON labor_advance_deductions(labor_worker_advance_id, recovery_date ASC, created_at ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_advance_deductions_payable
        ON labor_advance_deductions(labor_payable_id)`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_advance_deduction_update
        BEFORE UPDATE ON labor_advance_deductions
        BEGIN SELECT RAISE(ABORT, 'labor advance deductions are immutable'); END`,
      `CREATE TRIGGER IF NOT EXISTS prevent_labor_advance_deduction_delete
        BEFORE DELETE ON labor_advance_deductions
        BEGIN SELECT RAISE(ABORT, 'labor advance deductions are immutable'); END`,
    ],
  },
  {
    id: 16,
    name: 'labor_payment_session_multi_recipient_ledger',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_payment_sessions (
        id TEXT PRIMARY KEY,
        payment_date TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        cash_paid_satang INTEGER NOT NULL CHECK (typeof(cash_paid_satang) = 'integer' AND cash_paid_satang >= 0),
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'revised', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payment_session_settlements (
        id TEXT PRIMARY KEY,
        payment_session_id TEXT NOT NULL REFERENCES labor_payment_sessions(id) ON DELETE CASCADE,
        recipient_type TEXT NOT NULL CHECK (recipient_type IN ('person', 'group')),
        person_id TEXT REFERENCES people(id),
        settlement_group_id TEXT REFERENCES labor_settlement_groups(id),
        wage_satang INTEGER NOT NULL CHECK (typeof(wage_satang) = 'integer' AND wage_satang >= 0),
        bonus_satang INTEGER NOT NULL DEFAULT 0 CHECK (typeof(bonus_satang) = 'integer' AND bonus_satang >= 0),
        advance_recovered_satang INTEGER NOT NULL DEFAULT 0 CHECK (typeof(advance_recovered_satang) = 'integer' AND advance_recovered_satang >= 0),
        cash_paid_satang INTEGER NOT NULL CHECK (typeof(cash_paid_satang) = 'integer' AND cash_paid_satang >= 0),
        CHECK (
          (recipient_type = 'person' AND person_id IS NOT NULL AND settlement_group_id IS NULL)
          OR (recipient_type = 'group' AND person_id IS NULL AND settlement_group_id IS NOT NULL)
        ),
        CHECK (cash_paid_satang = wage_satang + bonus_satang - advance_recovered_satang)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payment_session_wage_allocations (
        id TEXT PRIMARY KEY,
        settlement_id TEXT NOT NULL REFERENCES labor_payment_session_settlements(id) ON DELETE CASCADE,
        labor_payable_id TEXT NOT NULL REFERENCES labor_payables(id) ON DELETE RESTRICT,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        UNIQUE(settlement_id, labor_payable_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_payment_session_advance_recoveries (
        id TEXT PRIMARY KEY,
        settlement_id TEXT NOT NULL REFERENCES labor_payment_session_settlements(id) ON DELETE CASCADE,
        labor_worker_advance_id TEXT NOT NULL REFERENCES labor_worker_advances(id) ON DELETE RESTRICT,
        labor_payable_id TEXT NOT NULL REFERENCES labor_payables(id) ON DELETE RESTRICT,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        UNIQUE(settlement_id, labor_worker_advance_id, labor_payable_id)
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_payment_session_person_recipient
        ON labor_payment_session_settlements(payment_session_id, person_id) WHERE person_id IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_payment_session_group_recipient
        ON labor_payment_session_settlements(payment_session_id, settlement_group_id) WHERE settlement_group_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_sessions_date
        ON labor_payment_sessions(payment_date DESC, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_session_settlements_session
        ON labor_payment_session_settlements(payment_session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_session_wage_payable
        ON labor_payment_session_wage_allocations(labor_payable_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_session_recovery_advance
        ON labor_payment_session_advance_recoveries(labor_worker_advance_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_payment_session_recovery_payable
        ON labor_payment_session_advance_recoveries(labor_payable_id)`,
    ],
  },
  {
    id: 17,
    name: 'labor_compensation_unit_v2_foundation',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_v2_work_tasks (
        id TEXT PRIMARY KEY,
        work_date TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_task_assignments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES labor_v2_work_tasks(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        sort_order INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        UNIQUE(task_id, person_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_daily_units (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES people(id),
        work_date TEXT NOT NULL,
        rate_satang INTEGER NOT NULL CHECK (typeof(rate_satang) = 'integer' AND rate_satang > 0),
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli IN (500, 1000)),
        created_at TEXT NOT NULL,
        UNIQUE(person_id, work_date)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_daily_unit_task_links (
        daily_unit_id TEXT NOT NULL REFERENCES labor_v2_daily_units(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES labor_v2_work_tasks(id) ON DELETE RESTRICT,
        PRIMARY KEY(daily_unit_id, task_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_hourly_shifts (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES people(id),
        work_date TEXT NOT NULL,
        rate_satang INTEGER NOT NULL CHECK (typeof(rate_satang) = 'integer' AND rate_satang > 0),
        shift_key TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(person_id, work_date, rate_satang, shift_key)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_hourly_time_entries (
        id TEXT PRIMARY KEY,
        hourly_shift_id TEXT NOT NULL REFERENCES labor_v2_hourly_shifts(id) ON DELETE CASCADE,
        task_assignment_id TEXT NOT NULL REFERENCES labor_v2_task_assignments(id) ON DELETE RESTRICT,
        duration_minutes INTEGER NOT NULL CHECK (typeof(duration_minutes) = 'integer' AND duration_minutes > 0),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_contract_batches (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        deadline_on TEXT,
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('open', 'finalized', 'cancelled')),
        finalization_basis TEXT CHECK (finalization_basis IS NULL OR finalization_basis IN ('quantity_rate', 'lump_total')),
        quantity_milli INTEGER CHECK (quantity_milli IS NULL OR (typeof(quantity_milli) = 'integer' AND quantity_milli > 0)),
        rate_satang INTEGER CHECK (rate_satang IS NULL OR (typeof(rate_satang) = 'integer' AND rate_satang > 0)),
        final_total_satang INTEGER CHECK (final_total_satang IS NULL OR (typeof(final_total_satang) = 'integer' AND final_total_satang > 0)),
        finalized_at TEXT,
        created_at TEXT NOT NULL,
        CHECK ((status = 'open' AND finalization_basis IS NULL AND final_total_satang IS NULL) OR (status = 'finalized' AND finalization_basis IS NOT NULL AND final_total_satang IS NOT NULL) OR status = 'cancelled')
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_contract_batch_members (
        id TEXT PRIMARY KEY,
        contract_batch_id TEXT NOT NULL REFERENCES labor_v2_contract_batches(id) ON DELETE CASCADE,
        person_id TEXT NOT NULL REFERENCES people(id),
        sort_order INTEGER NOT NULL DEFAULT 0,
        UNIQUE(contract_batch_id, person_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_contract_batch_task_links (
        contract_batch_id TEXT NOT NULL REFERENCES labor_v2_contract_batches(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES labor_v2_work_tasks(id) ON DELETE RESTRICT,
        PRIMARY KEY(contract_batch_id, task_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_contract_progress (
        id TEXT PRIMARY KEY,
        contract_batch_id TEXT NOT NULL REFERENCES labor_v2_contract_batches(id) ON DELETE CASCADE,
        progress_date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        quantity_milli INTEGER CHECK (quantity_milli IS NULL OR (typeof(quantity_milli) = 'integer' AND quantity_milli > 0)),
        unit_label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_obligations (
        id TEXT PRIMARY KEY,
        source_kind TEXT NOT NULL CHECK (source_kind IN ('daily', 'hourly', 'contract')),
        source_unit_id TEXT NOT NULL,
        recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('person', 'group')),
        person_id TEXT REFERENCES people(id),
        due_satang INTEGER NOT NULL CHECK (typeof(due_satang) = 'integer' AND due_satang > 0),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
        created_at TEXT NOT NULL,
        CHECK ((recipient_kind = 'person' AND person_id IS NOT NULL) OR (recipient_kind = 'group' AND person_id IS NULL)),
        UNIQUE(source_kind, source_unit_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_payment_sessions (
        id TEXT PRIMARY KEY,
        payment_date TEXT NOT NULL,
        cash_paid_satang INTEGER NOT NULL CHECK (typeof(cash_paid_satang) = 'integer' AND cash_paid_satang >= 0),
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'revised', 'cancelled')),
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_payment_allocations (
        id TEXT PRIMARY KEY,
        payment_session_id TEXT NOT NULL REFERENCES labor_v2_payment_sessions(id) ON DELETE CASCADE,
        obligation_id TEXT NOT NULL REFERENCES labor_v2_obligations(id) ON DELETE RESTRICT,
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        UNIQUE(payment_session_id, obligation_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_payment_revisions (
        id TEXT PRIMARY KEY,
        payment_session_id TEXT NOT NULL REFERENCES labor_v2_payment_sessions(id) ON DELETE RESTRICT,
        reason TEXT NOT NULL,
        before_json TEXT NOT NULL,
        after_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_event_history (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        before_json TEXT,
        after_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_tasks_date ON labor_v2_work_tasks(work_date DESC, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_assignments_person ON labor_v2_task_assignments(person_id, task_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_daily_person_date ON labor_v2_daily_units(person_id, work_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_hourly_person_date ON labor_v2_hourly_shifts(person_id, work_date DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_contract_status ON labor_v2_contract_batches(status, starts_on DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_obligations_open ON labor_v2_obligations(status, recipient_kind, person_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_payments_date ON labor_v2_payment_sessions(payment_date DESC, created_at DESC)`,
    ],
  },
  {
    id: 18,
    name: 'labor_compensation_unit_v2_payment_recovery_foundation',
    statements: [
      `ALTER TABLE labor_v2_payment_sessions ADD COLUMN method TEXT NOT NULL DEFAULT ''`,
      `CREATE TABLE IF NOT EXISTS labor_v2_payment_recipient_settlements (
        id TEXT PRIMARY KEY,
        payment_session_id TEXT NOT NULL REFERENCES labor_v2_payment_sessions(id) ON DELETE CASCADE,
        obligation_id TEXT NOT NULL REFERENCES labor_v2_obligations(id) ON DELETE RESTRICT,
        recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('person', 'group')),
        person_id TEXT REFERENCES people(id),
        wage_satang INTEGER NOT NULL CHECK (typeof(wage_satang) = 'integer' AND wage_satang >= 0),
        bonus_satang INTEGER NOT NULL DEFAULT 0 CHECK (typeof(bonus_satang) = 'integer' AND bonus_satang >= 0),
        advance_recovered_satang INTEGER NOT NULL DEFAULT 0 CHECK (typeof(advance_recovered_satang) = 'integer' AND advance_recovered_satang >= 0),
        cash_paid_satang INTEGER NOT NULL CHECK (typeof(cash_paid_satang) = 'integer' AND cash_paid_satang >= 0),
        CHECK ((recipient_kind = 'person' AND person_id IS NOT NULL) OR (recipient_kind = 'group' AND person_id IS NULL)),
        CHECK (cash_paid_satang = wage_satang + bonus_satang - advance_recovered_satang),
        UNIQUE(payment_session_id, obligation_id)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_payment_advance_recoveries (
        id TEXT PRIMARY KEY,
        recipient_settlement_id TEXT NOT NULL REFERENCES labor_v2_payment_recipient_settlements(id) ON DELETE CASCADE,
        labor_worker_advance_id TEXT NOT NULL REFERENCES labor_worker_advances(id) ON DELETE RESTRICT,
        obligation_id TEXT NOT NULL REFERENCES labor_v2_obligations(id) ON DELETE RESTRICT,
        person_id TEXT NOT NULL REFERENCES people(id),
        amount_satang INTEGER NOT NULL CHECK (typeof(amount_satang) = 'integer' AND amount_satang > 0),
        UNIQUE(recipient_settlement_id, labor_worker_advance_id, obligation_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_payment_settlements_session
        ON labor_v2_payment_recipient_settlements(payment_session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_payment_settlements_obligation
        ON labor_v2_payment_recipient_settlements(obligation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_payment_recoveries_advance
        ON labor_v2_payment_advance_recoveries(labor_worker_advance_id)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_payment_recoveries_obligation
        ON labor_v2_payment_advance_recoveries(obligation_id)`,
    ],
  },
  {
    id: 19,
    name: 'labor_v2_plot_context_and_tree_reference_ledger',
    statements: [
      `CREATE TABLE IF NOT EXISTS labor_v2_plots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        crop_label TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        archived_at TEXT,
        current_revision INTEGER NOT NULL DEFAULT 1 CHECK (current_revision > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((latitude IS NULL AND longitude IS NULL) OR (typeof(latitude) IN ('integer', 'real') AND typeof(longitude) IN ('integer', 'real') AND latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180))
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_plot_revisions (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL REFERENCES labor_v2_plots(id) ON DELETE RESTRICT,
        revision INTEGER NOT NULL CHECK (revision > 0),
        action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'restored')),
        reason TEXT,
        before_json TEXT,
        after_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(plot_id, revision)
      )`,
      `CREATE TRIGGER IF NOT EXISTS labor_v2_plot_revisions_immutable_update BEFORE UPDATE ON labor_v2_plot_revisions BEGIN SELECT RAISE(ABORT, 'TAKAI V2 plot revisions are immutable'); END`,
      `CREATE TRIGGER IF NOT EXISTS labor_v2_plot_revisions_immutable_delete BEFORE DELETE ON labor_v2_plot_revisions BEGIN SELECT RAISE(ABORT, 'TAKAI V2 plot revisions are immutable'); END`,
      `CREATE TABLE IF NOT EXISTS labor_v2_task_plot_targets (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES labor_v2_work_tasks(id) ON DELETE CASCADE,
        plot_id TEXT NOT NULL REFERENCES labor_v2_plots(id) ON DELETE RESTRICT,
        plot_name_snapshot TEXT NOT NULL CHECK (length(trim(plot_name_snapshot)) > 0),
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        UNIQUE(task_id, plot_id),
        UNIQUE(task_id, sort_order)
      )`,
      `CREATE TABLE IF NOT EXISTS labor_v2_task_plot_tree_refs (
        id TEXT PRIMARY KEY,
        task_plot_target_id TEXT NOT NULL REFERENCES labor_v2_task_plot_targets(id) ON DELETE CASCADE,
        tree_label TEXT NOT NULL CHECK (length(trim(tree_label)) > 0),
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        UNIQUE(task_plot_target_id, tree_label),
        UNIQUE(task_plot_target_id, sort_order)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_plots_active_name ON labor_v2_plots(archived_at, name COLLATE NOCASE)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_plot_revisions_plot ON labor_v2_plot_revisions(plot_id, revision DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_task_plot_targets_task ON labor_v2_task_plot_targets(task_id, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_labor_v2_task_plot_tree_refs_target ON labor_v2_task_plot_tree_refs(task_plot_target_id, sort_order)`,
    ],
  },
];
