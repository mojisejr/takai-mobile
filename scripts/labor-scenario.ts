import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import type { SqlExecutor } from '../src/data/migrations';
import { runMigrations } from '../src/data/migrations';
import { TAKAI_MIGRATIONS } from '../src/data/schema';
import {
  addLaborContractProgress,
  applyLaborAdvanceDeduction,
  completeLaborContractWork,
  createGroupPieceWork,
  createLaborContract,
  createLaborSettlementGroup,
  createLaborWorker,
  createLaborWorkerAdvance,
  createNormalWork,
  getLaborMvpReadModel,
  listLaborPayables,
  listLaborSettlementGroups,
  postLaborPayment,
  postLaborSettlementGroupReceipt,
} from '../src/features/labor-mvp';
import type { LaborMvpReadModel, LaborTimelineEvent } from '../src/features/labor-mvp';

const FIXED_CLOCK = '2026-08-02T00:00:00.000Z';
const DEFAULT_REPORT_PATH = join(tmpdir(), 'takai-labor-scenario-report.json');

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

type ScenarioName = 'su-daily-paid' | 'group-piece-paid' | 'group-contract-paid' | 'chon-half-day' | 'chon-early-payment' | 'kai-advance-recovery';
type ScenarioGroup = 'individual' | 'group' | 'advance-deduction' | 'all';
type TraceEntry = { step: number; command: string; result: string };
type TimelineSnapshot = Omit<LaborTimelineEvent, 'id'>;
type ScenarioReport = {
  scenario: ScenarioName;
  commandTrace: TraceEntry[];
  ledgerTotals: Record<string, number>;
  timelineSnapshots: TimelineSnapshot[];
  assertions: string[];
};
type Report = {
  version: 1;
  generatedAt: typeof FIXED_CLOCK;
  command: string[];
  database: { fresh: true; migrationIds: number[]; reopenVerified: true; legacyImportRowsUntouched: true; retainedDatabase: boolean };
  schema11Upgrade: { appliedMigrationIds: number[]; reopenVerified: true };
  scenarios: ScenarioReport[];
};

class SerializedCommands {
  private queue: Promise<void> = Promise.resolve();
  private step = 0;
  readonly trace: TraceEntry[] = [];

  run<T>(command: string, operation: () => Promise<T>): Promise<T> {
    const scheduled = this.queue.then(async () => {
      try {
        const result = await operation();
        this.trace.push({ step: ++this.step, command, result: 'ok' });
        return result;
      } catch (error) {
        this.trace.push({ step: ++this.step, command, result: `rejected: ${error instanceof Error ? error.message : String(error)}` });
        throw error;
      }
    });
    this.queue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }
}

const fixed = (offset: number): string => new Date(Date.UTC(2026, 0, 1 + offset)).toISOString();
const baht = (amount: number): number => amount * 100;

const timelineFor = (read: LaborMvpReadModel, jobIds: string[], eventEntityIds: string[] = [], personIds: string[] = []): TimelineSnapshot[] => read.timeline
  .filter((event) =>
    (event.laborJobId !== null && jobIds.includes(event.laborJobId))
    || eventEntityIds.includes(event.entityId)
    || (event.personId !== null && personIds.includes(event.personId)),
  )
  .map(({ id: _generatedTimelineId, ...snapshot }) => snapshot)
  .sort((left, right) => JSON.stringify([left.occurredAt, left.entityType, left.entityId, left.action]).localeCompare(JSON.stringify([right.occurredAt, right.entityType, right.entityId, right.action])));

const createPeople = async (commands: SerializedCommands, db: NodeSqliteExecutor): Promise<{ su: string; phuang: string; chon: string; kai: string }> => ({
  su: await commands.run('createLaborWorker(su)', () => createLaborWorker(db, { id: 'worker-su', displayName: 'พี่สุ' }, fixed(0))),
  phuang: await commands.run('createLaborWorker(phuang)', () => createLaborWorker(db, { id: 'worker-phuang', displayName: 'พี่พวง' }, fixed(1))),
  chon: await commands.run('createLaborWorker(chon)', () => createLaborWorker(db, { id: 'worker-chon', displayName: 'น้าชล' }, fixed(2))),
  kai: await commands.run('createLaborWorker(kai)', () => createLaborWorker(db, { id: 'worker-kai', displayName: 'น้าไก่' }, fixed(3))),
});

