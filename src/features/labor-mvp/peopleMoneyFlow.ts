import type { LaborMvpReadModel } from './types';

export type CorrectionTarget = {
  id: string;
  kind: 'payment' | 'receipt' | 'advance';
  label: string;
  detail: string;
};

/** A correction is deliberately inert until the operator names the exact record. */
export const eligibleCorrectionTargets = (
  model: LaborMvpReadModel,
  context: { jobId?: string | null; personId?: string | null },
): CorrectionTarget[] => {
  const paymentTargets = model.payments
    .filter((payment) => (!context.personId || payment.personId === context.personId)
      && (!context.jobId || payment.allocations.some((allocation) => model.payables.find((payable) => payable.id === allocation.payableId)?.jobId === context.jobId)))
    .map((payment) => ({ id: `payment:${payment.id}`, kind: 'payment' as const, label: 'จ่ายค่าแรง', detail: `${payment.paymentDate} · ${payment.totalSatang / 100} บาท` }));
  const receiptTargets = model.settlementGroups
    .filter((group) => !context.jobId || group.jobId === context.jobId)
    .flatMap((group) => group.receipts.map((receipt) => ({ id: `receipt:${receipt.id}`, kind: 'receipt' as const, label: 'รับเงินชุดงาน', detail: `${receipt.receiptDate} · ${receipt.amountSatang / 100} บาท` })));
  const advanceTargets = model.advances
    .filter((advance) => Boolean(context.personId) && advance.personId === context.personId)
    .map((advance) => ({ id: `advance:${advance.id}`, kind: 'advance' as const, label: 'เงินเบิก', detail: `${advance.advanceDate} · ${advance.amountSatang / 100} บาท` }));
  return [...paymentTargets, ...receiptTargets, ...advanceTargets];
};

export const requireCorrectionTarget = (targets: CorrectionTarget[], targetId: string): CorrectionTarget => {
  const target = targets.find((item) => item.id === targetId);
  if (!target) throw new Error('เลือกรายการการเงินที่ต้องการแก้ไขก่อน');
  return target;
};

export type CommitResult = 'committed' | 'committed-refresh-pending';

/** One confirmation can produce at most one command; a retry refresh never replays it. */
export const createSingleCommitCoordinator = () => {
  let commandPromise: Promise<CommitResult> | null = null;
  return {
    commit: (command: () => Promise<void>, refresh: () => Promise<void>): Promise<CommitResult> => {
      if (commandPromise) return commandPromise;
      commandPromise = (async () => {
        await command();
        try {
          await refresh();
          return 'committed';
        } catch {
          return 'committed-refresh-pending';
        }
      })().catch((error: unknown) => { commandPromise = null; throw error; });
      return commandPromise;
    },
  };
};

export const workerDraftError = (input: { displayName: string; reason?: string }, mode: 'create' | 'edit' | 'archive'): string | null => {
  if (mode !== 'archive' && !input.displayName.trim()) return 'กรอกชื่อคนทำงานก่อนบันทึก';
  if ((mode === 'edit' || mode === 'archive') && !input.reason?.trim()) return 'การแก้ไขหรือเก็บรายชื่อต้องระบุเหตุผล';
  return null;
};
