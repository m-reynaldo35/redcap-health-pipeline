"use client";
import { useEffect, useState } from "react";
import { api, ReviewRecord, ImportResult } from "@/lib/api";
import { Send, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [approved, setApproved] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getReview().then((res) => {
      const a = res.records.filter((r) => r.status === "approved");
      setApproved(a);
      setSelected(new Set(a.map((r) => r.id)));
      setLoading(false);
    });
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!selected.size) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.importRecords(Array.from(selected));
      setResult(res);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">REDCap Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send approved records directly to REDCap via API
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading approved records…</p>
      ) : approved.length === 0 && !result ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No approved records ready to import.</p>
          <p className="text-gray-400 text-xs mt-1">Approve records on the Review page first.</p>
        </div>
      ) : (
        <>
          {approved.length > 0 && !result && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {approved.length} approved record{approved.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() =>
                    setSelected(
                      selected.size === approved.length
                        ? new Set()
                        : new Set(approved.map((r) => r.id))
                    )
                  }
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {selected.size === approved.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="divide-y divide-gray-100">
                {approved.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.filename}</p>
                      <p className="text-xs text-gray-400">{r.modality}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      approved
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!result && (
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
            >
              <Send className="w-4 h-4" />
              {importing
                ? "Importing…"
                : `Send ${selected.size} record${selected.size !== 1 ? "s" : ""} to REDCap`}
            </button>
          )}

          {result && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Import complete</p>
                  <p className="text-xs text-gray-400">
                    {result.imported} imported · {result.failed} failed · Batch: {result.batch_id}
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {result.results.map((r) => (
                  <li key={r.record_id} className="flex items-center gap-3 px-6 py-3">
                    {r.status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{r.record_id}</p>
                      <p className="text-xs text-gray-400">{r.message}</p>
                    </div>
                    {r.redcap_id && (
                      <span className="text-xs font-mono text-gray-500">{r.redcap_id}</span>
                    )}
                  </li>
                ))}
              </ul>
              {result.failed > 0 && (
                <div className="px-6 py-3 bg-red-50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-xs text-red-700">
                    {result.failed} record{result.failed !== 1 ? "s" : ""} failed — check REDCap configuration in Settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
