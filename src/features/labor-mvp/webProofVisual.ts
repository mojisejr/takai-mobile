import type { LaborWebProofScenario, LaborWebProofScreen, LaborWebProofVisual } from './webProofVisualQuery';

/** Fallback for non-browser platforms; Metro selects the native/web implementation first. */
export const selectLaborWebProofVisual = (): LaborWebProofVisual => 'none';
export const selectLaborWebProofScreen = (): LaborWebProofScreen => null;
export const selectLaborWebProofScenario = (): LaborWebProofScenario => null;
