import type { LaborWebProofScenario, LaborWebProofScreen, LaborWebProofVisual } from './webProofVisualQuery';

/** Native never reads browser proof routes or renders their non-writing fixtures. */
export const selectLaborWebProofVisual = (): LaborWebProofVisual => 'none';
export const selectLaborWebProofScreen = (): LaborWebProofScreen => null;
export const selectLaborWebProofScenario = (): LaborWebProofScenario => null;
