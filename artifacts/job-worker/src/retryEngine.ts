import type { RetryPolicy } from "@workspace/db";

export function computeNextDelay(policy: RetryPolicy, attemptNumber: number): number {
  const base = policy.baseDelayMs;
  const multiplier = parseFloat(policy.multiplier ?? "2.0");
  switch (policy.type) {
    case "fixed":
      return base;
    case "linear":
      return base * attemptNumber;
    case "exponential":
      return base * Math.pow(multiplier, attemptNumber);
    default:
      return base;
  }
}
