import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { hasModuleAccess, MODULE_LABELS, type ModuleKey } from "./lib/modules";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { MatrixPage } from "./pages/MatrixPage";
import { UsersPage } from "./pages/UsersPage";
import {
  CasesPage,
  CoveragePage,
  DefectsPage,
  EvidencePage,
  ReleasesPage,
  ReportsPage,
  RunsPage,
  SearchPage,
  TimelinePage,
} from "./pages/Lists";

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Cargando sesión…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Hides a route (and redirects) unless the signed-in user's allowedModules grants it. */
function ModuleRoute({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasModuleAccess(user, module)) return <Navigate to={`/no-access?m=${module}`} replace />;
  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

function NoAccessPage() {
  const module = new URLSearchParams(window.location.search).get("m") as ModuleKey | null;
  return (
    <div className="card py-10 text-center">
      <p className="text-lg font-semibold">Sin acceso</p>
      <p className="mt-2 text-sm text-slate-500">
        Tu cuenta no tiene permiso para ver {module ? `«${MODULE_LABELS[module] ?? module}»` : "este módulo"}.
        Pídele a un administrador que te lo habilite en Usuarios.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="runs"
          element={
            <ModuleRoute module="runs">
              <RunsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="runs/:id"
          element={
            <ModuleRoute module="runs">
              <RunDetailPage />
            </ModuleRoute>
          }
        />
        <Route
          path="cases"
          element={
            <ModuleRoute module="cases">
              <CasesPage />
            </ModuleRoute>
          }
        />
        <Route
          path="matrix"
          element={
            <ModuleRoute module="matrix">
              <MatrixPage />
            </ModuleRoute>
          }
        />
        <Route
          path="catalog"
          element={
            <ModuleRoute module="catalog">
              <CatalogPage />
            </ModuleRoute>
          }
        />
        <Route
          path="defects"
          element={
            <ModuleRoute module="defects">
              <DefectsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="coverage"
          element={
            <ModuleRoute module="coverage">
              <CoveragePage />
            </ModuleRoute>
          }
        />
        <Route
          path="evidence"
          element={
            <ModuleRoute module="evidence">
              <EvidencePage />
            </ModuleRoute>
          }
        />
        <Route
          path="timeline"
          element={
            <ModuleRoute module="timeline">
              <TimelinePage />
            </ModuleRoute>
          }
        />
        <Route
          path="releases"
          element={
            <ModuleRoute module="releases">
              <ReleasesPage />
            </ModuleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ModuleRoute module="reports">
              <ReportsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="import"
          element={
            <ModuleRoute module="import">
              <ImportPage />
            </ModuleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ModuleRoute module="settings">
              <SettingsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route path="no-access" element={<NoAccessPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  );
}
