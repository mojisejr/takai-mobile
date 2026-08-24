import type { LaborV2CompensationPlan, LaborV2CompensationTaskFact, LaborV2ContractBatchIntent, LaborV2DailyIntent, LaborV2HourlyShiftIntent, LaborV2HourlyTimeIntent, LaborV2ObligationIntent } from './types';

const assertDate = (value: string, label: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`TAKAI V2 ${label} must be YYYY-MM-DD`);
};

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`TAKAI V2 ${label} must be a positive whole integer`);
};

const dueFromQuantityRate = (quantityMilli: number, rateSatang: number, label: string): number => {
  assertPositiveInteger(quantityMilli, `${label} quantity`);
  assertPositiveInteger(rateSatang, `${label} rate`);
  const total = quantityMilli * rateSatang;
  if (!Number.isSafeInteger(total) || total % 1000 !== 0) throw new Error(`TAKAI V2 ${label} must resolve to whole satang`);
  return total / 1000;
};

const dueFromMinutesRate = (durationMinutes: number, rateSatang: number, label: string): number => {
  assertPositiveInteger(durationMinutes, `${label} duration`);
  assertPositiveInteger(rateSatang, `${label} rate`);
  const total = durationMinutes * rateSatang;
  if (!Number.isSafeInteger(total) || total % 60 !== 0) throw new Error(`TAKAI V2 ${label} must resolve to whole satang`);
  return total / 60;
};

const unique = (values: string[], label: string): void => {
  if (!values.length || values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`TAKAI V2 ${label} must name distinct values`);
};

/**
 * Pure V2 planning boundary. It calculates intent only: no SQL, no v1 payable,
 * and no payment write can be reached through this function.
 */
export const planLaborCompensationV2 = (input: {
  tasks: LaborV2CompensationTaskFact[];
  daily: LaborV2DailyIntent[];
  hourly: LaborV2HourlyTimeIntent[];
  contracts: LaborV2ContractBatchIntent[];
}): LaborV2CompensationPlan => {
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  if (taskById.size !== input.tasks.length) throw new Error('TAKAI V2 work task IDs must be distinct');
  for (const task of input.tasks) {
    if (!task.id.trim() || !task.title.trim()) throw new Error('TAKAI V2 work task requires an ID and title');
    assertDate(task.workDate, 'task date');
    unique(task.assigneePersonIds, 'task assignees');
  }

  const dailyByPersonDate = new Map<string, LaborV2DailyIntent & { dueSatang: number }>();
  for (const daily of input.daily) {
    assertDate(daily.workDate, 'daily date');
    if (!daily.personId.trim() || (daily.quantityMilli !== 500 && daily.quantityMilli !== 1000)) throw new Error('TAKAI V2 daily unit must be half day or full day only');
    unique(daily.taskIds, 'daily linked tasks');
    for (const taskId of daily.taskIds) {
      const task = taskById.get(taskId);
      if (!task || task.workDate !== daily.workDate || !task.assigneePersonIds.includes(daily.personId)) throw new Error('TAKAI V2 daily unit must link assigned tasks from the same date');
    }
    const key = `${daily.personId}|${daily.workDate}`;
    const current = dailyByPersonDate.get(key);
    if (current && current.rateSatang !== daily.rateSatang) throw new Error('TAKAI V2 daily unit cannot mix rates for one person/date');
    const quantityMilli = (current?.quantityMilli ?? 0) + daily.quantityMilli;
    if (quantityMilli > 1000) throw new Error('TAKAI V2 daily units cannot exceed one full day per person/date');
    const merged = { ...daily, id: current?.id ?? daily.id, quantityMilli: quantityMilli as 500 | 1000, taskIds: [...(current?.taskIds ?? []), ...daily.taskIds] };
    dailyByPersonDate.set(key, { ...merged, dueSatang: dueFromQuantityRate(merged.quantityMilli, merged.rateSatang, 'daily unit') });
  }

  const shiftBuckets = new Map<string, LaborV2HourlyShiftIntent>();
  for (const time of input.hourly) {
    assertDate(time.workDate, 'hourly date');
    if (!time.id.trim() || !time.personId.trim()) throw new Error('TAKAI V2 hourly time requires an ID and worker');
    const task = taskById.get(time.taskId);
    if (!task || task.workDate !== time.workDate || !task.assigneePersonIds.includes(time.personId)) throw new Error('TAKAI V2 hourly time must link an assigned task from the same date');
    const shiftKey = time.shiftKey?.trim() ?? '';
    const key = `${time.personId}|${time.workDate}|${time.rateSatang}|${shiftKey}`;
    const current = shiftBuckets.get(key);
    const durationMinutes = (current?.durationMinutes ?? 0) + time.durationMinutes;
    const intent: LaborV2HourlyShiftIntent = {
      id: current?.id ?? `hourly:${key}`,
      personId: time.personId, workDate: time.workDate, rateSatang: time.rateSatang, shiftKey,
      durationMinutes,
      totalSatang: dueFromMinutesRate(durationMinutes, time.rateSatang, 'hourly shift'),
      taskTimeEntryIds: [...(current?.taskTimeEntryIds ?? []), time.id],
    };
    shiftBuckets.set(key, intent);
  }

  const obligations: LaborV2ObligationIntent[] = [];
  for (const daily of dailyByPersonDate.values()) obligations.push({ id: `obligation:daily:${daily.id}`, sourceKind: 'daily', sourceUnitId: daily.id, recipientKind: 'person', personId: daily.personId, dueSatang: daily.dueSatang });
  for (const shift of shiftBuckets.values()) obligations.push({ id: `obligation:hourly:${shift.id}`, sourceKind: 'hourly', sourceUnitId: shift.id, recipientKind: 'person', personId: shift.personId, dueSatang: shift.totalSatang });

  const contractBatches = input.contracts.map((contract) => {
    if (!contract.id.trim() || !contract.title.trim()) throw new Error('TAKAI V2 contract batch requires an ID and title');
    assertDate(contract.startsOn, 'contract start');
    if (contract.deadlineOn) assertDate(contract.deadlineOn, 'contract deadline');
    unique(contract.memberPersonIds, 'contract members');
    for (const taskId of contract.taskIds ?? []) if (!taskById.has(taskId)) throw new Error('TAKAI V2 contract batch links an unknown task');
    if (!contract.finalization) return { ...contract, status: 'open' as const, dueSatang: null };
    const dueSatang = contract.finalization.kind === 'quantity_rate'
      ? dueFromQuantityRate(contract.finalization.quantityMilli, contract.finalization.rateSatang, 'contract finalization')
      : (() => { assertPositiveInteger(contract.finalization.finalTotalSatang, 'contract final total'); return contract.finalization.finalTotalSatang; })();
    obligations.push({ id: `obligation:contract:${contract.id}`, sourceKind: 'contract', sourceUnitId: contract.id, recipientKind: 'group', personId: null, dueSatang });
    return { ...contract, status: 'finalized' as const, dueSatang };
  });

  return { dailyUnits: [...dailyByPersonDate.values()], hourlyShifts: [...shiftBuckets.values()], contractBatches, obligations };
};
