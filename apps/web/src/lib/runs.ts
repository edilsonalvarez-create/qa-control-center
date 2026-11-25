/** Cases loaded in a run that were never executed (not P/F/B/S). */
export function pendingOf(r: { totalTests: number; passed: number; failed: number; blocked: number; skipped: number }): number {
  return Math.max(0, r.totalTests - r.passed - r.failed - r.blocked - r.skipped);
}
