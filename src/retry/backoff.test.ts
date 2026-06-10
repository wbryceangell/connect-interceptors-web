import { describe, expect, it } from "vitest";

import {
  expBackoffGenerator,
  fixedBackoff,
  fixedBackoffGenerator,
} from "./backoff.js";

describe("backoff", () => {
  it("fixedBackoff returns 1000ms", () => {
    expect(fixedBackoff()).toBe(1000);
  });

  it("fixedBackoffGenerator returns fixed backoff", () => {
    const generator = fixedBackoffGenerator();
    expect(generator()).toBe(1000);
    expect(generator()).toBe(1000);
  });

  it("expBackoffGenerator increases interval up to max", () => {
    const createBackoff = expBackoffGenerator({
      initialIntervalMs: 1000,
      multiplier: 2,
      maxIntervalMs: 4000,
    });
    const nextBackoff = createBackoff();

    expect(nextBackoff()).toBe(1000);
    expect(nextBackoff()).toBe(2000);
    expect(nextBackoff()).toBe(4000);
    expect(nextBackoff()).toBe(4000);
  });
});
