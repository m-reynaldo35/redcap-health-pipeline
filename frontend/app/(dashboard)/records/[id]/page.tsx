"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, RecordDetail } from "@/lib/api";
import {
  ChevronLeft, Send, Download, Save, AlertCircle, CheckCircle, Loader2,
} from "lucide-react";

// ── Field metadata ────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  echo_hr: "Heart Rate", echo_height: "Height", echo_weight: "Weight",
  echo_bsa: "BSA", echo_bmi: "BMI",
  echo_ef: "Ejection Fraction",
  echo_lv_edd: "LVIDD", echo_lvidd_idx: "LVIDD Index", echo_lv_esd: "LVESD",
  echo_ivs: "Septum Diastolic", echo_pw: "Post Wall Diastolic",
  echo_e_prime_sept: "E′ Septal", echo_ee_prime_sept: "E/E′ Septal",
  echo_e_prime_lat: "E′ Lateral", echo_ee_prime_lat: "E/E′ Lateral",
  echo_ee_prime_avg: "E/E′ Average",
  echo_av_peak_vel: "Peak Velocity", echo_av_mean_vel: "Mean Velocity",
  echo_av_vti: "VTI", echo_av_peak_grad: "Peak Gradient",
  echo_av_mean_grad: "Mean Gradient", echo_av_di: "Dimensionless Index",
  echo_lvot_mean_vel: "Mean Velocity", echo_lvot_mean_grad: "Mean Gradient",
  echo_lvot_vti: "VTI",
  echo_aorta_sov: "Sinus of Valsalva", echo_aorta_asc: "Ascending Aorta",
  echo_mv_e_wave: "E-Wave", echo_mv_a_wave: "A-Wave",
  echo_mv_ea_ratio: "E/A Ratio", echo_mv_peak_grad: "Peak Gradient",
  echo_la_diameter: "Diameter", echo_la_length: "Length",
  echo_la_volume: "Volume", echo_la_vol_idx: "Volume Index",
  echo_la_dim_idx: "Dimension Index", echo_la_area_2ch: "Area (2ch)",
  echo_la_area_4ch: "Area (4ch)",
  echo_ra_area: "RA Area (A4C)", echo_ra_area_idx: "RA Area Index",
  echo_rv_basal_diam: "Basal RV Diameter", echo_tapse: "TAPSE", echo_pasp: "PASP",
  echo_date: "Study Date",
  echo_normal: "Normal Echo", echo_lv_dysfunction: "LV Dysfunction",
  echo_rv_dysfunction: "RV Dysfunction", echo_as: "Aortic Stenosis",
  echo_ar: "Aortic Regurgitation", echo_mr: "Mitral Regurgitation",
  echo_lvh: "LV Hypertrophy", echo_dilated_la: "Dilated LA",
  echo_diastolic_dysfunction: "Diastolic Dysfunction", echo_suboptimal: "Suboptimal Study",
};

const FIELD_UNITS: Record<string, string> = {
  echo_hr: "bpm", echo_height: "cm", echo_weight: "kg", echo_bsa: "m²", echo_bmi: "kg/m²",
  echo_ef: "%",
  echo_lv_edd: "cm", echo_lvidd_idx: "cm/m²", echo_lv_esd: "mm", echo_ivs: "cm", echo_pw: "cm",
  echo_e_prime_sept: "m/s", echo_e_prime_lat: "m/s",
  echo_av_peak_vel: "m/s", echo_av_mean_vel: "m/s", echo_av_vti: "cm",
  echo_av_peak_grad: "mmHg", echo_av_mean_grad: "mmHg",
  echo_lvot_mean_vel: "m/s", echo_lvot_mean_grad: "mmHg", echo_lvot_vti: "cm",
  echo_aorta_sov: "cm", echo_aorta_asc: "cm",
  echo_mv_e_wave: "m/s", echo_mv_a_wave: "m/s", echo_mv_peak_grad: "mmHg",
  echo_la_diameter: "cm", echo_la_length: "cm", echo_la_volume: "ml",
  echo_la_vol_idx: "ml/m²", echo_la_dim_idx: "cm/m²",
  echo_la_area_2ch: "cm²", echo_la_area_4ch: "cm²",
  echo_ra_area: "cm²", echo_ra_area_idx: "cm²/m²",
  echo_rv_basal_diam: "cm", echo_tapse: "cm", echo_pasp: "mmHg",
};

const CHECKBOX_FIELDS = new Set([
  "echo_normal", "echo_lv_dysfunction", "echo_rv_dysfunction", "echo_as",
  "echo_ar", "echo_mr", "echo_lvh", "echo_dilated_la", "echo_diastolic_dysfunction",
  "echo_suboptimal",
]);

