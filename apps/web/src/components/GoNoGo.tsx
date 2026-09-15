import { useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "./StatusBadge";

/** Default Go/No-Go while nobody has picked one yet, derived from the run's own result. */
export function suggestGoNoGo(status: string): "GO" | "NO_GO" | null {
  if (status === "FAILED" || status === "BLOCKED") return "NO_GO";
  if (status === "PASSED") return "GO";
  return null;
}

/**
 * Editable Go/No-Go control for a Test Run. Read-only users just see the
 * stored badge (or "Pendiente"); QA/ADMIN get a dropdown that PATCHes
 * /api/v1/test-runs/:id. Once a value is picked it's stored as-is and never
 * silently recomputed — the suggestion only shows while nothing is picked.
 */
export function GoNoGoCell({
  run,
  canEdit,
  onChanged,
  size = "sm",
}: {
  run: { id: string; goNoGo?: string | null; status: string };
  canEdit: boolean;
  onChanged: () => void;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const value: "GO" | "NO_GO" | null = (run.goNoGo as "GO" | "NO_GO" | null) ?? null;
  const suggested = value ?? suggestGoNoGo(run.status);

  async function set(next: string) {
    const goNoGo = next === "" ? null : next;
    setBusy(true);
    try {
      await api(`/api/v1/test-runs/${run.id}`, { method: "PATCH", body: JSON.stringify({ goNoGo }) });
      onChanged();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return value ? <StatusBadge value={value} /> : <span className="text-xs text-slate-400">Pendiente</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={`rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 ${
          size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"
        }`}
        value={value ?? ""}
        disabled={busy}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Pendiente</option>
        <option value="GO">Go</option>
        <option value="NO_GO">No Go</option>
      </select>
      {!value && suggested && (
        <span className="text-xs text-slate-400">sugerido: {suggested === "GO" ? "Go" : "No Go"}</span>
      )}
    </div>
  );
}