const suDaily = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const payables: string[] = [];
  for (const day of [3, 4, 5]) {
    const work = await commands.run(`createNormalWork(su-day-${day})`, () => createNormalWork(db, {
      id: `su-day-${day}`, title: 'งานรายวัน', workDate: `2026-01-0${day}`,
      participants: [{ personId: people.su, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }],
    }, fixed(day)));
    payables.push(work.payableIds[0]!);
  }
  await commands.run('postLaborPayment(su-full)', () => postLaborPayment(db, {
    id: 'su-full-payment', personId: people.su, paymentDate: '2026-01-05', method: 'cash',
    allocations: payables.map((payableId) => ({ payableId, amountSatang: baht(350) })),
  }, fixed(6)));
  const read = await getLaborMvpReadModel(db);
  const account = read.people.find((person) => person.id === people.su)!;
  assert.deepEqual([account.grossEarnedSatang, account.cashPaidSatang, account.wageRemainingSatang], [baht(1050), baht(1050), 0]);
  return { scenario: 'su-daily-paid', commandTrace: commands.trace, ledgerTotals: { grossEarnedSatang: account.grossEarnedSatang, cashPaidSatang: account.cashPaidSatang, wageRemainingSatang: account.wageRemainingSatang }, timelineSnapshots: timelineFor(read, ['su-day-3', 'su-day-4', 'su-day-5'], ['su-full-payment']), assertions: ['three full-day wages reconcile to one full payment'] };
};

const groupPiece = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const work = await commands.run('createGroupPieceWork(4125-bags)', () => createGroupPieceWork(db, {
    id: 'group-piece-4125', settlementGroupId: 'group-piece-4125-settlement', title: 'กรอกถุงเพาะชำ', workDate: '2026-01-15',
    memberPersonIds: [people.su, people.phuang], quantityMilli: 4_125_000, rateSatang: baht(1), unitLabel: 'ถุง', collectorPersonId: people.su,
  }, fixed(7)));
  await commands.run('postLaborSettlementGroupReceipt(group-piece-full)', () => postLaborSettlementGroupReceipt(db, {
    id: 'group-piece-full-receipt', settlementGroupId: work.settlementGroupId, receiptDate: '2026-01-15', amountSatang: baht(4125), method: 'cash',
  }, fixed(8)));
  const read = await getLaborMvpReadModel(db);
  const group = (await listLaborSettlementGroups(db, work.jobId))[0]!;
  assert.deepEqual([group.originalDueSatang, group.paidSatang, group.remainingSatang, group.memberPersonIds], [baht(4125), baht(4125), 0, [people.su, people.phuang]]);
  assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === work.jobId).length, 0, 'group quantity must not create person claims');
  return { scenario: 'group-piece-paid', commandTrace: commands.trace, ledgerTotals: { originalDueSatang: group.originalDueSatang, paidSatang: group.paidSatang, remainingSatang: group.remainingSatang, personPayableCount: 0 }, timelineSnapshots: timelineFor(read, [work.jobId]), assertions: ['4,125 bags are recorded exactly once', 'one group receipt has no personal shares or payable'] };
};

