/** Signals that backoff has been exhausted and retries should stop. */
export const BACKOFF_STOP = -1;

export interface ExpBackoffOptions {
  initialIntervalMs?: number;
  multiplier?: number;
  maxIntervalMs?: number;
}

/** Returns a fixed backoff duration of 1 second. */
export function fixedBackoff(): number {
  return 1000;
}

/** Returns a fixed backoff duration function. */
export function fixedBackoffGenerator(): () => number {
  return fixedBackoff;
}

/**
 * Returns a factory that produces exponential backoff duration functions.
 * Defaults mirror the Go implementation: 1s initial, 1.5x multiplier, 15s max interval, no max elapsed time.
 */
export function expBackoffGenerator(
  options: ExpBackoffOptions = {},
): () => () => number {
  const initialIntervalMs = options.initialIntervalMs ?? 1000;
  const multiplier = options.multiplier ?? 1.5;
  const maxIntervalMs = options.maxIntervalMs ?? 15_000;

  return () => {
    let currentIntervalMs = initialIntervalMs;
    let attempt = 0;

    return () => {
      if (attempt === 0) {
        attempt++;
        return currentIntervalMs;
      }

      currentIntervalMs = Math.min(
        currentIntervalMs * multiplier,
        maxIntervalMs,
      );
      attempt++;
      return currentIntervalMs;
    };
  };
}
