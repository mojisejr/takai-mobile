import type { LaborPreviewAdapter } from '../features/labor-mvp/preview';
import { createWebLaborNotebookAdapter, createWebLaborPreviewAdapter } from '../features/labor-mvp/preview.web';

/**
 * Expo SQLite's web WASM is unavailable in this project. This adapter consumes
 * the checked-in fixture generated from migrations + repository commands.
 */
export const initializeTakaiLaborPreview = async (): Promise<LaborPreviewAdapter> => createWebLaborPreviewAdapter();

/** Product web fallback does not fabricate records and refuses writes truthfully. */
export const initializeTakaiLaborNotebook = async (): Promise<LaborPreviewAdapter> => createWebLaborNotebookAdapter();
