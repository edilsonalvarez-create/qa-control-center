import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./lib/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportPage } from "./pages/ImportPage";
import { LoginPage } from "./pages/LoginPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
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
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="defects" element={<DefectsPage />} />
        <Route path="coverage" element={<CoveragePage />} />
        <Route path="evidence" element={<EvidencePage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="releases" element={<ReleasesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  );
}
