import uuid
from collections import defaultdict
from datetime import datetime, timezone
from io import StringIO
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from auth import get_current_user
from mapper.field_mapper import mapper as field_mapper
from stats.stripper import REDCapStripper
from stats.stats_exporter import exporter
import store

router = APIRouter()
_stripper = REDCapStripper()

# In-memory store for stripped datasets and generated export files
_stripped: dict[str, pd.DataFrame] = {}   # strip_id → DataFrame
_exports: dict[str, tuple[bytes, str, str]] = {}  # export_id → (bytes, mime, filename)

_MIME_EXT = {
    "csv": ("text/csv", "csv"),
    "xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
    "sav": ("application/x-spss-sav", "sav"),
}


# ---------------------------------------------------------------------------
# Strip endpoint — upload REDCap export CSV, clean it, store for export
# ---------------------------------------------------------------------------

class StripRequest(BaseModel):
    date_column: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    rename_columns: bool = True
    expand_checkboxes: bool = True


@router.post("/stats/strip")
async def strip_redcap_export(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV exported from REDCap.")

    content = (await file.read()).decode("utf-8-sig")

    dd = field_mapper._dd if field_mapper.has_data_dictionary else None

    try:
        result = _stripper.strip(
            content,
            data_dict=dd,
            rename_columns=bool(dd),
            expand_checkboxes=bool(dd),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    strip_id = str(uuid.uuid4())[:8]
    _stripped[strip_id] = result.df

    # Build a preview (first 5 rows)
    preview = result.df.head(5).fillna("").to_dict(orient="records")

    return {
        "strip_id": strip_id,
        "rows": result.filtered_row_count,
        "rows_dropped": result.rows_dropped,
        "columns": len(result.df.columns),
        "columns_renamed": result.columns_renamed,
        "checkboxes_expanded": result.checkboxes_expanded,
        "column_names": list(result.df.columns),
        "preview": preview,
        "warnings": result.warnings,
    }


# ---------------------------------------------------------------------------
# Export endpoint — generate downloadable file from stripped dataset
# ---------------------------------------------------------------------------

class ExportRequest(BaseModel):
    strip_id: str
    format: str = "csv"
    modality_column: Optional[str] = None
    modality_value: Optional[str] = None


@router.post("/stats/export")
def export_stats(body: ExportRequest, _: dict = Depends(get_current_user)):
    if body.strip_id not in _stripped:
        raise HTTPException(status_code=404, detail="Strip ID not found. Upload a REDCap export first.")

    df = _stripped[body.strip_id].copy()

    if body.modality_column and body.modality_value:
        if body.modality_column in df.columns:
            df = df[df[body.modality_column] == body.modality_value]
        else:
            raise HTTPException(status_code=400, detail=f"Column '{body.modality_column}' not found in dataset.")

    if body.format not in _MIME_EXT:
        raise HTTPException(status_code=400, detail=f"Format must be one of: {', '.join(_MIME_EXT)}")

    try:
        file_bytes, _ = exporter.export(df, body.format)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    export_id = str(uuid.uuid4())[:8]
    mime, ext = _MIME_EXT[body.format]
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"redcap_stats_{ts}.{ext}"
    _exports[export_id] = (file_bytes, mime, filename)

    return {
        "export_id": export_id,
        "format": body.format,
        "row_count": len(df),
        "column_count": len(df.columns),
        "download_url": f"/api/stats/download/{export_id}",
        "filename": filename,
    }


# ---------------------------------------------------------------------------
# Download endpoint — stream the generated file
# ---------------------------------------------------------------------------

@router.get("/stats/download/{export_id}")
def download_export(export_id: str, _: dict = Depends(get_current_user)):
    if export_id not in _exports:
        raise HTTPException(status_code=404, detail="Export not found or expired.")
    file_bytes, mime, filename = _exports[export_id]
    return Response(
        content=file_bytes,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Summary — live counts from in-memory record store
# ---------------------------------------------------------------------------

@router.get("/stats/summary")
def stats_summary(_: dict = Depends(get_current_user)):
    all_records = store.all_records()
    by_modality: dict[str, int] = defaultdict(int)
    imported = 0
    pending = 0

    for r in all_records:
        by_modality[r.get("modality", "Unknown")] += 1
        if r.get("status") == "imported":
            imported += 1
        if r.get("status") == "pending_review":
            pending += 1

    return {
        "total_records": len(all_records),
        "by_modality": dict(by_modality),
        "imported_to_redcap": imported,
        "pending_review": pending,
    }
