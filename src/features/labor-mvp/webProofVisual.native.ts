import type { LaborWebProofVisual } from './webProofVisualQuery';

/** Native never reads browser proof routes or renders their non-writing fixtures. */
export const selectLaborWebProofVisual = (): LaborWebProofVisual => 'none';
