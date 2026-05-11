"use client";
import { useEffect, useState } from "react";
import { api, ReviewRecord } from "@/lib/api";
import { CheckCircle, XCircle, Edit2, Save, X } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  pending_review: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function ReviewPage() {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getReview().then((res) => {
      setRecords(res.records);
      setLoading(false);
    });
  }, []);

  function startEdit(record: ReviewRecord) {
    setEditingId(record.id);
    setEditFields({ ...record.extracted });
  }

  async function saveEdit(id: string) {
    await api.updateRecord(id, editFields);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, extracted: { ...editFields } } : r))
    );
    setEditingId(null);
  }

  async function approve(id: string) {
    await api.approveRecord(id);
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
  }

  async function reject(id: string) {
    await api.rejectRecord(id);
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
  }

  const pending = records.filter((r) => r.status === "pending_review").length;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Extracted Data</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verify and edit fields before sending to REDCap
          </p>
        </div>
        {pending > 0 && (
          <span className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
            {pending} pending review
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading records…</p>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No records awaiting review.</p>
          <p className="text-gray-400 text-xs mt-1">Upload PDFs first to see extracted data here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{record.filename}</p>
                    <p className="text-xs text-gray-400">{record.modality} · {record.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[record.status] || "bg-gray-100 text-gray-600"}`}>
                    {record.status.replace("_", " ")}
                  </span>
                  {record.status === "pending_review" && (
                    <>
                      {editingId === record.id ? (
                        <>
                          <button onClick={() => saveEdit(record.id)} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                            <Save className="w-3 h-3" /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(record)} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => approve(record.id)} className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => reject(record.id)} className="flex items-center gap-1.5 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(editingId === record.id ? editFields : record.extracted).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                        {key.replace(/_/g, " ")}
                      </p>
                      {editingId === record.id ? (
                        <input
                          value={editFields[key] || ""}
                          onChange={(e) => setEditFields((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full text-sm text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{value || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
