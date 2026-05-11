from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from auth import get_current_user
import store

router = APIRouter()


@router.get("/records")
def list_records(
    modality: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    _: dict = Depends(get_current_user),
):
    records = store.all_records()
    if modality:
        records = [r for r in records if r.get("modality", "").lower() == modality.lower()]
    if status:
        records = [r for r in records if r.get("status") == status]
    if search:
        records = [r for r in records if search.lower() in r.get("filename", "").lower()]
    # Return summary view (no extracted fields — those are large)
    summary = [
        {
            "id": r["record_id"],
            "filename": r.get("filename", ""),
            "modality": r.get("modality", ""),
            "status": r.get("status", ""),
            "redcap_id": r.get("redcap_id"),
            "imported_at": r.get("imported_at"),
            "warnings": r.get("warnings", []),
        }
        for r in records
    ]
    return {"records": summary, "total": len(summary)}


@router.get("/records/{record_id}")
def get_record(record_id: str, _: dict = Depends(get_current_user)):
    rec = store.get(record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    return rec
