/**
 * Converts a device date to a calendar day without letting UTC serialization shift a field record.
 * Use this for user-chosen dates; keep ISO strings for event timestamps and storage metadata.
 */
export const localDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
