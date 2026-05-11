"use client";
import { useEffect, useState, useRef, ChangeEvent } from "react";
import { api, StatsSummary } from "@/lib/api";
import { BarChart2, TrendingUp, Upload, Download, FileText, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FORMATS = [
  { value: "csv", label: "CSV", desc: "R, Python, any tool" },
  { value: "xlsx", label: "Excel", desc: "Excel + summary sheet" },
  { value: "sav", label: "SPSS", desc: ".sav format" },
];

interface StripResult {
  strip_id: string;
  rows: number;
  rows_dropped: number;
  columns: number;
  columns_renamed: number;
  checkboxes_expanded: number;
  column_names: string[];
  preview: Record<string, string>[];
  warnings: string[];
}

interface ExportResult {
  export_id: string;
  format: string;
  row_count: number;
  column_count: number;
  download_url: string;
  filename: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pipeline_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [stripping, setStripping] = useState(false);
  const [stripResult, setStripResult] = useState<StripResult | null>(null);
  const [stripError, setStripError] = useState("");
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.getStatsSummary().then(setSummary); }, []);

  async function handleStripUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStripping(true);
    setStripError("");
    setStripResult(null);
    setExportResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/stats/strip`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Strip failed");
      setStripResult(body);
    } catch (err: unknown) {
      setStripError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setStripping(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExport() {
    if (!stripResult) return;
    setExporting(true);
    setExportResult(null);

    try {
      const res = await fetch(`${API_URL}/api/stats/export`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ strip_id: stripResult.strip_id, format }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Export failed");
      setExportResult(body);
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload() {
    if (!exportResult) return;
    const res = await fetch(`${API_URL}${exportResult.download_url}`, { headers: authHeaders() });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Stats Export</h1>
        <p className="text-sm text-gray-500 mt-1">Clean and export REDCap data for statistical analysis</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Object.keys(summary.by_modality).length > 0
            ? Object.entries(summary.by_modality).map(([key, count]) => (
                <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{key}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                  <p className="text-xs text-gray-400">in pipeline</p>
                </div>
              ))
            : null}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-xl font-bold text-gray-900">{summary.total_records}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">In REDCap</p>
              <p className="text-xl font-bold text-gray-900">{summary.imported_to_redcap}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reverse pipeline */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Reverse Pipeline — REDCap Export → Analysis</h2>
        <p className="text-xs text-gray-400 mb-5">
          Export your data from REDCap (My Projects → Data Exports), upload it here to clean and download for R / SPSS / Excel.
        </p>

        {/* Step 1: Upload */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-2">Upload REDCap export CSV</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl px-5 py-5 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:bg-gray-50 transition-colors"
            >
              <FileText className="w-7 h-7 text-gray-300 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  {stripping ? "Processing…" : "Click to select REDCap export CSV"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  From REDCap: Data Exports, Reports, and Stats → Export Data → CSV/Microsoft Excel (raw data)
                </p>
              </div>
              <button type="button" className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex-shrink-0">
                <Upload className="w-3 h-3" /> {stripping ? "…" : "Upload"}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleStripUpload} />
            </div>

            {stripError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {stripError}
              </div>
            )}

            {stripResult && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    {stripResult.rows.toLocaleString()} rows · {stripResult.columns} columns
                    {stripResult.rows_dropped > 0 && ` · ${stripResult.rows_dropped} rows filtered`}
                    {stripResult.columns_renamed > 0 && ` · ${stripResult.columns_renamed} columns renamed`}
                    {stripResult.checkboxes_expanded > 0 && ` · ${stripResult.checkboxes_expanded} checkboxes expanded`}
                  </p>
                </div>

                {stripResult.warnings.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {stripResult.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {w}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Preview table */}
                {stripResult.preview.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-green-200">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-green-100">
                          {stripResult.column_names.slice(0, 8).map((col) => (
                            <th key={col} className="text-left px-3 py-2 font-medium text-green-800 whitespace-nowrap">
                              {col.length > 20 ? col.slice(0, 20) + "…" : col}
                            </th>
                          ))}
                          {stripResult.column_names.length > 8 && (
                            <th className="px-3 py-2 text-green-600 whitespace-nowrap">
                              +{stripResult.column_names.length - 8} more
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {stripResult.preview.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-green-50"}>
                            {stripResult.column_names.slice(0, 8).map((col) => (
                              <td key={col} className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-32 truncate">
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                            {stripResult.column_names.length > 8 && <td />}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Format + Export */}
        <div className={`flex items-start gap-4 transition-opacity ${stripResult ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${stripResult ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700 mb-3">Choose format and export</p>
            <div className="flex gap-2 mb-4">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`flex-1 rounded-xl border-2 px-3 py-3 text-left transition-colors ${
                    format === f.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className={`text-sm font-semibold ${format === f.value ? "text-blue-700" : "text-gray-700"}`}>{f.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>

            {!exportResult ? (
              <button
                onClick={handleExport}
                disabled={!stripResult || exporting}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                {exporting ? "Generating…" : `Generate ${format.toUpperCase()} export`}
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">Export ready — {exportResult.filename}</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    {exportResult.row_count.toLocaleString()} rows · {exportResult.column_count} columns · {exportResult.format.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-xs font-medium bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
