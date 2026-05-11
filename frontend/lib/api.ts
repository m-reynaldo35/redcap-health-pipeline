const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("pipeline_token")
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (res.status === 401) {
    localStorage.removeItem("pipeline_token")
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

export const api = {
  login: (passcode: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ passcode }),
    }),

  me: () => request<{ user: string }>("/auth/me"),

  upload: async (files: File[], modality: string) => {
    const token = getToken()
    const form = new FormData()
    files.forEach((f) => form.append("files", f))
    form.append("modality", modality)
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) throw new Error("Upload failed")
    return res.json()
  },

  getReview: () => request<{ records: ReviewRecord[]; total: number }>("/api/review"),
  updateRecord: (id: string, fields: Record<string, string>) =>
    request<{ id: string; updated: boolean }>(`/api/review/${id}`, {
      method: "PUT",
      body: JSON.stringify({ fields }),
    }),
  approveRecord: (id: string) =>
    request<{ id: string; status: string }>(`/api/review/${id}/approve`, { method: "POST" }),
  rejectRecord: (id: string) =>
    request<{ id: string; status: string }>(`/api/review/${id}/reject`, { method: "POST" }),

  importRecords: (record_ids: string[]) =>
    request<ImportResult>("/api/import", {
      method: "POST",
      body: JSON.stringify({ record_ids }),
    }),

  getRecords: (params?: { modality?: string; status?: string; search?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v))
    ).toString()
    return request<{ records: HistoryRecord[]; total: number }>(
      `/api/records${qs ? `?${qs}` : ""}`
    )
  },

  exportStats: (body: { modality?: string; date_from?: string; date_to?: string; format: string }) =>
    request<ExportResult>("/api/stats/export", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getStatsSummary: () => request<StatsSummary>("/api/stats/summary"),

  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (settings: Partial<AppSettings>) =>
    request<{ status: string }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
}

export interface ReviewRecord {
  id: string
  filename: string
  modality: string
  status: string
  extracted: Record<string, string>
}

export interface HistoryRecord {
  id: string
  filename: string
  modality: string
  status: string
  redcap_id: string | null
  imported_at: string | null
}

export interface ImportResult {
  batch_id: string
  imported: number
  failed: number
  results: Array<{ record_id: string; status: string; redcap_id: string; message: string }>
}

export interface ExportResult {
  export_id: string
  status: string
  format: string
  modality: string
  record_count: number
  download_url: string
}

export interface StatsSummary {
  total_records: number
  by_modality: Record<string, number>
  imported_to_redcap: number
  pending_review: number
}

export interface AppSettings {
  redcap_url: string
  redcap_token: string
  redcap_project_id: string
}
