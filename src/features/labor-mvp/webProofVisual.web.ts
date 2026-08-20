import { selectLaborWebProofScenarioFromSearch, selectLaborWebProofScreenFromSearch, selectLaborWebProofVisualFromSearch, type LaborWebProofScenario, type LaborWebProofScreen, type LaborWebProofVisual } from './webProofVisualQuery';

const browserSearch = (): string => typeof window === 'undefined' ? '' : window.location?.search ?? '';

/** Visual fixtures exist only behind the explicit web proof URL and never issue a command. */
export const selectLaborWebProofVisual = (search = browserSearch()): LaborWebProofVisual => selectLaborWebProofVisualFromSearch(search);
export const selectLaborWebProofScreen = (search = browserSearch()): LaborWebProofScreen => selectLaborWebProofScreenFromSearch(search);
export const selectLaborWebProofScenario = (search = browserSearch()): LaborWebProofScenario => selectLaborWebProofScenarioFromSearch(search);
