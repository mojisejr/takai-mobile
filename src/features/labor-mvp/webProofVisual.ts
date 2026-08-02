export type LaborWebProofVisual = 'none' | 'success-toast' | 'confirm-sheet';

const browserSearch = (): string => typeof window === 'undefined' ? '' : window.location.search;

/** Visual fixtures exist only behind the explicit web proof URL and never issue a command. */
export const selectLaborWebProofVisual = (search = browserSearch()): LaborWebProofVisual => {
  const params = new URLSearchParams(search);
  if (params.get('proof') !== '1') return 'none';
  if (params.get('sheet') === 'confirm') return 'confirm-sheet';
  if (params.get('toast') === 'success') return 'success-toast';
  return 'none';
};
