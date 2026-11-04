import { waitUntil } from '@vercel/functions';
import { logger } from './logger';

/**
 * Runs work after the response has been sent. On Vercel a function is paused as soon as it
 * answers, so a timer or an un-awaited promise would only finish at some later request (for a
 * delayed push: whenever someone next opened an app). waitUntil keeps the function alive until
 * the work is done (within the function's maxDuration, see vercel.json). Locally it just runs.
 */
export function afterResponse(work: () => Promise<unknown>): void {
  const run = work().catch((err) => logger.warn({ err }, 'Work after the response failed'));
  try {
    waitUntil(run);
  } catch {
    // Not on Vercel: the promise above keeps running on its own.
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
