import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@qacc.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <form
        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await login(email, password);
            nav("/");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">QA Operations</p>
        <h1 className="mt-2 text-2xl font-bold">QA Control Center</h1>
        <p className="mt-2 text-sm text-slate-400">Estado de pruebas, defectos y evidencias — sin datos inventados.</p>
        <label className="mt-6 block text-sm">Email</label>
        <input className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="mt-4 block text-sm">Password</label>
        <input type="password" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        <button className="mt-6 w-full rounded-xl bg-cyan-600 py-2.5 font-semibold text-white">Entrar</button>
      </form>
    </div>
  );
}
