import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user
import store

router = APIRouter()


class CsvExportRequest(BaseModel):
    record_ids: Optional[List[str]] = None  # None = export all


@router.post("/export/csv")
def export_csv(body: CsvExportRequest, _: dict = Depends(get_current_user)):
    if body.record_ids is not None:
        records = [store.get(rid) for rid in body.record_ids]
        records = [r for r in records if r]
    else:
        records = store.all_records()

    if not records:
        raise HTTPException(status_code=404, detail="No records to export")

    all_field_keys: set[str] = set()
    for r in records:
        all_field_keys.update(r.get("extracted", {}).keys())

    meta_cols = ["record_id", "filename", "modality", "status", "imported_at"]
    field_cols = sorted(all_field_keys)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=meta_cols + field_cols, extrasaction="ignore")
    writer.writeheader()

    for r in records:
        row: dict = {
            "record_id": r["record_id"],
            "filename": r.get("filename", ""),
            "modality": r.get("modality", ""),
            "status": r.get("status", ""),
            "imported_at": r.get("imported_at", ""),
        }
        row.update(r.get("extracted", {}))
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=redcap_export.csv"},
    )