const groupContract = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const jobId = await commands.run('createLaborContract(group-started)', () => createLaborContract(db, {
    id: 'group-contract-4125', title: 'กรอกถุงเพาะชำ', workDate: '2026-01-04', startsOn: '2026-01-04', settlementRoute: 'group', participants: [{ personId: people.su }, { personId: people.phuang }],
  }, fixed(9)));
  await commands.run('addLaborContractProgress(output-unknown)', () => addLaborContractProgress(db, jobId, { id: 'group-contract-progress', progressDate: '2026-01-10', note: 'เริ่มงานแล้ว ยังไม่สรุปจำนวน' }, fixed(10)));
  await commands.run('completeLaborContractWork(final-output)', () => completeLaborContractWork(db, jobId, {
    id: 'group-contract-complete', completedOn: '2026-01-15', finalTotalSatang: baht(4125), rateSatang: baht(1), quantityMilli: 4_125_000, unitLabel: 'ถุง', note: 'สรุปตอนเก็บเงิน',
  }, fixed(11)));
  const settlementGroupId = await commands.run('createLaborSettlementGroup(completed-group)', () => createLaborSettlementGroup(db, {
    id: 'group-contract-4125-settlement', laborJobId: jobId, originalDueSatang: baht(4125), memberPersonIds: [people.su, people.phuang], collectorPersonId: people.su,
  }, fixed(12)));
  await commands.run('postLaborSettlementGroupReceipt(contract-full)', () => postLaborSettlementGroupReceipt(db, {
    id: 'group-contract-full-receipt', settlementGroupId, receiptDate: '2026-01-15', amountSatang: baht(4125), method: 'cash',
  }, fixed(13)));
  const read = await getLaborMvpReadModel(db);
  const group = (await listLaborSettlementGroups(db, jobId))[0]!;
  assert.equal((await listLaborPayables(db)).filter((payable) => payable.jobId === jobId).length, 0);
  assert.deepEqual([group.originalDueSatang, group.paidSatang, group.remainingSatang], [baht(4125), baht(4125), 0]);
  return { scenario: 'group-contract-paid', commandTrace: commands.trace, ledgerTotals: { originalDueSatang: group.originalDueSatang, paidSatang: group.paidSatang, remainingSatang: group.remainingSatang, personPayableCount: 0 }, timelineSnapshots: timelineFor(read, [jobId]), assertions: ['contract starts without output', 'final aggregate output and one group receipt reconcile without person shares'] };
};

const chonHalfDay = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const fullOne = await commands.run('createNormalWork(chon-full-day-1)', () => createNormalWork(db, { id: 'chon-full-day-1', title: 'งานรายวันเต็มวัน', workDate: '2026-01-06', participants: [{ personId: people.chon, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }] }, fixed(14)));
  const fullTwo = await commands.run('createNormalWork(chon-full-day-2)', () => createNormalWork(db, { id: 'chon-full-day-2', title: 'งานรายวันเต็มวัน', workDate: '2026-01-07', participants: [{ personId: people.chon, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }] }, fixed(15)));
  const half = await commands.run('createNormalWork(chon-half-day)', () => createNormalWork(db, { id: 'chon-half-day', title: 'งานรายวันครึ่งวัน', workDate: '2026-01-08', participants: [{ personId: people.chon, payType: 'daily', dueSatang: baht(175), rateSatang: baht(350), quantityMilli: 500, unitLabel: 'วัน' }] }, fixed(16)));
  await commands.run('postLaborPayment(chon-2.5-days)', () => postLaborPayment(db, { id: 'chon-2.5-payment', personId: people.chon, paymentDate: '2026-01-08', allocations: [{ payableId: fullOne.payableIds[0]!, amountSatang: baht(350) }, { payableId: fullTwo.payableIds[0]!, amountSatang: baht(350) }, { payableId: half.payableIds[0]!, amountSatang: baht(175) }] }, fixed(17)));
  const read = await getLaborMvpReadModel(db);
  const account = read.people.find((person) => person.id === people.chon)!;
  assert.deepEqual([account.grossEarnedSatang, account.cashPaidSatang, account.wageRemainingSatang], [baht(875), baht(875), 0]);
  return { scenario: 'chon-half-day', commandTrace: commands.trace, ledgerTotals: { grossEarnedSatang: account.grossEarnedSatang, cashPaidSatang: account.cashPaidSatang, wageRemainingSatang: account.wageRemainingSatang }, timelineSnapshots: timelineFor(read, ['chon-full-day-1', 'chon-full-day-2', 'chon-half-day'], ['chon-2.5-payment']), assertions: ['2.5 days is represented as two full days plus one half day under the locked rule'] };
};

