# REDCap Health Pipeline — Project Roadmap

## Overview

A Python-based pipeline to extract clinical data from machine-readable hospital PDF reports
(ECG, Echo, CT, MRI) and import it into REDCap in the correct format. Also includes a reverse
pipeline to export REDCap data for statistical analysis of Irish population health screening data.

---

## Compliance & Data Governance (Pre-requisite)

Before any data is processed:

- [ ] GDPR / DPIA completed with your institution
- [ ] De-identification protocol agreed (strip name, DOB, MRN before processing)
- [ ] REDCap project structure finalised (instruments + variable names confirmed)
- [ ] Data Dictionary exported from REDCap (provides exact field/variable names)
- [ ] Ethics approval in place for genetic health screening study
- [ ] Confirm REDCap version at your institution (determines available import features)

---

## Architecture — Two Pipelines

```
FORWARD PIPELINE (Hospital PDFs → REDCap)
  PDFs (ECG / Echo / CT / MRI)
      ↓
  [Module 1] PDF Inspector        — understand PDF structure
      ↓
  [Module 2] Extractors           — pull data points per modality
      ↓
  [Module 3] Field Mapper         — map extracted data → REDCap variable names
      ↓
  [Module 4] REDCap CSV Exporter  — generate REDCap-compatible import CSV
      ↓
  Manual upload via REDCap Data Import Tool

REVERSE PIPELINE (REDCap → Statistics)
  REDCap export (CSV/JSON)
      ↓
  [Module 5] REDCap Stripper      — clean and reshape exported data
      ↓
  [Module 6] Stats Exporter       — output analysis-ready CSV/Excel
      ↓
  Statistical tools (R, SPSS, Python pandas)
```

---

## Module Breakdown

### Module 1 — PDF Inspector
**Purpose:** Inspect a single PDF and print its full structure — text blocks, tables, layout.
Used for understanding each hospital's report format before writing extractors.

**Inputs:** Single PDF file  
**Outputs:** Console printout of text, tables, metadata  
**Key tool:** `pdfplumber`  
**Status:** Not started

---

### Module 2 — Extractors (one per modality)

Each extractor reads a PDF and returns a structured Python dict of raw data points.
Field patterns are defined in YAML config files (one per modality) — no hardcoding.

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

### Module 4 — REDCap CSV Exporter
**Purpose:** Takes mapped data for one or many patients and generates a single CSV
file ready for upload via REDCap's Data Import Tool.

**Inputs:** List of mapped patient dicts, record_id field  
**Outputs:** `redcap_import_YYYYMMDD.csv`  
**REDCap import path:** Project → Data Import Tool → Upload CSV → Preview → Confirm  
**Status:** Not started

---

### Module 5 — REDCap Stripper (Reverse Pipeline)
**Purpose:** Takes a raw REDCap data export (CSV) and cleans it for analysis —
renames variables to human-readable labels, expands checkbox columns, handles
missing data codes, filters by instrument or date range.

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

## Suggested Implementation Order

| Phase | Modules | Goal |
|-------|---------|------|
| 1 | Module 1 | Inspect your actual PDFs — understand the structure |
| 2 | Module 2a | ECG extractor first (simplest, most structured) |
| 3 | Module 3 + 4 | Map + export to CSV, test REDCap import with dummy data |
| 4 | Module 2b–2d | Echo, CT, MRI extractors |
| 5 | Module 5 + 6 | Reverse pipeline for statistics |

---

## Project Structure (Target)

```
redcap-health-pipeline/
├── REDcapproject.md          ← this file
├── requirements.txt
├── config/
│   ├── ecg_fields.yaml
│   ├── echo_fields.yaml
│   ├── ct_fields.yaml
│   └── mri_fields.yaml
├── extractors/
│   ├── base_extractor.py
│   ├── ecg_extractor.py
│   ├── echo_extractor.py
│   ├── ct_extractor.py
│   └── mri_extractor.py
├── exporters/
│   ├── redcap_csv.py
│   └── stats_exporter.py
├── scripts/
│   ├── inspect_pdf.py        ← start here
│   ├── batch_extract.py
│   └── redcap_import.py
├── tests/
│   └── test_extractors.py
└── sample_pdfs/              ← de-identified test PDFs go here
```

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| PDF parsing | `pdfplumber` | Best for text + table extraction from machine-readable PDFs |
| Config format | YAML | Human-editable field mappings without touching code |
| Import method | CSV via Data Import Tool | No API token required |
| Python version | 3.11+ | Type hints, match statements |
| Data handling | Never write patient data to disk unencrypted | GDPR |

---

## Open Questions (to resolve before Phase 2)

1. Do all hospitals use the same PDF format per modality, or does layout vary by hospital?
2. What is the REDCap record identifier — patient study ID, or auto-assigned?
3. Have you exported the REDCap Data Dictionary yet? (needed for exact variable names)
4. Which modality should we tackle first — ECG?
5. Will one REDCap instrument cover all modalities, or is each modality a separate instrument?
