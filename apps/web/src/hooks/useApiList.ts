import { useEffect, useState } from "react";
import { api } from "../lib/api";

/** Fetch a list endpoint, exposing rows/error plus a manual reload for after a mutation. */
export function useApiList<T>(path: string, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const reload = () => api<T[]>(path).then(setRows).catch((e) => setError((e as Error).message));
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { rows, error, reload };
}
