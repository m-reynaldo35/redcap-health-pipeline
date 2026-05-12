# REDCap Health Pipeline — Project Roadmap

## Overview

A full-stack web application for clinical researchers to extract data from hospital PDF reports
(ECG, Echo, CT, MRI), review and edit extracted fields, and export directly into REDCap via API.
Also includes a reverse pipeline to export REDCap data for statistical analysis of Irish population
health screening data. A small number of authorised researchers access the tool via a shared passcode.

---

## Compliance & Data Governance (Pre-requisite)

Before any data is processed in a live setting:

- [ ] GDPR / DPIA completed with your institution
- [ ] De-identification protocol agreed (strip name, DOB, MRN before processing)
- [ ] REDCap project structure finalised (instruments + variable names confirmed)
- [ ] Data Dictionary exported from REDCap (provides exact field/variable names)
- [ ] Ethics approval in place for genetic health screening study
- [ ] Confirm REDCap version at your institution (determines available API features)
- [ ] REDCap standard user API token obtained for the project
- [ ] Change placeholder `PIPELINE_PASSCODE` and `SECRET_KEY` in `backend/.env`

---

## Architecture

```
FORWARD PIPELINE (Hospital PDFs → REDCap)

  [Module 0] Web Application (Next.js + FastAPI)
      ↓ researcher drags and drops PDFs
  [Module 1] PDF Inspector        — understand PDF structure per modality
      ↓
  [Module 2] Extractors           — pull data points per modality (YAML-driven)
      ↓
  [Module 3] Field Mapper         — map extracted data → REDCap variable names
      ↓
  [Module 4a] REDCap API Export   — POST records directly via standard user token
  [Module 4b] CSV Export          — download if API unavailable (air-gapped use)

REVERSE PIPELINE (REDCap → Statistics)

  [Module 5] REDCap Stripper      — clean and reshape exported REDCap data
      ↓
  [Module 6] Stats Exporter       — output analysis-ready CSV / Excel / SPSS
      ↓
  Statistical tools (R, SPSS, Python pandas)

FUTURE — Phase 2

  [Module 7] DICOM Analyser       — raw CT / MRI image analysis
  [Module 8] Raw ECG Analyser     — ECG signal processing from raw data
  [Module 9] Portable USB App     — PyInstaller .exe for use on hospital computers
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js + Tailwind CSS | Clean, modern UI; researchers access via URL |
| Backend | FastAPI (Python) | Keeps all extraction/mapping logic in Python |
| Auth | Shared passcode + JWT session token | Small team, simple and secure |
| PDF parsing | `pdfplumber` | Best for text + table extraction from machine-readable PDFs |
| Config format | YAML | Human-editable field mappings without touching code |
| Database | SQLite (`pipeline.db`) | Persistent, file-based, no setup — ideal for USB deployment |
| REDCap import | POST /api/ with `content=record`, `format=json` | Fully automated |
| CSV fallback | `POST /api/export/csv` | Streams CSV for selected or all records |
| Hosting | Railway (backend) + Vercel (frontend) | Simple private deployment |
| Python version | 3.11+ | Type hints, match statements |
| Data handling | SQLite on server; never write unencrypted patient data to client disk | GDPR |

---

## Module Breakdown

### Module 0 — Web Application Shell ✅ Complete
**Purpose:** The researcher-facing interface. Two-page design replacing the original 4-page flow.

**Pages:**

| Page | Purpose |
|------|---------|
| Login | Shared passcode → JWT; only authorised researchers access |
| Records (library) | Drag-and-drop upload + full record table with checkboxes, bulk export, filter/search |
| Records / [id] (detail) | All extracted fields grouped by clinical section; inline editing; Export to REDCap + CSV |
| Stats Export | Select modality and date range; download CSV / Excel / SPSS |
| Settings | REDCap URL, API token, field mapping config |

**User flow:**
```
1. Researcher opens app URL → logs in with passcode
2. Selects modality (Echo), drags PDF onto Records page
3. File appears in table instantly with status "pending review"
4. Clicks "Open" → detail view shows all 51 extracted fields grouped by section
5. Spot-checks and edits any incorrect values inline, saves
6. Clicks "Export to REDCap" (single record) or returns to library
   and uses checkboxes to export a batch
