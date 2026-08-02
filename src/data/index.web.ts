import type { LaborPreviewAdapter } from '../features/labor-mvp/preview';
import { createWebLaborNotebookAdapter, createWebLaborPreviewAdapter } from '../features/labor-mvp/preview.web';

/**
 * Expo SQLite's web WASM is unavailable in this project. This adapter consumes
 * the checked-in fixture generated from migrations + repository commands.
 */
export const initializeTakaiLaborPreview = async (): Promise<LaborPreviewAdapter> => createWebLaborPreviewAdapter();

const webSearch = (): string => typeof window === 'undefined' ? '' : window.location.search;

/** A deliberate browser-only proof entrypoint; the default URL remains the empty notebook. */
export const isTakaiLaborProofRequested = (search = webSearch()): boolean => new URLSearchParams(search).get('proof') === '1';

export const selectTakaiWebLaborAdapter = (search = webSearch()): LaborPreviewAdapter => (
  isTakaiLaborProofRequested(search) ? createWebLaborPreviewAdapter() : createWebLaborNotebookAdapter()
);

/** Product web fallback does not fabricate records and refuses writes truthfully. */
export const initializeTakaiLaborNotebook = async (): Promise<LaborPreviewAdapter> => selectTakaiWebLaborAdapter();
