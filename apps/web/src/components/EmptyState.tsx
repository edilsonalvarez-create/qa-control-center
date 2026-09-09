export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 max-w-lg text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}
