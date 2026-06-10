import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";

import { defaultIsRetryable } from "./is-retryable.js";

describe("defaultIsRetryable", () => {
  it("returns true for Code.Unavailable", () => {
    expect(
      defaultIsRetryable(new ConnectError("unavailable", Code.Unavailable)),
    ).toBe(true);
  });

  it("returns false for other Connect error codes", () => {
    expect(
      defaultIsRetryable(
        new ConnectError("invalid argument", Code.InvalidArgument),
      ),
    ).toBe(false);
    expect(
      defaultIsRetryable(new ConnectError("unknown", Code.Unknown)),
    ).toBe(false);
  });

  it("returns false for non-Connect errors", () => {
    expect(defaultIsRetryable(new Error("network"))).toBe(false);
  });
});
