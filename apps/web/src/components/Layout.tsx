import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Bug,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Table2,
  Upload,
  Layers,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { hasModuleAccess, type ModuleKey } from "../lib/modules";
import { FilterBar } from "./FilterBar";
import { api } from "../lib/api";

const links: Array<{ to: string; label: string; icon: typeof LayoutDashboard; module: ModuleKey }> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { to: "/runs", label: "Test Runs", icon: ClipboardList, module: "runs" },
  { to: "/cases", label: "Test Cases", icon: Layers, module: "cases" },
  { to: "/matrix", label: "Matriz QA", icon: Table2, module: "matrix" },
  { to: "/catalog", label: "Catálogo", icon: BookOpen, module: "catalog" },
  { to: "/defects", label: "Defects", icon: Bug, module: "defects" },
  { to: "/coverage", label: "Coverage", icon: Shield, module: "coverage" },
  { to: "/evidence", label: "Evidence", icon: FolderOpen, module: "evidence" },
  { to: "/timeline", label: "Timeline", icon: Calendar, module: "timeline" },
  { to: "/releases", label: "Releases", icon: Activity, module: "releases" },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet, module: "reports" },
  { to: "/import", label: "Import Center", icon: Upload, module: "import" },
  { to: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const hidePageChrome = pathname === "/catalog" || pathname.startsWith("/catalog/");
  const [dark, setDark] = useState(() => localStorage.getItem("qacc_theme") !== "light");
  const [q, setQ] = useState("");
  const visibleLinks = links.filter((l) => hasModuleAccess(user, l.module));
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("qacc_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-ink-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-ink-900">
        <div className="px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">Enterprise</p>
          <h1 className="text-lg font-bold">QA Control Center</h1>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  isActive
                    ? "bg-cyan-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  isActive
                    ? "bg-cyan-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <UsersRound size={16} />
              Usuarios
            </NavLink>
          )}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs dark:border-slate-800">
          <p className="font-medium">{user?.name}</p>
          <p className="text-slate-500">{user?.role}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              className="flex items-center gap-1 text-slate-500 hover:text-rose-500"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              <LogOut size={14} /> Salir
            </button>
            {hidePageChrome && (
              <button
                onClick={() => setDark((d) => !d)}
                className="ml-auto rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"
                aria-label="Tema"
              >
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="ml-60">
        {!hidePageChrome && (
          <>
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur dark:border-slate-800 dark:bg-ink-900/90">
              <form
                className="relative flex-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!q.trim()) return;
                  nav(`/search?q=${encodeURIComponent(q)}`);
                }}
              >
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar: módulo, HTTP 429, defecto..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </form>
              <button
                onClick={() => setDark((d) => !d)}
                className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"
                aria-label="Tema"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </header>
            <FilterBar />
          </>
        )}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export async function pingHealth() {
  return api<{ status: string }>("/health");
}
