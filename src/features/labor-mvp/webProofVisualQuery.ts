export type LaborWebProofVisual = 'none' | 'success-toast' | 'confirm-sheet';

/**
 * Decides which read-only proof fixture to show from a supplied query string.
 * This is deliberately free of browser globals so platform entrypoints own
 * their runtime boundary.
 */
export const selectLaborWebProofVisualFromSearch = (search: string): LaborWebProofVisual => {
  const params = new URLSearchParams(search);
  if (params.get('proof') !== '1') return 'none';
  if (params.get('sheet') === 'confirm') return 'confirm-sheet';
  if (params.get('toast') === 'success') return 'success-toast';
  return 'none';
};