const chonEarlyPayment = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const payables: string[] = [];
  for (const day of [8, 9, 10, 11, 12, 13, 14]) {
    const work = await commands.run(`createNormalWork(chon-seven-day-${day})`, () => createNormalWork(db, { id: `chon-seven-day-${day}`, title: 'งานรายวัน', workDate: `2026-01-${String(day).padStart(2, '0')}`, participants: [{ personId: people.chon, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }] }, fixed(17 + day)));
    payables.push(work.payableIds[0]!);
    if (day === 10) {
      await commands.run('postLaborPayment(chon-early-500)', () => postLaborPayment(db, { id: 'chon-early-500', personId: people.chon, paymentDate: '2026-01-10', method: 'cash', allocations: [{ payableId: payables[0]!, amountSatang: baht(350) }, { payableId: payables[1]!, amountSatang: baht(150) }] }, fixed(28)));
    }
  }
  await commands.run('postLaborPayment(chon-final)', () => postLaborPayment(db, { id: 'chon-final-payment', personId: people.chon, paymentDate: '2026-01-14', method: 'cash', allocations: [{ payableId: payables[1]!, amountSatang: baht(200) }, ...payables.slice(2).map((payableId) => ({ payableId, amountSatang: baht(350) }))] }, fixed(32)));
  await assert.rejects(commands.run('postLaborPayment(chon-overpayment-regression)', () => postLaborPayment(db, { id: 'chon-overpayment', personId: people.chon, paymentDate: '2026-01-14', allocations: [{ payableId: payables[0]!, amountSatang: 1 }] }, fixed(33))), /cannot exceed payable remaining balance|payable is unavailable/);
  const read = await getLaborMvpReadModel(db);
  const scenarioPayables = (await listLaborPayables(db, people.chon)).filter((payable) => payables.includes(payable.id));
  const grossEarnedSatang = scenarioPayables.reduce((sum, payable) => sum + payable.dueSatang, 0);
  const cashPaidSatang = scenarioPayables.reduce((sum, payable) => sum + payable.paidSatang, 0);
  const wageRemainingSatang = scenarioPayables.reduce((sum, payable) => sum + payable.remainingSatang, 0);
  assert.deepEqual([grossEarnedSatang, cashPaidSatang, wageRemainingSatang], [baht(2450), baht(2450), 0]);
  return { scenario: 'chon-early-payment', commandTrace: commands.trace, ledgerTotals: { grossEarnedSatang, cashPaidSatang, wageRemainingSatang, earlyCashPaidSatang: baht(500), finalCashPaidSatang: baht(1950) }, timelineSnapshots: timelineFor(read, payables.map((_, index) => `chon-seven-day-${8 + index}`), ['chon-early-500', 'chon-final-payment']), assertions: ['early 500-baht payment and final payment reconcile exactly', 'serialized overpayment regression is rejected without nested transaction failure'] };
};

