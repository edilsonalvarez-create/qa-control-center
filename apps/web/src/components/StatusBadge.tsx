export function StatusBadge({ value }: { value: string }) {
  const v = (value || "UNKNOWN").toUpperCase();
  const map: Record<string, string> = {
    PASS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    PASSED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    FAIL: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    FAILED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    BLOCKED: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    SKIPPED: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
    OPEN: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    CLOSED: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
    CRITICAL: "bg-red-600/20 text-red-700 dark:text-red-300",
    HIGH: "bg-orange-500/20 text-orange-800 dark:text-orange-300",
    MEDIUM: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-200",
    LOW: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
    STABLE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    OBSERVATIONS: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    FAILING: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    UNTESTED: "bg-slate-800/80 text-slate-200",
    REQUIRES_REVIEW: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
    UNKNOWN: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${map[v] ?? map.UNKNOWN}`}>
      {v.replaceAll("_", " ")}
    </span>
  );
}

export function CoverageDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    stable: "🟢",
    observations: "🟡",
    failing: "🔴",
    untested: "⚫",
  };
  return <span title={status}>{map[status] ?? "⚫"}</span>;
}
