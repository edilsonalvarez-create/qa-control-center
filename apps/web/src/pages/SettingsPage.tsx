import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusBadge } from "../components/StatusBadge";

type DriveStatus = {
  connected: boolean;
  mode: string;
  oauthConfigured: boolean;
  googleEmail: string | null;
  folderId: string;
  folderUrl: string;
  lastSyncAt: string | null;
  lastError: string | null;
  nextSyncAt: string;
  running: boolean;
  lastRun: {
    id: string;
    status: string;
    trigger: string;
    startedAt: string;
    finishedAt: string | null;
    filesSeen: number;
    filesImported: number;
    filesSkipped: number;
    filesPreview: number;
    filesFailed: number;
    errorMessage: string | null;
  } | null;
  recentRuns: Array<{
    id: string;
    status: string;
    trigger: string;
    startedAt: string;
    filesImported: number;
    filesPreview: number;
    filesSkipped: number;
    filesFailed: number;
  }>;
  schedule: { cron: string; timezone: string; enabled: boolean };
};

export function DriveSyncPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canSync = user?.role === "ADMIN" || user?.role === "QA_MANAGER";
  const canConnect = user?.role === "ADMIN";

  async function reload() {
    const s = await api<DriveStatus>("/api/v1/integrations/google/status");
    setStatus(s);
  }

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!status?.running) return;
    const t = setInterval(() => {
      reload().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [status?.running]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ url: string }>("/api/v1/integrations/google/start");
      window.location.href = r.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/integrations/google/sync", { method: "POST" });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="card">
        <p className="text-sm text-slate-500">{error || "Cargando estado de Drive…"}</p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{compact ? "Sincronización Drive" : "Google Drive"}</h3>
          <p className="text-sm text-slate-500">
            Todos los días a las 6:00 (Colombia) el API revisa{" "}
            <a className="text-cyan-700" href={status.folderUrl} target="_blank" rel="noreferrer">
              pruebas qa
            </a>{" "}
            y actualiza dashboard, test runs, casos y defectos. Duplicados y copias quedan en vista previa.
          </p>
        </div>
        <div className="flex gap-2">
          {canConnect && (
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
              onClick={connect}
              disabled={busy}
            >
              {status.connected ? "Reconectar Drive" : "Conectar Google Drive"}
            </button>
          )}
          {canSync && (
            <button
              className="rounded-xl bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={syncNow}
              disabled={busy || status.running || !status.connected}
            >
              {status.running ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          Estado:{" "}
          <strong>{status.connected ? `conectado (${status.mode})` : "no conectado"}</strong>
          {status.googleEmail ? ` · ${status.googleEmail}` : null}
        </p>
        <p>
          Próxima corrida:{" "}
          <strong>
            {new Date(status.nextSyncAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })}{" "}
            (America/Bogota)
          </strong>
        </p>
        <p>
          Última sync:{" "}
          {status.lastRun
            ? `${new Date(status.lastRun.startedAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · ${status.lastRun.status}`
            : "aún no hay corridas"}
        </p>
        {status.lastRun && (
          <p>
            Archivos: vistos {status.lastRun.filesSeen} · importados {status.lastRun.filesImported} ·
            preview {status.lastRun.filesPreview} · omitidos {status.lastRun.filesSkipped} · error{" "}
            {status.lastRun.filesFailed}
          </p>
        )}
      </div>
      {!status.oauthConfigured && !status.connected && (
        <p className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
          Falta configurar OAuth en Railway (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
          `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`). Nunca se pide la contraseña de Google.
        </p>
      )}
      {status.lastError && <p className="text-sm text-rose-500">{status.lastError}</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {!compact && status.recentRuns.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Inicio</th>
              <th>Origen</th>
              <th>Estado</th>
              <th>Importados</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {status.recentRuns.map((r) => (
              <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">{new Date(r.startedAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
                <td>{r.trigger}</td>
                <td>
                  <StatusBadge value={r.status} />
                </td>
                <td>{r.filesImported}</td>
                <td>{r.filesPreview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SettingsPage() {
  const [params] = useSearchParams();
  const drive = params.get("drive");
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-slate-500">
          Roles: ADMIN, QA_MANAGER, QA, VIEWER. Secretos solo en variables de entorno.
        </p>
        {drive === "connected" && <p className="text-sm text-emerald-600">Google Drive conectado.</p>}
        {drive === "error" && <p className="text-sm text-rose-500">No se pudo completar OAuth de Google.</p>}
        {drive === "no_refresh_token" && (
          <p className="text-sm text-amber-700">
            Google no devolvió refresh token. Revoca el acceso de la app en la cuenta Google y vuelve a conectar con
            consentimiento.
          </p>
        )}
      </div>
      <DriveSyncPanel />
    </div>
  );
}
