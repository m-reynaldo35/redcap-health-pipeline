"use client";
import { useState, useRef, useEffect, DragEvent, ChangeEvent, useCallback } from "react";
import Link from "next/link";
import { api, HistoryRecord } from "@/lib/api";
import {
  CloudUpload, Send, Download, Search, Filter,
  ChevronRight, AlertCircle, CheckCircle, Loader2,
} from "lucide-react";

const MODALITIES = ["ECG", "Echo", "CT", "MRI"] as const;
type Modality = (typeof MODALITIES)[number];

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  exported:       "bg-green-100 text-green-700",
  export_failed:  "bg-red-100 text-red-700",
  imported:       "bg-green-100 text-green-700",
  approved:       "bg-blue-100 text-blue-700",
  rejected:       "bg-red-100 text-red-700",
};

export default function RecordsPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModality, setFilterModality] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const [modality, setModality] = useState<Modality>("Echo");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchRecords = useCallback(() => {
    const params = {
      ...(filterModality !== "All" ? { modality: filterModality } : {}),
      ...(filterStatus !== "All" ? { status: filterStatus } : {}),
      ...(search ? { search } : {}),
    };
    setLoading(true);
    api.getRecords(params).then((res) => {
      setRecords(res.records);
      setLoading(false);
    });
  }, [filterModality, filterStatus, search]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Upload ────────────────────────────────────────────────────────────────
  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) return;
    handleUpload(pdfs);
  }

  async function handleUpload(files: File[]) {
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await api.upload(files, modality);
      setUploadMsg({ type: "ok", text: `${res.uploaded} file${res.uploaded !== 1 ? "s" : ""} uploaded — extracted and ready to review.` });
      fetchRecords();
    } catch (err) {
      setUploadMsg({ type: "err", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  const allIds = records.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function exportToRedcap(ids: string[]) {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await api.exportToRedcap(ids);
      const msg = `${res.imported} exported to REDCap${res.failed ? `, ${res.failed} failed` : ""}.`;
      setExportMsg({ type: res.failed > 0 ? "err" : "ok", text: msg });
      fetchRecords();
      setSelected(new Set());
    } catch (err) {
      setExportMsg({ type: "err", text: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setExporting(false);
    }
  }

  async function downloadCsv(ids?: string[]) {
    try {
      await api.downloadCsv(ids);
    } catch (err) {
      setExportMsg({ type: "err", text: err instanceof Error ? err.message : "CSV download failed" });
    }
  }

  const selectedArr = Array.from(selected);
  const hasSelection = selectedArr.length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Upload zone ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold text-gray-900">Records</h1>
          {uploading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">Modality:</span>
          {MODALITIES.map((m) => (
            <button
              key={m}
              onClick={() => setModality(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                modality === m ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl cursor-pointer flex items-center justify-center gap-3 py-6 transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <CloudUpload className={`w-6 h-6 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
          <p className="text-sm text-gray-500">
            Drop <span className="font-medium text-gray-700">{modality}</span> PDFs here, or{" "}
            <span className="text-blue-600 font-medium">click to browse</span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
          />
        </div>

        {uploadMsg && (
          <div className={`mt-2 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
            uploadMsg.type === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {uploadMsg.type === "ok"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {uploadMsg.text}
          </div>
        )}
      </div>

      {/* ── Export feedback ──────────────────────────────────────────────── */}
      {exportMsg && (
        <div className={`mb-4 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
          exportMsg.type === "ok"
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {exportMsg.type === "ok"
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {exportMsg.text}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          {hasSelection ? (
            <>
              <span className="text-sm font-medium text-gray-700">
                {selectedArr.length} selected
              </span>
              <button
                onClick={() => exportToRedcap(selectedArr)}
                disabled={exporting}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Export to REDCap
              </button>
              <button
                onClick={() => downloadCsv(selectedArr)}
                className="flex items-center gap-1.5 text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-gray-400 hover:text-gray-600 ml-auto"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search filename…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterModality}
                  onChange={(e) => setFilterModality(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["All", ...MODALITIES].map((m) => <option key={m}>{m}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["All", "pending_review", "exported", "export_failed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {records.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => exportToRedcap(allIds)}
                    disabled={exporting}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Export all
                  </button>
                  <button
                    onClick={() => downloadCsv()}
                    className="flex items-center gap-1.5 text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV all
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-400 px-6 py-10">Loading…</p>
        ) : records.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No records yet.</p>
            <p className="text-xs text-gray-400 mt-1">Drop a PDF above to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Filename</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Modality</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Fields</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => (
                <tr
                  key={r.id}
                  className={`transition-colors ${selected.has(r.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-xs truncate">
                    {r.filename}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.modality}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.imported_at
                      ? new Date(r.imported_at).toLocaleDateString("en-IE")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {r.warnings !== undefined ? `${(r as any).field_count ?? "—"}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/records/${r.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </Link>
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
