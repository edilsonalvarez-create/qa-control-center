import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";

export function EvidenceUrlInput({
  testRunId,
  currentUrl,
  onSynced,
}: {
  testRunId: string;
  currentUrl?: string | null;
  onSynced: () => void;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setBusy(true);
    try {
      await api(`/api/v1/test-runs/${testRunId}`, {
        method: "PATCH",
        body: JSON.stringify({ evidenceUrl: url.trim() }),
      });
      setOk(true);
      onSynced();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-sm font-semibold" htmlFor={`evidence-${testRunId}`}>
        Evidencia en Google Sheets
      </label>
      <p className="text-xs text-slate-500">
        Cuenta una fila por caso desde la columna <strong>Estado Ejecución</strong>. La hoja debe estar
        compartida como “Cualquier persona con el enlace puede ver”.
      </p>
      <div className="flex gap-2">
        <input
          id={`evidence-${testRunId}`}
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : undefined} />
          {busy ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {ok && <p className="text-xs text-emerald-600">Conteos actualizados desde la hoja.</p>}
      {currentUrl && (
        <p className="text-xs text-slate-500">
          Última hoja vinculada:{" "}
          <a href={currentUrl} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
            abrir en Google Sheets
          </a>
        </p>
      )}
    </form>
  );
}
