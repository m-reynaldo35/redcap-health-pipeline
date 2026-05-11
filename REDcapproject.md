# REDCap Health Pipeline — Project Roadmap

## Overview

A full-stack web application for clinical researchers to extract data from hospital PDF reports
(ECG, Echo, CT, MRI), review and edit extracted fields, and import directly into REDCap via API.
Also includes a reverse pipeline to export REDCap data for statistical analysis of Irish population
health screening data. A small number of authorised researchers access the tool via a hosted URL.

---

## Compliance & Data Governance (Pre-requisite)

Before any data is processed:

- [ ] GDPR / DPIA completed with your institution
- [ ] De-identification protocol agreed (strip name, DOB, MRN before processing)
- [ ] REDCap project structure finalised (instruments + variable names confirmed)
- [ ] Data Dictionary exported from REDCap (provides exact field/variable names)
- [ ] Ethics approval in place for genetic health screening study
- [ ] Confirm REDCap version at your institution (determines available API features)
- [ ] REDCap standard user API token obtained for the project

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
  [Module 4a] REDCap API Import   — POST records directly via standard user token
  [Module 4b] CSV Export          — fallback download if API unavailable

REVERSE PIPELINE (REDCap → Statistics)

  [Module 5] REDCap Stripper      — clean and reshape exported REDCap data
      ↓
  [Module 6] Stats Exporter       — output analysis-ready CSV / Excel / SPSS
      ↓
  Statistical tools (R, SPSS, Python pandas)

FUTURE — Phase 2

  [Module 7] DICOM Analyser       — raw CT / MRI image analysis
  [Module 8] Raw ECG Analyser     — ECG signal processing from raw data
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js + Tailwind CSS | Clean, modern UI; researchers access via URL only |
| Backend | FastAPI (Python) | Keeps all extraction/mapping logic in Python |
| Auth | Shared passcode + session token | Small team, simple and secure |
| PDF parsing | `pdfplumber` | Best for text + table extraction from machine-readable PDFs |
| Config format | YAML | Human-editable field mappings without touching code |
| REDCap import | API (POST records, standard user token) | Fully automated, no manual upload |
| Hosting | Railway (backend) + Vercel (frontend) | Simple private deployment |
| Python version | 3.11+ | Type hints, match statements |
| Data handling | Never write patient data to disk unencrypted | GDPR |

---

## Module Breakdown

### Module 0 — Web Application Shell
**Purpose:** The researcher-facing interface. Provides all pages, navigation, auth, and
connects the frontend to the FastAPI backend.

**Pages:**

| Page | Purpose |
|------|---------|
| Login | Shared passcode → session token; only authorised researchers access |
| Upload | Drag and drop single or batch PDFs; select modality; trigger extraction |
| Review | Table of extracted fields per record; inline editing before import |
| REDCap Import | Send reviewed records to REDCap API; per-record status (success / fail / skipped) |
| Records | Searchable, filterable list of all processed records and import history |
| Stats Export | Select modality and date range; download CSV / Excel / SPSS |
| Settings | REDCap URL, API token, field mapping config, user management |

**User flow:**
```
1. Researcher opens app URL → logs in with passcode
2. Drags 10 ECG PDFs onto Upload page, selects modality "ECG"
3. Pipeline extracts data → Review page shows table of all fields
4. Researcher spot-checks, edits any incorrect values inline
5. Clicks "Send to REDCap" → green/red status shown per record
6. Done — records live in REDCap
```

**Status:** Not started

---

### Module 1 — PDF Inspector
**Purpose:** Inspect a PDF and output its full structure — text blocks, tables, layout.
Used during development to understand each hospital's report format before writing extractors.
Also exposed as a developer utility in the Settings page.

**Inputs:** Single PDF file
**Outputs:** Structured JSON of text, tables, metadata
**Key tool:** `pdfplumber`
**Status:** Not started

---

### Module 2 — Extractors (one per modality)

Each extractor reads a PDF and returns a structured Python dict of raw data points.
Field patterns are defined in YAML config files (one per modality) — no hardcoding in code.

#### 2a — ECG Extractor
Data points: Heart rate, PR interval, QRS duration, QT/QTc, P/QRS/T axis, rhythm, report date
Checkboxes: Normal ECG, LBBB, RBBB, AF, ST elevation/depression, LVH

#### 2b — Echocardiogram Extractor
Data points: EF (ejection fraction), LV dimensions (EDD, ESD), wall thickness, valve findings,
diastolic function grade, PASP, report date
Checkboxes: Normal echo, LV dysfunction, RV dysfunction, valve stenosis/regurgitation grades

#### 2c — CT Extractor
Data points: Scan type, findings summary, organ measurements, incidental findings, report date
Checkboxes: Normal, abnormal, follow-up recommended, specific pathology flags

#### 2d — MRI Extractor
Data points: Sequence type, region, key measurements, signal abnormalities, report date
Checkboxes: Normal, abnormal, pathology-specific flags

**Inputs:** PDF file + YAML config for that modality
**Outputs:** Python dict `{ redcap_var: value }`
**Status:** Not started

---

