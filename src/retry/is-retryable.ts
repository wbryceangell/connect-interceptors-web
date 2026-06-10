import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Returns true if the error is caused by a network or connection error.
 * By default, retries Connect Code.Unavailable only.
 *
 * Note: raw fetch network failures in browsers often surface as Code.Unknown.
 * Use a custom isRetryable to opt into retrying those errors.
 */
export function defaultIsRetryable(err: unknown): boolean {
  const connectErr = ConnectError.from(err);
  return connectErr.code === Code.Unavailable;
}
