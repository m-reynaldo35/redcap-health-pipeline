"use client";
import { useEffect, useState, FormEvent, useRef, ChangeEvent } from "react";
import { api, AppSettings } from "@/lib/api";
import { Save, CheckCircle, Eye, EyeOff, Upload, FileText, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DDStatus {
  loaded: boolean;
  field_count: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({ redcap_url: "", redcap_token: "", redcap_project_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const [ddStatus, setDDStatus] = useState<DDStatus>({ loaded: false, field_count: 0 });
  const [ddUploading, setDDUploading] = useState(false);
  const [ddMessage, setDDMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const ddInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.getSettings(), fetchDDStatus()]).then(([s]) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  async function fetchDDStatus() {
    const token = localStorage.getItem("pipeline_token");
    const res = await fetch(`${API_URL}/api/settings/data-dictionary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) setDDStatus(await res.json());
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await api.updateSettings({ ...settings, ...(token ? { redcap_token: token } : {}) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleDDUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDDUploading(true);
    setDDMessage(null);
    const form = new FormData();
    form.append("file", file);
    const authToken = localStorage.getItem("pipeline_token");
    try {
      const res = await fetch(`${API_URL}/api/settings/data-dictionary`, {
        method: "POST",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: form,
      });
      const body = await res.json();
      if (res.ok) {
        setDDMessage({ type: "success", text: `Loaded ${body.field_count} fields from Data Dictionary` });
        setDDStatus({ loaded: true, field_count: body.field_count });
      } else {
        setDDMessage({ type: "error", text: body.detail || "Upload failed" });
      }
    } catch {
      setDDMessage({ type: "error", text: "Upload failed — check the backend is running" });
    } finally {
      setDDUploading(false);
      if (ddInputRef.current) ddInputRef.current.value = "";
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading settings…</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure REDCap connection and field validation</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-800">REDCap Connection</h2>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">REDCap URL</label>
            <input
              type="url"
              value={settings.redcap_url}
              onChange={(e) => setSettings((s) => ({ ...s, redcap_url: e.target.value }))}
              placeholder="https://your-institution.redcap.example.com/api/"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">API Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={settings.redcap_token ? "Leave blank to keep existing token" : "Enter your REDCap API token"}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {settings.redcap_token && <p className="text-xs text-gray-400 mt-1">A token is currently set.</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Project ID <span className="normal-case text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={settings.redcap_project_id}
              onChange={(e) => setSettings((s) => ({ ...s, redcap_project_id: e.target.value }))}
              placeholder="e.g. 1234"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </form>

      {/* Data Dictionary */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">REDCap Data Dictionary</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Export from REDCap → Project Setup → Data Dictionary. Used to validate extracted fields.
            </p>
          </div>
          {ddStatus.loaded && (
            <span className="flex items-center gap-1.5 text-xs font-medium bg-green-100 text-green-800 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3 h-3" /> {ddStatus.field_count} fields loaded
            </span>
          )}
        </div>

        <div
          onClick={() => ddInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl px-5 py-6 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-8 h-8 text-gray-300 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              {ddStatus.loaded ? "Replace Data Dictionary" : "Upload Data Dictionary CSV"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Click to select — exported from REDCap as CSV</p>
          </div>
          <input ref={ddInputRef} type="file" accept=".csv" className="hidden" onChange={handleDDUpload} />
          <button type="button"
            className="ml-auto flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex-shrink-0">
            <Upload className="w-3 h-3" />
            {ddUploading ? "Uploading…" : "Upload"}
          </button>
        </div>

        {ddMessage && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            ddMessage.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {ddMessage.type === "success"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {ddMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
