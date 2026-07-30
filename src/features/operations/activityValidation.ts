import type { ActivityTimeMode } from './types';
import { normalizeActivityTemporal } from './temporal';

type DraftMaterial = { materialId: string };
type DraftWorker = { personId: string; payType: 'none' | 'daily' | 'hourly' | 'piece' | 'contract'; amount: string };

export const validateActivityDraft = (input: {
  activityDate: string;
  timeMode: ActivityTimeMode;
  startedAt: string;
  endedAt: string;
  durationMinutes: string;
  materials: DraftMaterial[];
  workers: DraftWorker[];
}): string[] => {
  const errors: string[] = [];
  try {
    normalizeActivityTemporal({
      performedAt: `${input.activityDate}T12:00:00.000Z`,
      timeMode: input.timeMode,
      activityDate: input.activityDate,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMinutes: Number(input.durationMinutes),
    });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'วันที่หรือเวลาไม่ถูกต้อง');
  }
  input.materials.forEach((material, index) => {
    if (!material.materialId.trim()) errors.push(`วัสดุ ${index + 1}: กรุณาเลือกวัสดุหรือกดนำออก`);
  });
  input.workers.forEach((worker, index) => {
    if (!worker.personId.trim()) errors.push(`คนงาน ${index + 1}: กรุณาเลือกคนงานหรือกดนำออก`);
    if (worker.personId.trim() && worker.payType !== 'none' && (!Number.isFinite(Number(worker.amount)) || Number(worker.amount) <= 0)) {
      errors.push(`คนงาน ${index + 1}: กรุณาระบุค่าแรงให้มากกว่า 0`);
    }
  });
  return errors;
};
