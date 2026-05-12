"use client";
import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, CloudUpload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const MODALITIES = ["ECG", "Echo", "CT", "MRI"] as const;
type Modality = (typeof MODALITIES)[number];

interface FileItem {
  file: File;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
}

export default function UploadPage() {
  const [modality, setModality] = useState<Modality>("ECG");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ uploaded: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...pdfs.map((f) => ({ file: f, status: "ready" as const }))]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setResult(null);
    setUploadError(null);
    try {
      const res = await api.upload(files.map((f) => f.file), modality);
      setFiles((prev) => prev.map((f) => ({ ...f, status: "done" as const })));
      setResult({ uploaded: res.uploaded });
    } catch (err) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const })));
      setUploadError(err instanceof Error ? err.message : "Upload failed — check console for details");
    } finally {
      setUploading(false);
    }
  }

  const readyCount = files.filter((f) => f.status === "ready").length;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag and drop PDF reports to extract clinical data
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Select modality</p>
        <div className="flex gap-2">
          {MODALITIES.map((m) => (
            <button
              key={m}
              onClick={() => setModality(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                modality === m
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`bg-white rounded-2xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center py-16 mb-6 ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <CloudUpload className={`w-12 h-12 mb-4 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
        <p className="text-sm font-medium text-gray-700">Drop PDF files here</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{files.length} file{files.length !== 1 ? "s" : ""} selected</p>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear all
            </button>
          </div>
          <ul className="divide-y divide-gray-100">
            {files.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">{item.file.name}</span>
                <span className="text-xs text-gray-400">
                  {(item.file.size / 1024).toFixed(0)} KB
                </span>
                {item.status === "done" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {item.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                {item.status === "ready" && (
                  <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-gray-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
          <CheckCircle className="w-4 h-4" />
          {result.uploaded} file{result.uploaded !== 1 ? "s" : ""} uploaded successfully. Head to <strong className="ml-1">Review</strong> to check extracted data.
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={readyCount === 0 || uploading}
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="w-4 h-4" />
        {uploading ? "Uploading…" : `Upload ${readyCount > 0 ? readyCount : ""} file${readyCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
