import { selectLaborWebProofVisualFromSearch, type LaborWebProofVisual } from './webProofVisualQuery';

const browserSearch = (): string => typeof window === 'undefined' ? '' : window.location?.search ?? '';

/** Visual fixtures exist only behind the explicit web proof URL and never issue a command. */
export const selectLaborWebProofVisual = (search = browserSearch()): LaborWebProofVisual => selectLaborWebProofVisualFromSearch(search);
