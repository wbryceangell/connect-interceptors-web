import {
  Code,
  ConnectError,
  createContextValues,
  type Interceptor,
  type UnaryRequest,
  type UnaryResponse,
} from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";

import { BACKOFF_STOP } from "./backoff.js";
import { createRetryInterceptor } from "./retry.js";

function createUnaryRequest(
  overrides: Partial<UnaryRequest> = {},
): UnaryRequest {
  return {
    stream: false,
    message: {},
    method: {} as UnaryRequest["method"],
    service: {} as UnaryRequest["service"],
    requestMethod: "POST",
    url: "/greet.v1.GreetService/Greet",
    signal: new AbortController().signal,
    header: new Headers(),
    contextValues: createContextValues(),
    ...overrides,
  };
}

function createUnaryResponse(): UnaryResponse {
  return {
    stream: false,
    message: {},
    method: {} as UnaryResponse["method"],
    service: {} as UnaryResponse["service"],
    header: new Headers(),
    trailer: new Headers(),
  };
}

async function invokeUnaryInterceptor(
  interceptor: Interceptor,
  req: UnaryRequest,
  next: (req: UnaryRequest) => Promise<UnaryResponse>,
): Promise<UnaryResponse> {
  const wrapped = interceptor(next);
  const result = await wrapped(req);
  if (result.stream) {
    throw new Error("expected unary response");
  }
  return result;
}

describe("createRetryInterceptor", () => {
  it("succeeds on the first attempt", async () => {
    const next = vi.fn(async () => createUnaryResponse());
    const interceptor = createRetryInterceptor();

    const res = await invokeUnaryInterceptor(
      interceptor,
      createUnaryRequest(),
      next,
    );

    expect(res).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors until success", async () => {
    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi
      .fn()
      .mockRejectedValueOnce(retryable)
      .mockRejectedValueOnce(retryable)
      .mockResolvedValueOnce(createUnaryResponse());

    const interceptor = createRetryInterceptor(undefined, {
      backoffGenerator: () => () => 0,
      maxAttempts: 5,
    });

    const res = await invokeUnaryInterceptor(
      interceptor,
      createUnaryRequest(),
      next,
    );

    expect(res).toBeDefined();
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("stops at maxAttempts", async () => {
    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi.fn(async () => {
      throw retryable;
    });

    const interceptor = createRetryInterceptor(undefined, {
      backoffGenerator: () => () => 0,
      maxAttempts: 3,
    });

    await expect(
      invokeUnaryInterceptor(interceptor, createUnaryRequest(), next),
    ).rejects.toBe(retryable);

    expect(next).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors", async () => {
    const notRetryable = new ConnectError("invalid", Code.InvalidArgument);
    const next = vi.fn(async () => {
      throw notRetryable;
    });

    const interceptor = createRetryInterceptor(undefined, {
      backoffGenerator: () => () => 0,
      maxAttempts: 5,
    });

    await expect(
      invokeUnaryInterceptor(interceptor, createUnaryRequest(), next),
    ).rejects.toBe(notRetryable);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("skips retry for streaming requests", async () => {
    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi.fn(async () => {
      throw retryable;
    });

    const interceptor = createRetryInterceptor();
    const wrapped = interceptor(next);

    const streamReq = {
      ...createUnaryRequest(),
      stream: true as const,
      message: (async function* () {})(),
      method: {} as never,
    };

    await expect(wrapped(streamReq)).rejects.toBe(retryable);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("aborts during backoff when signal is triggered", async () => {
    vi.useFakeTimers();

    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi.fn(async () => {
      throw retryable;
    });
    const abort = new AbortController();

    const interceptor = createRetryInterceptor(undefined, {
      backoffGenerator: () => () => 1000,
      maxAttempts: 5,
    });

    const promise = invokeUnaryInterceptor(
      interceptor,
      createUnaryRequest({ signal: abort.signal }),
      next,
    );

    await Promise.resolve();
    abort.abort();

    await expect(promise).rejects.toMatchObject({
      code: Code.Canceled,
    });
    expect(next).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("respects custom isRetryable", async () => {
    const unknown = new ConnectError("network error", Code.Unknown);
    const next = vi
      .fn()
      .mockRejectedValueOnce(unknown)
      .mockResolvedValueOnce(createUnaryResponse());

    const interceptor = createRetryInterceptor(undefined, {
      isRetryable: (err) => ConnectError.from(err).code === Code.Unknown,
      backoffGenerator: () => () => 0,
      maxAttempts: 5,
    });

    const res = await invokeUnaryInterceptor(
      interceptor,
      createUnaryRequest(),
      next,
    );

    expect(res).toBeDefined();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("stops when backoff returns BACKOFF_STOP", async () => {
    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi.fn(async () => {
      throw retryable;
    });

    const interceptor = createRetryInterceptor(undefined, {
      backoffGenerator: () => () => BACKOFF_STOP,
      maxAttempts: 10,
    });

    await expect(
      invokeUnaryInterceptor(interceptor, createUnaryRequest(), next),
    ).rejects.toBe(retryable);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("logs warnings when a logger is provided", async () => {
    const logger = { warn: vi.fn() };
    const retryable = new ConnectError("unavailable", Code.Unavailable);
    const next = vi.fn(async () => {
      throw retryable;
    });

    const interceptor = createRetryInterceptor(logger, {
      backoffGenerator: () => () => 0,
      maxAttempts: 2,
    });

    await expect(
      invokeUnaryInterceptor(interceptor, createUnaryRequest(), next),
    ).rejects.toBe(retryable);

    expect(logger.warn).toHaveBeenCalledWith(
      "RPC request failed",
      expect.objectContaining({ attempt: 1 }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "RPC request failed after max attempts",
      expect.objectContaining({ max_attempts: 2 }),
    );
  });
});