// Ordered sections — fields not listed here fall into "Other"
const SECTIONS: Array<{ label: string; fields: string[] }> = [
  { label: "Vitals", fields: ["echo_hr", "echo_height", "echo_weight", "echo_bsa", "echo_bmi"] },
  { label: "LV Function", fields: ["echo_ef", "echo_lv_edd", "echo_lvidd_idx", "echo_lv_esd", "echo_ivs", "echo_pw"] },
  { label: "Diastolic Function", fields: ["echo_e_prime_sept", "echo_ee_prime_sept", "echo_e_prime_lat", "echo_ee_prime_lat", "echo_ee_prime_avg"] },
  { label: "Aortic Valve", fields: ["echo_av_peak_vel", "echo_av_mean_vel", "echo_av_vti", "echo_av_peak_grad", "echo_av_mean_grad", "echo_av_di"] },
  { label: "LVOT", fields: ["echo_lvot_mean_vel", "echo_lvot_mean_grad", "echo_lvot_vti"] },
  { label: "Aorta", fields: ["echo_aorta_sov", "echo_aorta_asc"] },
  { label: "Mitral Valve", fields: ["echo_mv_e_wave", "echo_mv_a_wave", "echo_mv_ea_ratio", "echo_mv_peak_grad"] },
  { label: "Left Atrium", fields: ["echo_la_diameter", "echo_la_length", "echo_la_volume", "echo_la_vol_idx", "echo_la_dim_idx", "echo_la_area_2ch", "echo_la_area_4ch"] },
  { label: "Right Atrium", fields: ["echo_ra_area", "echo_ra_area_idx"] },
  { label: "Right Ventricle", fields: ["echo_rv_basal_diam", "echo_tapse", "echo_pasp"] },
  { label: "Findings", fields: ["echo_normal", "echo_lv_dysfunction", "echo_rv_dysfunction", "echo_as", "echo_ar", "echo_mr", "echo_lvh", "echo_dilated_la", "echo_diastolic_dysfunction", "echo_suboptimal"] },
  { label: "Report Info", fields: ["echo_date"] },
];

const ALL_SECTION_FIELDS = new Set(SECTIONS.flatMap((s) => s.fields));

function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/^(echo|ecg|ct|mri)_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  exported:       "bg-green-100 text-green-700",
  export_failed:  "bg-red-100 text-red-700",
  imported:       "bg-green-100 text-green-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api.getRecord(id).then((rec) => {
      setRecord(rec);
      setFields(rec.extracted);
    }).catch(() => router.replace("/records"));
  }, [id, router]);

  function onChange(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateRecord(id, fields);
      setDirty(false);
      setMsg({ type: "ok", text: "Changes saved." });
    } catch {
      setMsg({ type: "err", text: "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  async function exportToRedcap() {
    setExporting(true);
    setMsg(null);
    try {
      const res = await api.exportToRedcap([id]);
      const ok = res.imported > 0;
      setMsg({ type: ok ? "ok" : "err", text: ok ? "Exported to REDCap successfully." : `Export failed: ${res.results[0]?.message ?? "unknown error"}` });
      if (ok) setRecord((r) => r ? { ...r, status: "exported" } : r);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setExporting(false);
    }
  }

  async function downloadCsv() {
    try {
      await api.downloadCsv([id]);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "CSV download failed" });
    }
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Build sections — only show sections that have at least one non-empty field in this record
  const otherFields = Object.keys(fields).filter((k) => !ALL_SECTION_FIELDS.has(k));
  const sectionsToRender = [
    ...SECTIONS,
    ...(otherFields.length ? [{ label: "Other", fields: otherFields }] : []),
  ].filter((s) => s.fields.some((k) => k in fields));

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link href="/records" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
          <ChevronLeft className="w-4 h-4" /> Records
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{record.filename}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>{record.modality}</span>
              <span>·</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[record.status] ?? "bg-gray-100 text-gray-600"}`}>
                {record.status.replace(/_/g, " ")}
              </span>
              {record.imported_at && (
                <>
                  <span>·</span>
                  <span>Exported {new Date(record.imported_at).toLocaleDateString("en-IE")}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save changes
              </button>
            )}
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={exportToRedcap}
              disabled={exporting}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Export to REDCap
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {msg.type === "ok"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {msg.text}
          </div>
        )}

        {record.warnings?.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{record.warnings.join(" · ")}</span>
          </div>
        )}
      </div>

      {/* ── Field sections ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {sectionsToRender.map((section) => {
          const sectionFields = section.fields.filter((k) => k in fields);
          if (!sectionFields.length) return null;
          return (
            <div key={section.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{section.label}</h2>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sectionFields.map((key) => {
                  const val = fields[key] ?? "";
                  const isCheckbox = CHECKBOX_FIELDS.has(key);
                  const unit = FIELD_UNITS[key];
                  return (
                    <div key={key} className="space-y-1">
                      <label className="block text-xs font-medium text-gray-400">
                        {fieldLabel(key)}
                        {unit && <span className="text-gray-300 ml-1">({unit})</span>}
                      </label>
                      {isCheckbox ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={val === "1"}
                            onChange={(e) => onChange(key, e.target.checked ? "1" : "0")}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${val === "1" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>
                            {val === "1" ? "Yes" : "No"}
                          </span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => onChange(key, e.target.value)}
                          className="w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
