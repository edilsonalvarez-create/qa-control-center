import { useState } from "react";
import { RefreshCw, Unlink } from "lucide-react";
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
  const [busy, setBusy] = useState<"sync" | "unlink" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(payload: { evidenceUrl: string | null }, kind: "sync" | "unlink") {
    setError(null);
    setDone(null);
    setBusy(kind);
    try {
      await api(`/api/v1/test-runs/${testRunId}`, { method: "PATCH", body: JSON.stringify(payload) });
      setDone(kind === "sync" ? "Conteos actualizados desde la hoja." : "Hoja desvinculada: se recontó desde los casos del run.");
      onSynced();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function unlink() {
    if (!window.confirm("¿Desvincular la hoja? Los conteos vuelven a calcularse desde los casos registrados en este run.")) return;
    setUrl("");
    await send({ evidenceUrl: null }, "unlink");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send({ evidenceUrl: url.trim() }, "sync");
      }}
      className="space-y-2"
    >
      <label className="block text-sm font-semibold" htmlFor={`evidence-${testRunId}`}>
        Evidencia en Google Sheets
      </label>
      <p className="text-xs text-slate-500">
        Cuenta una fila por caso desde la columna <strong>Estado Ejecución</strong> (o <strong>Estado</strong>).
        Comprueba que la hoja sea la de este run: si apunta a otra, los conteos serán los de esa otra.
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
          disabled={busy !== null}
        />
        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy === "sync" ? "animate-spin" : undefined} />
          {busy === "sync" ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {done && <p className="text-xs text-emerald-600">{done}</p>}
      {currentUrl && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>
            Hoja vinculada:{" "}
            <a href={currentUrl} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
              abrir en Google Sheets
            </a>
          </span>
          <button
            type="button"
            onClick={unlink}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 text-rose-500 hover:underline disabled:opacity-50"
          >
            <Unlink size={12} />
            {busy === "unlink" ? "Desvinculando…" : "Desvincular"}
          </button>
        </div>
      )}
    </form>
  );
}
