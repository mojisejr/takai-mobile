import type { Activity, ActivityParticipant, CropCycle, LaborEntry, Person } from './types';

const toDateValue = (value: string): number => {
  const date = value.length > 10 ? value.slice(0, 10) : value;
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(time)) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return time;
};

const rangeEnd = (crop: Pick<CropCycle, 'endsOn'>): number => {
  return crop.endsOn ? toDateValue(crop.endsOn) : Number.POSITIVE_INFINITY;
};

export const cropContainsDate = (crop: CropCycle, dateOrDateTime: string): boolean => {
  const day = toDateValue(dateOrDateTime);
  return toDateValue(crop.startsOn) <= day && day <= rangeEnd(crop);
};

export const cropsOverlap = (left: CropCycle, right: CropCycle): boolean => {
  if (left.plotId !== right.plotId || left.id === right.id) {
    return false;
  }

  return toDateValue(left.startsOn) <= rangeEnd(right) && toDateValue(right.startsOn) <= rangeEnd(left);
};

export const assertNoCropOverlap = (existing: CropCycle[], candidate: CropCycle): void => {
  const overlap = existing.find((crop) => cropsOverlap(crop, candidate));
  if (overlap) {
    throw new Error(`Crop cycle ${candidate.id} overlaps ${overlap.id} on plot ${candidate.plotId}`);
  }
};

export const assertOneActiveCropPerPlot = (cropCycles: CropCycle[]): void => {
  const activeByPlot = new Map<string, string>();

  for (const crop of cropCycles) {
    if (crop.status !== 'active') continue;
    const existing = activeByPlot.get(crop.plotId);
    if (existing) {
      throw new Error(`Plot ${crop.plotId} has multiple active crop cycles: ${existing}, ${crop.id}`);
    }
    activeByPlot.set(crop.plotId, crop.id);
  }
};

export const resolveCropForActivity = (
  cropCycles: CropCycle[],
  plotId: string,
  performedAt: string,
): CropCycle | null => {
  const matches = cropCycles.filter((crop) => crop.plotId === plotId && cropContainsDate(crop, performedAt));
  if (matches.length > 1) {
    throw new Error(`Activity date ${performedAt} resolves to multiple crops on plot ${plotId}`);
  }
  return matches[0] ?? null;
};

export const laborEntriesForParticipants = (
  activity: Pick<Activity, 'performedAt'>,
  participants: ActivityParticipant[],
  people: Person[],
): LaborEntry[] => {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const workDate = activity.performedAt.slice(0, 10);

  return participants.flatMap((participant) => {
    const person = peopleById.get(participant.personId);
    const shouldSkip =
      !person ||
      person.isSelf ||
      participant.payType === 'none' ||
      participant.amountDue <= 0 ||
      Boolean(participant.paidAt);

    if (shouldSkip) {
      return [];
    }

    return [
      {
        id: `labor-${participant.id}`,
        activityParticipantId: participant.id,
        personId: participant.personId,
        workDate,
        amountDue: participant.amountDue,
        amountPaid: 0,
        status: 'unpaid' as const,
      },
    ];
  });
};
