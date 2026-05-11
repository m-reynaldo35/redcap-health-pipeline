"use client";
import { useEffect, useState, FormEvent } from "react";
import { api, StatsSummary, ExportResult } from "@/lib/api";
import { BarChart2, Download, TrendingUp } from "lucide-react";

const MODALITIES = ["All", "ECG", "Echo", "CT", "MRI"];
const FORMATS = ["csv", "xlsx", "sav"];

export default function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [modality, setModality] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    api.getStatsSummary().then(setSummary);
  }, []);

  async function handleExport(e: FormEvent) {
    e.preventDefault();
    setExporting(true);
    setResult(null);
    try {
      const res = await api.exportStats({
        modality: modality !== "All" ? modality : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        format,
      });
      setResult(res);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Stats Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export clean datasets for R, SPSS, or Excel analysis
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Object.entries(summary.by_modality).map(([key, count]) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{key}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              <p className="text-xs text-gray-400">records</p>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Records</p>
              <p className="text-xl font-bold text-gray-900">{summary.total_records}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">In REDCap</p>
              <p className="text-xl font-bold text-gray-900">{summary.imported_to_redcap}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-5">Generate Export</h2>
        <form onSubmit={handleExport} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Modality
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODALITIES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Date from
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Date to
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={exporting}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Preparing export…" : "Generate export"}
          </button>
        </form>

        {result && (
          <div className="mt-5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Export ready</p>
              <p className="text-xs text-green-600">
                {result.record_count} records · {result.modality} · {result.format.toUpperCase()}
              </p>
            </div>
            <a
              href={`http://localhost:8000${result.download_url}`}
              className="flex items-center gap-1.5 text-xs font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
            >
              <Download className="w-3 h-3" /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