const kaiAdvanceRecovery = async (db: NodeSqliteExecutor, people: Awaited<ReturnType<typeof createPeople>>): Promise<ScenarioReport> => {
  const commands = new SerializedCommands();
  const advanceId = await commands.run('createLaborWorkerAdvance(kai-1000)', () => createLaborWorkerAdvance(db, { id: 'kai-advance-1000', personId: people.kai, advanceDate: '2026-01-03', amountSatang: baht(1000), method: 'cash' }, fixed(28)));
  const payableIds: string[] = [];
  for (const day of [3, 4, 5]) {
    const work = await commands.run(`createNormalWork(kai-day-${day})`, () => createNormalWork(db, { id: `kai-day-${day}`, title: 'งานรายวัน', workDate: `2026-01-0${day}`, participants: [{ personId: people.kai, payType: 'daily', dueSatang: baht(350), rateSatang: baht(350), quantityMilli: 1000, unitLabel: 'วัน' }] }, fixed(29 + day)));
    const payableId = work.payableIds[0]!;
    payableIds.push(payableId);
    await commands.run(`applyLaborAdvanceDeduction(kai-day-${day})`, () => applyLaborAdvanceDeduction(db, { id: `kai-recovery-${day}`, advanceId, payableId, recoveryDate: `2026-01-0${day}`, amountSatang: baht(50), note: 'หักคืนตามตกลง' }, fixed(33 + day)));
    await commands.run(`postLaborPayment(kai-day-${day})`, () => postLaborPayment(db, { id: `kai-cash-${day}`, personId: people.kai, paymentDate: `2026-01-0${day}`, allocations: [{ payableId, amountSatang: baht(300) }] }, fixed(37 + day)));
  }
  const read = await getLaborMvpReadModel(db);
  const account = read.people.find((person) => person.id === people.kai)!;
  assert.deepEqual([account.grossEarnedSatang, account.cashPaidSatang, account.wageRemainingSatang, account.advanceIssuedSatang, account.advanceRecoveredSatang, account.advanceRemainingSatang], [baht(1050), baht(900), 0, baht(1000), baht(150), baht(850)]);
  return { scenario: 'kai-advance-recovery', commandTrace: commands.trace, ledgerTotals: { grossEarnedSatang: account.grossEarnedSatang, cashPaidSatang: account.cashPaidSatang, wageRemainingSatang: account.wageRemainingSatang, advanceIssuedSatang: account.advanceIssuedSatang, advanceRecoveredSatang: account.advanceRecoveredSatang, advanceRemainingSatang: account.advanceRemainingSatang }, timelineSnapshots: timelineFor(read, ['kai-day-3', 'kai-day-4', 'kai-day-5'], ['kai-cash-3', 'kai-cash-4', 'kai-cash-5'], [people.kai]), assertions: ['each 350-baht wage settles with 300 cash plus 50 advance recovery', 'advance remains person-scoped at 850 baht'] };
};

const applyThroughEleven = async (db: NodeSqliteExecutor): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  for (const migration of TAKAI_MIGRATIONS.filter((item) => item.id <= 11)) {
    for (const statement of migration.statements) await db.execAsync(statement);
    await db.runAsync('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)', [migration.id, migration.name, FIXED_CLOCK]);
  }
};

const verifySchema11Upgrade = async (): Promise<Report['schema11Upgrade']> => {
  const directory = await mkdtemp(join(tmpdir(), 'takai-schema11-upgrade-'));
  const databasePath = join(directory, 'takai.db');
  let connection: DatabaseSync | null = null;
  let reopened: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    await applyThroughEleven(db);
    const appliedMigrationIds = await runMigrations(db);
    assert.deepEqual(appliedMigrationIds, [12, 13, 14, 15], 'schema-11 fixture must upgrade through current additive migrations');
    connection.close(); connection = null;
    reopened = new DatabaseSync(databasePath);
    assert.deepEqual(await runMigrations(new NodeSqliteExecutor(reopened)), [], 'reopened upgraded database must be migration-idempotent');
    return { appliedMigrationIds, reopenVerified: true };
  } finally {
    reopened?.close(); connection?.close(); await rm(directory, { recursive: true, force: true });
  }
};

const scenarioNamesFor = (group: ScenarioGroup): ScenarioName[] => {
  if (group === 'individual') return ['su-daily-paid', 'chon-half-day', 'chon-early-payment'];
  if (group === 'group') return ['group-piece-paid', 'group-contract-paid'];
  if (group === 'advance-deduction') return ['kai-advance-recovery'];
  return ['su-daily-paid', 'group-piece-paid', 'group-contract-paid', 'chon-half-day', 'chon-early-payment', 'kai-advance-recovery'];
};

const assertScenarioAmounts = (scenario: ScenarioReport): void => {
  for (const [label, amount] of Object.entries(scenario.ledgerTotals)) {
    assert.ok(Number.isSafeInteger(amount), `TAKAI ${scenario.scenario} ${label} must print an INTEGER satang amount`);
  }
};

