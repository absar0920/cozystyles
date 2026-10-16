'use client';

import { createContext, useContext } from 'react';

/**
 * Text typed into an "Add a value" box (or a half-filled new option card) that is not a value yet.
 * Each box reports it here so the editor counts it as an unsaved change and refuses to save until it is
 * added or cleared — otherwise "4 Seater" typed without Enter would silently not be saved.
 */
export type PendingEntry = { message: string; field: string };
export type ReportPending = (id: string, entry: PendingEntry | null) => void;

export const PendingContext = createContext<ReportPending>(() => undefined);

export function useReportPending(): ReportPending {
  return useContext(PendingContext);
}