7. Status updates to "exported" — done
```

**Notes:**
- Drag-and-drop accepts `.pdf` by name as well as MIME type (fixes Linux file manager behaviour)
- Records persist in SQLite across server restarts
- Export does not require prior approval step — export directly from any record

---

### Module 1 — PDF Inspector ✅ Complete
**Purpose:** Inspect a PDF and output its full structure — text blocks, tables, layout.
Used during development to understand each hospital's report format before writing extractors.
Exposed as a developer utility via `POST /api/inspect`.

**Key tool:** `pdfplumber`

---

### Module 2 — Extractors ✅ Complete

Each extractor reads a PDF and returns a structured Python dict of data points.
Field patterns are defined in YAML config files (one per modality) — no hardcoding in Python.

#### 2a — ECG Extractor
Data points: Heart rate, PR interval, QRS duration, QT/QTc, P/QRS/T axis, rhythm, report date
Checkboxes: Normal ECG, LBBB, RBBB, AF, ST elevation/depression, LVH
Config: `backend/config/ecg_fields.yaml`

#### 2b — Echocardiogram Extractor ✅ Tuned against St. James's Hospital TTE (2026-05-12)
**51 fields extracted** from real hospital PDFs. Verified with `pdfplumber` on a St. James's
Cardiology Department TTE report (two-column table layout).

Sections covered:
- Vitals: HR, height, weight, BSA, BMI
- LV Function: EF, LVIDD, LVIDD index, LVESD, septum diastolic, post wall diastolic
- Diastolic Function: E′ septal/lateral, E/E′ septal/lateral/average
- Aortic Valve: peak/mean velocity, VTI, peak/mean gradient, dimensionless index
- LVOT: mean velocity, mean gradient, VTI (anchored to avoid AV collision)
- Aorta: sinus of Valsalva, ascending aorta
- Mitral Valve: E-wave, A-wave, E/A ratio, peak gradient
- Left Atrium: diameter, length, volume, volume index, dimension index, area 2ch/4ch
- Right Atrium: RA area, RA area index
- Right Ventricle: basal RV diameter, TAPSE, PASP
- Findings (checkboxes): normal echo, LV/RV dysfunction, aortic stenosis/regurgitation,
  mitral regurgitation, LV hypertrophy, dilated LA, diastolic dysfunction, suboptimal study

Config: `backend/config/echo_fields.yaml`

**Outstanding:** Tune patterns against ECG, CT, MRI real hospital PDFs when samples available.
Provide sample PDFs in `sample_pdfs/` to calibrate YAML patterns.

#### 2c — CT Extractor
Config: `backend/config/ct_fields.yaml`
Status: Basic patterns in place — needs tuning against real CT reports.

#### 2d — MRI Extractor
Config: `backend/config/mri_fields.yaml`
Status: Basic patterns in place — needs tuning against real MRI reports.

---

### Module 3 — Field Mapper ✅ Complete
**Purpose:** Translates raw extracted values into REDCap-compatible format.
Handles: data type coercion, date format normalisation (DD/MM/YYYY → YYYY-MM-DD),
checkbox encoding (`1` = ticked, `0` = unticked).

Upload REDCap Data Dictionary CSV in Settings for full variable name validation.

---

### Module 4a — REDCap API Export ✅ Complete
**Purpose:** Posts mapped records directly to REDCap via the standard user API token.

**Endpoint:** `POST /api/import` with `{ record_ids: [...] }`
**Status flow:** `pending_review` → `exported` (success) or `export_failed`
**Note:** REDCap URL and API token must be configured in Settings before use.

---

### Module 4b — CSV Export ✅ Complete
**Purpose:** Streams a REDCap-compatible CSV for download — for air-gapped use or manual upload
via REDCap Data Import Tool.

**Endpoint:** `POST /api/export/csv` with `{ record_ids: [...] }` (or `null` for all records)
**Output:** `redcap_export.csv` — columns: record metadata + all extracted field names

---

### Module 5 — REDCap Stripper ✅ Complete
**Purpose:** Takes a raw REDCap data export (CSV) and cleans it for statistical analysis.
Renames variables to human-readable labels, expands checkbox columns, handles missing data.

**Endpoint:** `POST /api/stats/strip`

---

### Module 6 — Stats Exporter ✅ Complete
**Purpose:** Produces analysis-ready outputs from stripped REDCap data.

**Outputs:**
- Per-modality CSVs (`stats_ecg.csv`, `stats_echo.csv`, etc.)
- `summary_statistics.xlsx` (one sheet per modality)
- Optional `.sav` SPSS format via `pyreadstat`

**Endpoint:** `POST /api/stats/export`

---

### Module 7 — DICOM Analyser (Phase 2)
**Purpose:** Parse raw CT and MRI DICOM files and extract structured measurements for REDCap import.
Replaces reliance on PDF reports for imaging modalities.

**Options explored:**
- `pydicom` — reads DICOM Structured Reports (SR); many echo machines embed all measurements
  (LVIDD, TAPSE, E/E′, LA volumes) in DICOM SR alongside the report PDF. If the hospital
  exports DICOM SR files, this could replace PDF extraction entirely for echo.
- `EchoNet-Dynamic` (Stanford, open source) — deep learning EF estimation from echo video

**Status:** Future — not started

---

### Module 8 — Raw ECG Signal Analyser (Phase 2)
**Purpose:** Process raw ECG signal files (XML, SCP-ECG, EDF) and extract intervals,
rhythm classification, and morphology findings programmatically.

**Key tools:** `neurokit2`, `biosppy`
**Status:** Future — not started

---

### Module 9 — Portable USB Application (Phase 2)
**Purpose:** Bundle the full application (FastAPI backend + static Next.js frontend) into a
single Windows executable loadable from a USB drive. Solves the problem of hospital computers
being on a closed network — researcher plugs in USB, double-clicks `.exe`, browser opens to
`localhost:8000`, processes PDFs locally, exports CSV to USB for REDCap upload on a
networked machine.

**Approach:** PyInstaller bundles backend + static frontend build into a single `.exe`.
No installation or admin rights required. Data written to USB or OS temp folder.

**Considerations:**
- Patient data on USB: use encrypted USB or configure app to wipe temp files on exit
- CSV export used as REDCap fallback (direct API import not available air-gapped)
- Windows target (most hospital PCs)

**Status:** Future — not started

---

## Current Project Structure

```
redcap-health-pipeline/
├── REDcapproject.md
├── requirements.txt
│
├── backend/
│   ├── main.py                       ← FastAPI entry point
│   ├── auth.py                       ← passcode + JWT
│   ├── store.py                      ← SQLite record store (pipeline.db)
│   ├── pipeline.db                   ← SQLite database (auto-created)
│   ├── config/
│   │   ├── ecg_fields.yaml
│   │   ├── echo_fields.yaml          ← tuned against St. James's TTE ✓
│   │   ├── ct_fields.yaml
│   │   └── mri_fields.yaml
│   ├── extractors/
│   │   ├── base_extractor.py
│   │   ├── ecg_extractor.py
│   │   ├── echo_extractor.py
│   │   ├── ct_extractor.py
│   │   └── mri_extractor.py
│   ├── mapper/
│   │   └── field_mapper.py
│   ├── redcap/
│   │   └── api_import.py
│   ├── routers/
│   │   ├── upload.py
│   │   ├── review.py
│   │   ├── redcap.py                 ← POST /api/import
│   │   ├── export.py                 ← POST /api/export/csv
│   │   ├── records.py                ← GET /api/records, /api/records/{id}
│   │   ├── stats.py
│   │   ├── settings_router.py
│   │   └── inspector.py
│   ├── stats/
│   │   ├── stripper.py
│   │   └── stats_exporter.py
│   └── inspector/
│       └── pdf_inspector.py
│
├── frontend/
│   ├── app/
│   │   ├── login/
│   │   ├── (dashboard)/
│   │   │   ├── records/
│   │   │   │   ├── page.tsx          ← Records library (upload + table + bulk export)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      ← Record detail (grouped fields + export)
│   │   │   ├── stats/
│   │   │   └── settings/
│   │   └── page.tsx                  ← redirects to /records
│   └── components/
│       └── Sidebar.tsx
│
├── sample_pdfs/                      ← drop de-identified test PDFs here
└── tests/
    ├── test_extractors.py
    ├── test_mapper.py
    └── test_redcap_import.py
```

---

## What Needs Doing Before Live Use

1. **Tune YAML patterns** — provide real sample PDFs for ECG, CT, MRI to `sample_pdfs/` and
   adjust `backend/config/{ecg,ct,mri}_fields.yaml` (echo is done ✓)
2. **Upload REDCap Data Dictionary** — via Settings page for full variable name validation
3. **Configure REDCap credentials** — set `REDCAP_URL` + `REDCAP_TOKEN` in `backend/.env`
4. **Set secure credentials** — replace `PIPELINE_PASSCODE` and `SECRET_KEY` in `backend/.env`
5. **GDPR / ethics** — complete compliance checklist above before processing real patient data

---

## Open Questions

1. Do all hospitals use the same PDF format per modality, or does layout vary by hospital/machine?
   *(St. James's Echo layout verified — other sites may need separate YAML patterns)*
2. What is the REDCap record identifier — patient study ID, MRN, or auto-assigned?
3. Has the REDCap Data Dictionary been exported? (needed for exact variable names)
4. Will one REDCap instrument cover all modalities, or is each modality a separate instrument?
5. Will the tool be accessed via hosted URL or USB/offline mode?
