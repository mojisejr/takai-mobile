export type LaborWebProofVisual = 'none' | 'success-toast' | 'confirm-sheet';
export type LaborWebProofScreen = 'today' | 'work' | 'record' | 'payment' | null;
/** Read-only visual states for the explicit browser-proof route. */
export type LaborWebProofScenario =
  | 'daily-three-task'
  | 'open-contract'
  | 'payment-selection'
  | 'plot-multi-target'
  | 'plot-quick-add'
  | 'plot-renamed-detail'
  | 'plot-archive-history'
  | null;

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

export const selectLaborWebProofScreenFromSearch = (search: string): LaborWebProofScreen => {
  const params = new URLSearchParams(search);
  if (params.get('proof') !== '1') return null;
  const screen = params.get('screen');
  return screen === 'record' || screen === 'payment' || screen === 'today' || screen === 'work' ? screen : 'today';
};

export const selectLaborWebProofScenarioFromSearch = (search: string): LaborWebProofScenario => {
  const params = new URLSearchParams(search);
  if (params.get('proof') !== '1') return null;
  const scenario = params.get('scenario');
  return scenario === 'daily-three-task'
    || scenario === 'open-contract'
    || scenario === 'payment-selection'
    || scenario === 'plot-multi-target'
    || scenario === 'plot-quick-add'
    || scenario === 'plot-renamed-detail'
    || scenario === 'plot-archive-history'
    ? scenario
    : null;
};
