export type PickerOption = {
  id: string;
  label: string;
  meta?: string;
};

export const filterPickerOptions = (options: PickerOption[], query: string): PickerOption[] => {
  const normalized = query.trim().toLocaleLowerCase('th-TH');
  if (!normalized) return options;
  return options.filter((option) => `${option.label} ${option.meta ?? ''}`.toLocaleLowerCase('th-TH').includes(normalized));
};

export const recentPickerOptions = (options: PickerOption[], recentIds: string[], limit = 3): PickerOption[] =>
  recentIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is PickerOption => Boolean(option))
    .slice(0, limit);