### Module 3 — Field Mapper
**Purpose:** Translates raw extracted values into REDCap-compatible format.
Handles: data type coercion, date format normalisation (DD/MM/YYYY → YYYY-MM-DD),
checkbox encoding (`1` = ticked, `0` = unticked), REDCap checkbox naming convention
(`fieldname___1`, `fieldname___2`).

**Inputs:** Raw extracted dict + REDCap Data Dictionary (CSV)
**Outputs:** Validated dict keyed by exact REDCap variable names
**Status:** Not started

---

### Module 4a — REDCap API Import
**Purpose:** Posts mapped records directly to REDCap via the standard user API token.
Handles batch imports, per-record success/failure responses, and retry on transient errors.

**Inputs:** List of mapped patient dicts, REDCap URL, API token
**Outputs:** Per-record import status (success / error / skipped)
**REDCap API call:** `POST /api/` with `content=record`, `format=json`, `data=[{...}]`
**Status:** Not started

---

### Module 4b — CSV Export (Fallback)
**Purpose:** Generates a REDCap-compatible CSV download if the API is unavailable.
Researcher downloads the file and uploads manually via REDCap Data Import Tool.

**Inputs:** List of mapped patient dicts, record_id field
**Outputs:** `redcap_import_YYYYMMDD.csv`
**Status:** Not started

---

### Module 5 — REDCap Stripper (Reverse Pipeline)
**Purpose:** Takes a raw REDCap data export (CSV) and cleans it for statistical analysis.
Renames variables to human-readable labels, expands checkbox columns, handles missing
data codes, filters by instrument or date range.

**Inputs:** REDCap export CSV + Data Dictionary
**Outputs:** Clean wide-format CSV
**Status:** Not started

---

### Module 6 — Stats Exporter
**Purpose:** Produces analysis-ready outputs from the stripped REDCap data.
Generates per-modality subsets, summary statistics, and exports to formats
compatible with R, SPSS, and Excel.

**Outputs:**
- `stats_ecg.csv`, `stats_echo.csv`, `stats_ct.csv`, `stats_mri.csv`
- `summary_statistics.xlsx` (one sheet per modality)
- Optional: `.sav` SPSS format via `pyreadstat`

**Status:** Not started

---

### Module 7 — DICOM Analyser (Phase 2)
**Purpose:** Parse raw CT and MRI DICOM files and extract structured measurements
for REDCap import. Replaces reliance on PDF reports for imaging modalities.

**Key tools:** `pydicom`, potentially AI-assisted measurement extraction
**Status:** Future — not started

---

### Module 8 — Raw ECG Signal Analyser (Phase 2)
**Purpose:** Process raw ECG signal files (XML, SCP-ECG, EDF) and extract intervals,
rhythm classification, and morphology findings programmatically.

**Key tools:** `neurokit2`, `biosppy`
**Status:** Future — not started

---

## Implementation Order

| Phase | Modules | Goal |
|-------|---------|------|
| 1 | Module 0 | App shell — Next.js frontend + FastAPI backend + auth + routing |
| 2 | Module 1 | PDF inspector wired into backend — understand actual PDF structures |
| 3 | Module 2a | ECG extractor (simplest, most structured modality) |
| 4 | Module 3 + 4a | Field mapper + REDCap API import — end-to-end test with dummy data |
| 5 | Module 2b–2d | Echo, CT, MRI extractors |
| 6 | Module 4b | CSV fallback export |
| 7 | Module 5 + 6 | Reverse pipeline — stats export |
| 8 | Module 7 + 8 | Phase 2 — raw DICOM + ECG signal analysis |

---

## Project Structure (Target)

```
redcap-health-pipeline/
├── REDcapproject.md
├── requirements.txt
│
├── backend/                          ← FastAPI application
│   ├── main.py                       ← app entry point, routes
│   ├── auth.py                       ← passcode + session token
│   ├── config/
│   │   ├── ecg_fields.yaml
│   │   ├── echo_fields.yaml
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
│   │   ├── api_import.py             ← Module 4a
│   │   └── csv_export.py             ← Module 4b
│   ├── stats/
│   │   ├── stripper.py               ← Module 5
│   │   └── stats_exporter.py         ← Module 6
│   └── inspector/
│       └── pdf_inspector.py          ← Module 1
│
├── frontend/                         ← Next.js application
│   ├── app/
│   │   ├── login/
│   │   ├── upload/
│   │   ├── review/
│   │   ├── import/
│   │   ├── records/
│   │   ├── stats/
│   │   └── settings/
│   └── components/
│
├── tests/
│   ├── test_extractors.py
│   ├── test_mapper.py
│   └── test_redcap_import.py
│
└── sample_pdfs/                      ← de-identified test PDFs
```

---

## Open Questions (resolve before Phase 3)

1. Do all hospitals use the same PDF format per modality, or does layout vary by hospital?
2. What is the REDCap record identifier — patient study ID, or auto-assigned?
3. Have you exported the REDCap Data Dictionary yet? (needed for exact variable names)
4. Will one REDCap instrument cover all modalities, or is each modality a separate instrument?
5. What REDCap instance URL will the tool connect to?
