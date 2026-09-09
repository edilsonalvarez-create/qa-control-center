import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { DriveSyncPanel } from "./SettingsPage";

export function ImportPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");

  const reload = () => api<any[]>("/api/v1/import").then(setJobs).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (sourceUrl) fd.append("sourceUrl", sourceUrl);
      const job = await api<any>("/api/v1/import/upload", { method: "POST", body: fd });
      setPreview(job);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit(id: string, confirmDuplicates: boolean) {
    setBusy(true);
    try {
      await api(`/api/v1/import/${id}/commit`, {
        method: "POST",
        body: JSON.stringify({ confirmDuplicates }),
      });
      setPreview(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const parsed = preview?.previewJson?.parsed;
  const counts = preview?.previewJson?.counts;
  const dups = preview?.duplicates ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Import Center</h2>
        <p className="text-sm text-slate-500">
          Upload → Parse → Detect structure → Normalize → Validate → Duplicates → Preview → Import. Nunca se confirma solo si hay duplicados.
        </p>
      </div>
      <DriveSyncPanel compact />
      <div className="card space-y-3">
        <label className="text-sm">URL original de Drive (opcional)</label>
        <input
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="https://drive.google.com/..."
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.docx,.json"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {busy && <p className="text-sm text-slate-500">Procesando…</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </div>

      {preview && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Vista previa — {preview.sourceFile?.fileName}</h3>
          <p className="text-sm">
            Proyecto: {parsed?.detectedProject ?? "Unknown"} · Módulo: {parsed?.detectedModule ?? "Unknown"} · Tipo:{" "}
            {parsed?.testType ?? "UNKNOWN"}
          </p>
          {counts && (
            <p className="text-sm">
              total {counts.total} · PASS {counts.passed} · FAIL {counts.failed} · BLOCKED {counts.blocked} · SKIPPED{" "}
              {counts.skipped} · review {counts.unknown}
            </p>
          )}
          {parsed?.headers?.length > 0 && (
            <p className="text-xs text-slate-500">
              Columnas: {parsed.headers.filter((h: any) => h.role !== "ignore").map((h: any) => `${h.header}→${h.role}`).join(", ")}
            </p>
          )}
          {parsed?.warnings?.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
              {parsed.warnings.map((w: any, i: number) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          )}
          {dups.length > 0 && (
            <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
              <p className="font-semibold">Duplicados detectados — no se importará automáticamente</p>
              {dups.map((d: any) => (
                <p key={d.id}>
                  {d.reason} ({d.existingType})
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button className="rounded-xl bg-cyan-600 px-4 py-2 text-sm text-white" onClick={() => commit(preview.id, false)} disabled={dups.length > 0}>
              Importar
            </button>
            {dups.length > 0 && (
              <button className="rounded-xl border border-amber-500 px-4 py-2 text-sm" onClick={() => commit(preview.id, true)}>
                Confirmar pese a duplicados
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 font-semibold">Trabajos recientes</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Archivo</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">{j.sourceFile?.fileName}</td>
                <td>
                  <StatusBadge value={j.status} />
                </td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
