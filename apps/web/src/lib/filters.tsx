import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({});
  const query = useMemo(() => ({ ...filters }), [filters]);
  return <C.Provider value={{ filters, setFilters, query }}>{children}</C.Provider>;
}

export function useFilters() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("filters");
  return ctx;
}
