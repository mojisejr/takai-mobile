import type { LaborV2Adapter } from '../features/labor-mvp/previewV2Adapter';
import { createWebLaborV2NotebookAdapter, createWebLaborV2PreviewAdapter } from '../features/labor-mvp/previewV2.web';

/**
 * Expo SQLite's web WASM is unavailable in this project. This adapter consumes
 * the checked-in fixture generated from migrations + repository commands.
 */
export const initializeTakaiLaborPreview = async (): Promise<LaborV2Adapter> => createWebLaborV2PreviewAdapter();

const webSearch = (): string => typeof window === 'undefined' ? '' : window.location.search;

/** A deliberate browser-only proof entrypoint; the default URL remains the empty notebook. */
export const isTakaiLaborProofRequested = (search = webSearch()): boolean => new URLSearchParams(search).get('proof') === '1';

export const selectTakaiWebLaborAdapter = (search = webSearch()): LaborV2Adapter => (
  isTakaiLaborProofRequested(search) ? createWebLaborV2PreviewAdapter() : createWebLaborV2NotebookAdapter()
);

/** Product web fallback does not fabricate records and refuses writes truthfully. */
export const initializeTakaiLaborNotebook = async (): Promise<LaborV2Adapter> => selectTakaiWebLaborAdapter();