const parseArguments = (arguments_: string[]): { mode: 'list' | 'run'; group: ScenarioGroup; outputPath: string; retainDatabasePath: string | null } => {
  const positionals: string[] = [];
  let outputPath = DEFAULT_REPORT_PATH;
  let retainDatabasePath: string | null = null;
  for (let index = 0; index < arguments_.length; index += 1) {
    const value = arguments_[index]!;
    if (value === '--output' || value === '--retain-db') {
      const path = arguments_[++index];
      if (!path || !isAbsolute(path)) throw new Error(`TAKAI ${value} requires an explicit absolute path`);
      if (value === '--output') outputPath = resolve(path); else retainDatabasePath = resolve(path);
    } else if (value.startsWith('--')) throw new Error(`TAKAI unknown option: ${value}`);
    else positionals.push(value);
  }
  if (positionals.length === 1 && positionals[0] === 'list') return { mode: 'list', group: 'all', outputPath, retainDatabasePath };
  if (positionals.length === 1 && positionals[0] === 'all') return { mode: 'run', group: 'all', outputPath, retainDatabasePath };
  if (positionals.length === 2 && positionals[0] === 'run' && ['individual', 'group', 'advance-deduction'].includes(positionals[1]!)) return { mode: 'run', group: positionals[1] as ScenarioGroup, outputPath, retainDatabasePath };
  throw new Error('Usage: tsx scripts/labor-scenario.ts list | all | run <individual|group|advance-deduction> [--output /absolute/report.json] [--retain-db /absolute/takai.db]');
};

const logicalCommandFor = (options: ReturnType<typeof parseArguments>): string[] => {
  if (options.mode === 'list') return ['list'];
  return options.group === 'all' ? ['all'] : ['run', options.group];
};

const main = async (): Promise<void> => {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === 'list') {
    console.log(JSON.stringify({ scenarios: scenarioNamesFor('all'), commands: ['list', 'all', 'run individual', 'run group', 'run advance-deduction'] }, null, 2));
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'takai-labor-scenario-'));
  const databasePath = join(directory, 'takai.db');
  let connection: DatabaseSync | null = null;
  let reopened: DatabaseSync | null = null;
  try {
    connection = new DatabaseSync(databasePath);
    const db = new NodeSqliteExecutor(connection);
    const migrationIds = await runMigrations(db);
    assert.deepEqual(migrationIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const peopleCommands = new SerializedCommands();
    const people = await createPeople(peopleCommands, db);
    const reports: ScenarioReport[] = [];
    for (const name of scenarioNamesFor(options.group)) {
      if (name === 'su-daily-paid') reports.push(await suDaily(db, people));
      if (name === 'group-piece-paid') reports.push(await groupPiece(db, people));
      if (name === 'group-contract-paid') reports.push(await groupContract(db, people));
      if (name === 'chon-half-day') reports.push(await chonHalfDay(db, people));
      if (name === 'chon-early-payment') reports.push(await chonEarlyPayment(db, people));
      if (name === 'kai-advance-recovery') reports.push(await kaiAdvanceRecovery(db, people));
    }
    reports.forEach(assertScenarioAmounts);
    const beforeReopen = await getLaborMvpReadModel(db);
    assert.deepEqual([beforeReopen.legacySources.length, beforeReopen.legacyBalances.length], [0, 0], 'scenario commands must leave legacy import surfaces untouched');
    connection.close(); connection = null;
    if (options.retainDatabasePath) {
      await mkdir(dirname(options.retainDatabasePath), { recursive: true });
      await copyFile(databasePath, options.retainDatabasePath);
    }
    reopened = new DatabaseSync(databasePath);
    assert.deepEqual(await getLaborMvpReadModel(new NodeSqliteExecutor(reopened)), beforeReopen, 'scenario database must preserve exact report data after reopen');
    const report: Report = { version: 1, generatedAt: FIXED_CLOCK, command: logicalCommandFor(options), database: { fresh: true, migrationIds, reopenVerified: true, legacyImportRowsUntouched: true, retainedDatabase: options.retainDatabasePath !== null }, schema11Upgrade: await verifySchema11Upgrade(), scenarios: reports };
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    console.error(`LABOR_SCENARIO_PASS: ${reports.length} deterministic scenario(s) verified; report: ${options.outputPath}`);
  } finally {
    reopened?.close(); connection?.close(); await rm(directory, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
