import {
  BACKOFF_STOP,
  expBackoffGenerator,
  fixedBackoff,
  fixedBackoffGenerator,
  type ExpBackoffOptions,
} from "./backoff.js";
import { defaultIsRetryable } from "./is-retryable.js";

export type BackoffGeneratorFactory = () => () => number;

export interface RetryConfig {
  /**
   * A BackoffGeneratorFactory returns an instance of a backoff function for use with a single RPC call.
   * By default, it returns a fixed backoff of 1 second between attempts.
   * When the backoff function returns BACKOFF_STOP (-1), the RPC call will not be retried.
   */
  backoffGenerator?: BackoffGeneratorFactory;
  /**
   * isRetryable should return true if the error is retryable.
   * By default, it returns true for Code.Unavailable.
   */
  isRetryable?: (err: unknown) => boolean;
  /**
   * Set maxAttempts to <= 0 to retry indefinitely.
   */
  maxAttempts?: number;
}

export type ResolvedRetryConfig = {
  backoffGenerator: BackoffGeneratorFactory;
  isRetryable: (err: unknown) => boolean;
  maxAttempts: number;
};

/** Returns a default retry configuration with fixed backoff and retries on Code.Unavailable. */
export function defaultRetryConfig(): ResolvedRetryConfig {
  return {
    backoffGenerator: fixedBackoffGenerator,
    isRetryable: defaultIsRetryable,
    maxAttempts: 10,
  };
}

export function resolveRetryConfig(config?: RetryConfig): ResolvedRetryConfig {
  const defaults = defaultRetryConfig();
  return {
    backoffGenerator: config?.backoffGenerator ?? defaults.backoffGenerator,
    isRetryable: config?.isRetryable ?? defaults.isRetryable,
    maxAttempts: config?.maxAttempts ?? defaults.maxAttempts,
  };
}

export {
  BACKOFF_STOP,
  expBackoffGenerator,
  fixedBackoff,
  fixedBackoffGenerator,
};
export type { ExpBackoffOptions };
