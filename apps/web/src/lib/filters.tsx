import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type Filters = {
  projectId?: string;
  moduleId?: string;
  from?: string;
  to?: string;
  tester?: string;
  testType?: string;
  environment?: string;
  result?: string;
  severity?: string;
  version?: string;
};

type Ctx = {
  filters: Filters;
  setFilters: (f: Filters) => void;
  query: Record<string, string | undefined>;
};

const C = createContext<Ctx | null>(null);

function filterScope(pathname: string) {
  if (pathname.startsWith("/runs")) return "runs";
  return pathname;
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const scope = filterScope(pathname);
  const [byScope, setByScope] = useState<Record<string, Filters>>({});
  const filters = byScope[scope] ?? {};
  const setFilters = (next: Filters) => setByScope((prev) => ({ ...prev, [scope]: next }));
  const query = useMemo(() => ({ ...filters }), [filters]);
  return <C.Provider value={{ filters, setFilters, query }}>{children}</C.Provider>;
}

export function useFilters() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("filters");
  return ctx;
}
