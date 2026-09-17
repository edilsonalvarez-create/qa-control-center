import { useState } from "react";
import { Upload } from "lucide-react";
import { api } from "../lib/api";

interface EvidenceUrlInputProps {
  testRunId: string;
  onSuccess: () => void;
}

export function EvidenceUrlInput({ testRunId, onSuccess }: EvidenceUrlInputProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    try {
      await api(`/api/v1/test-runs/${testRunId}`, {
        method: "PATCH",
        body: JSON.stringify({ evidenceUrl: url }),
      });
      setSuccess(true);
      setUrl("");
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm font-medium">Google Sheets Evidence URL</label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          <Upload size={16} />
          {loading ? "Loading..." : "Sync"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {success && <p className="text-xs text-green-600">Evidence synced successfully!</p>}
    </form>
  );
}
