import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  Upload,
  Layers,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { FilterBar } from "./FilterBar";
import { api } from "../lib/api";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/runs", label: "Test Runs", icon: ClipboardList },
  { to: "/cases", label: "Test Cases", icon: Layers },
  { to: "/catalog", label: "Catálogo", icon: BookOpen },
  { to: "/defects", label: "Defects", icon: Bug },
  { to: "/coverage", label: "Coverage", icon: Shield },
  { to: "/evidence", label: "Evidence", icon: FolderOpen },
  { to: "/timeline", label: "Timeline", icon: Calendar },
  { to: "/releases", label: "Releases", icon: Activity },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/import", label: "Import Center", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("qacc_theme") !== "light");
  const [q, setQ] = useState("");

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
          {links.map(({ to, label, icon: Icon }) => (
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
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs dark:border-slate-800">
          <p className="font-medium">{user?.name}</p>
          <p className="text-slate-500">{user?.role}</p>
          <button
            className="mt-2 flex items-center gap-1 text-slate-500 hover:text-rose-500"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </aside>
      <div className="ml-60">
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
