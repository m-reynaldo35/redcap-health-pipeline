from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any
from auth import get_current_user
import store

router = APIRouter()


class FieldUpdate(BaseModel):
    fields: dict[str, Any]


@router.get("/review")
def list_pending(_: dict = Depends(get_current_user)):
    records = store.by_status("pending_review")
    return {
        "records": [
            {
                "id": r["record_id"],
                "filename": r.get("filename", ""),
                "modality": r.get("modality", ""),
                "status": r.get("status", ""),
                "extracted": r.get("extracted", {}),
                "warnings": r.get("warnings", []),
            }
            for r in records
        ],
        "total": len(records),
    }


@router.put("/review/{record_id}")
def update_record(record_id: str, body: FieldUpdate, _: dict = Depends(get_current_user)):
    if not store.get(record_id):
        raise HTTPException(status_code=404, detail="Record not found")
    store.update(record_id, {"extracted": body.fields})
    return {"id": record_id, "updated": True}


@router.post("/review/{record_id}/approve")
def approve_record(record_id: str, _: dict = Depends(get_current_user)):
    if not store.get(record_id):
        raise HTTPException(status_code=404, detail="Record not found")
    store.update(record_id, {"status": "approved"})
    return {"id": record_id, "status": "approved"}


@router.post("/review/{record_id}/reject")
def reject_record(record_id: str, _: dict = Depends(get_current_user)):
    if not store.get(record_id):
        raise HTTPException(status_code=404, detail="Record not found")
    store.update(record_id, {"status": "rejected"})
    return {"id": record_id, "status": "rejected"}
