import { useSearchParams } from "react-router-dom";
import { DriveSyncPanel } from "../components/DriveSyncPanel";

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
