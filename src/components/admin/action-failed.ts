import { unstable_rethrow } from 'next/navigation';

/** Shown when a server action could not be reached (connection lost, server error). */
export const NETWORK_ERROR = 'Could not reach the store. Check your internet connection and try again.';

/**
 * For `.catch()` on a server action called from the browser: lets Next.js redirects (e.g. to sign in again)
 * through, and turns any other failure into a failed result the caller already knows how to show.
 */
export function actionFailed(e: unknown): { ok: false; error: string } {
  unstable_rethrow(e);
  return { ok: false, error: NETWORK_ERROR };
}
