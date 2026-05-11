"use client";
import { useEffect, useState } from "react";
import { api, HistoryRecord } from "@/lib/api";
import { Search, Filter } from "lucide-react";

const MODALITIES = ["All", "ECG", "Echo", "CT", "MRI"];
const STATUSES = ["All", "imported", "pending_review", "rejected"];

const STATUS_BADGE: Record<string, string> = {
  imported: "bg-green-100 text-green-800",
  pending_review: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
};

export default function RecordsPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("All");
  const [status, setStatus] = useState("All");

  useEffect(() => {
    const params = {
      ...(modality !== "All" ? { modality } : {}),
      ...(status !== "All" ? { status } : {}),
      ...(search ? { search } : {}),
    };
    setLoading(true);
    api.getRecords(params).then((res) => {
      setRecords(res.records);
      setLoading(false);
    });
  }, [search, modality, status]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Records</h1>
        <p className="text-sm text-gray-500 mt-1">All processed records and their import status</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MODALITIES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 px-6 py-8">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500 px-6 py-8">No records found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Filename</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Modality</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">REDCap ID</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-6 py-3">Imported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{r.filename}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.modality}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status] || "bg-gray-100 text-gray-600"}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm font-mono text-gray-500">{r.redcap_id || "—"}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {r.imported_at ? new Date(r.imported_at).toLocaleDateString("en-IE") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="px-6 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
  );
}
