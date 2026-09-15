import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DriveSyncPanel } from "../components/DriveSyncPanel";

type RepairResult = { scanned: number; moved: number; errors: Array<{ caseId: string; message: string }> };

function RepairManualRunsPanel() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState("");

  if (user?.role !== "ADMIN") return null;

  async function run() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<RepairResult>("/api/v1/admin/repair-manual-runs", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2">
      <h3 className="font-semibold">Reparar agrupación de Test Runs manuales</h3>
      <p className="text-sm text-slate-500">
        Separa en su propio Test Run cualquier caso de Matriz QA que haya quedado fusionado con otros solo por
        compartir módulo (sin un Ciclo explícito). Se ejecuta sola en cada despliegue; usa este botón si necesitas
        forzarla ahora mismo.
      </p>
      <button
        className="rounded-xl bg-cyan-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        onClick={run}
        disabled={busy}
      >
        {busy ? "Ejecutando…" : "Ejecutar reparación"}
      </button>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {result && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Revisados {result.scanned} casos manuales · {result.moved} movidos a su propio run
          {result.errors.length > 0 && ` · ${result.errors.length} con error (ver logs del servidor)`}.
        </p>
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
      <RepairManualRunsPanel />
    </div>
  );
}
