import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "../lib/modules";

const ROLES = ["ADMIN", "QA_MANAGER", "QA", "VIEWER"] as const;
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  QA_MANAGER: "QA Manager",
  QA: "QA",
  VIEWER: "Solo lectura",
};

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: (typeof ROLES)[number];
  active: boolean;
  allowedModules: string[];
  createdAt: string;
};

type FormState = {
  email: string;
  name: string;
  password: string;
  role: (typeof ROLES)[number];
  active: boolean;
  allowedModules: ModuleKey[];
};

const emptyForm = (): FormState => ({
  email: "",
  name: "",
  password: "",
  role: "QA",
  active: true,
  allowedModules: [...MODULE_KEYS],
});

export function UsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<ManagedUser[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function reload() {
    setRows(await api<ManagedUser[]>("/api/v1/users"));
  }

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message));
  }, []);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function openEdit(u: ManagedUser) {
    setEditingId(u.id);
    setForm({
      email: u.email,
      name: u.name,
      password: "",
      role: u.role,
      active: u.active,
      allowedModules: u.allowedModules.length ? (u.allowedModules as ModuleKey[]) : [...MODULE_KEYS],
    });
  }

  function toggleModule(key: ModuleKey) {
    setForm((f) => {
      if (!f) return f;
      const has = f.allowedModules.includes(key);
      return { ...f, allowedModules: has ? f.allowedModules.filter((m) => m !== key) : [...f.allowedModules, key] };
    });
  }

  async function submit() {
    if (!form) return;
    if (!editingId && (!form.email.trim() || !form.password)) {
      return setError("Correo y contraseña son obligatorios para crear un usuario.");
    }
    setBusy(true);
    setError("");
    try {
      // Checking every module box is how "sin restricción" is represented, same as leaving none checked
      // would be — the backend treats an empty list as unrestricted, so send [] when everything is on.
      const allowedModules = form.allowedModules.length === MODULE_KEYS.length ? [] : form.allowedModules;
      if (editingId) {
        const patch: Record<string, unknown> = {
          name: form.name,
          role: form.role,
          active: form.active,
          allowedModules,
        };
        if (form.password) patch.password = form.password;
        await api(`/api/v1/users/${editingId}`, { method: "PATCH", body: JSON.stringify(patch) });
      } else {
        await api("/api/v1/users", {
          method: "POST",
          body: JSON.stringify({
            email: form.email.trim(),
            name: form.name.trim() || form.email.trim(),
            password: form.password,
            role: form.role,
            allowedModules,
          }),
        });
      }
      setForm(null);
      setEditingId(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: ManagedUser) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Usuarios</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Crea usuarios, asigna su rol y elige qué módulos ven en el menú. Solo un administrador puede entrar
            aquí. Sin módulos marcados de forma explícita = acceso a todos.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm text-white"
          onClick={openNew}
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {busy && <p className="text-sm text-slate-500">Procesando…</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 pr-3">Nombre</th>
              <th className="pr-3">Correo</th>
              <th className="pr-3">Rol</th>
              <th className="pr-3">Módulos</th>
              <th className="pr-3">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                <td className="py-2 pr-3">{u.name}</td>
                <td className="pr-3">{u.email}</td>
                <td className="pr-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="max-w-xs pr-3 text-xs text-slate-500">
                  {u.role === "ADMIN" || !u.allowedModules.length
                    ? "Todos"
                    : u.allowedModules.map((m) => MODULE_LABELS[m as ModuleKey] ?? m).join(", ")}
                </td>
                <td className="pr-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.active
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-500/15 text-slate-500"
                    }`}
                  >
                    {u.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="pr-1">
                  <div className="flex gap-2">
                    <button className="text-slate-400 hover:text-cyan-600" aria-label="Editar" onClick={() => openEdit(u)}>
                      <Pencil size={14} />
                    </button>
                    {u.id !== me?.id && (
                      <button
                        className="text-xs text-slate-400 hover:text-rose-500"
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Sin usuarios aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingId ? "Editar usuario" : "Nuevo usuario"}</h3>
              <button aria-label="Cerrar" onClick={() => setForm(null)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className="text-sm">
                <span className="text-slate-500">Correo {!editingId && "*"}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60"
                  type="email"
                  value={form.email}
                  disabled={Boolean(editingId)}
                  required={!editingId}
                  onChange={(e) => setForm((f) => f && { ...f, email: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Nombre</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                  value={form.name}
                  onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">{editingId ? "Nueva contraseña (opcional)" : "Contraseña *"}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                  type="password"
                  minLength={8}
                  placeholder={editingId ? "Dejar en blanco para no cambiarla" : "Mínimo 8 caracteres"}
                  required={!editingId}
                  value={form.password}
                  onChange={(e) => setForm((f) => f && { ...f, password: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Rol</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                  value={form.role}
                  onChange={(e) => setForm((f) => f && { ...f, role: e.target.value as FormState["role"] })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => f && { ...f, active: e.target.checked })}
                  />
                  Cuenta activa
                </label>
              )}
              <div className="text-sm">
                <p className="text-slate-500">Módulos visibles</p>
                {form.role === "ADMIN" && (
                  <p className="mt-1 text-xs text-slate-400">Un administrador siempre ve todos los módulos.</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {MODULE_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={form.role === "ADMIN"}
                        checked={form.allowedModules.includes(key)}
                        onChange={() => toggleModule(key)}
                      />
                      {MODULE_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="sticky bottom-0 flex gap-2 bg-white pt-3 dark:bg-slate-900">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  disabled={busy}
                >
                  {editingId ? "Guardar cambios" : "Crear usuario"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
                  onClick={() => setForm(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
