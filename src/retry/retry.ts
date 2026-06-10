import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";

import {
  BACKOFF_STOP,
  resolveRetryConfig,
  type RetryConfig,
} from "./config.js";

export type RetryLogger = {
  warn: (message: string, fields?: Record<string, unknown>) => void;
};

export async function abortableSleep(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw new ConnectError("Request aborted", Code.Canceled);
  }

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(new ConnectError("Request aborted", Code.Canceled));
    };

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort);
  });
}

/** Returns a new retry interceptor for Connect web clients. */
export function createRetryInterceptor(
  logger?: RetryLogger,
  config?: RetryConfig,
): Interceptor {
  const conf = resolveRetryConfig(config);
  const nextBackoff = conf.backoffGenerator();

  return (next) => async (req) => {
    if (req.stream) {
      return await next(req);
    }

    const name = req.url;
    let attempt = 0;

    for (;;) {
      attempt++;
      const start = performance.now();

      try {
        return await next(req);
      } catch (err) {
        if (!conf.isRetryable(err)) {
          throw err;
        }

        const elapsedUs = Math.round((performance.now() - start) * 1000);
        logger?.warn("RPC request failed", {
          name,
          attempt,
          elapsed_us: elapsedUs,
          err,
        });

        if (conf.maxAttempts > 0 && attempt >= conf.maxAttempts) {
          logger?.warn("RPC request failed after max attempts", {
            name,
            max_attempts: conf.maxAttempts,
            elapsed_us: elapsedUs,
            err,
          });
          throw err;
        }

        const sleepMs = nextBackoff();
        if (sleepMs === BACKOFF_STOP) {
          logger?.warn("RPC request failed after max backoff", {
            name,
            elapsed_us: elapsedUs,
            err,
          });
          throw err;
        }

        await abortableSleep(sleepMs, req.signal);
      }
    }
  };
}
