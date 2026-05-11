from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user

router = APIRouter()


class StatsExportRequest(BaseModel):
    modality: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    format: str = "csv"


@router.post("/stats/export")
def export_stats(body: StatsExportRequest, _: dict = Depends(get_current_user)):
    return {
        "export_id": "export_001",
        "status": "ready",
        "format": body.format,
        "modality": body.modality or "all",
        "record_count": 42,
        "download_url": "/api/stats/download/export_001",
    }


@router.get("/stats/download/{export_id}")
def download_export(export_id: str, _: dict = Depends(get_current_user)):
    return {"export_id": export_id, "status": "stub — file download not yet implemented"}


@router.get("/stats/summary")
def stats_summary(_: dict = Depends(get_current_user)):
    return {
        "total_records": 156,
        "by_modality": {"ECG": 72, "Echo": 45, "CT": 28, "MRI": 11},
        "imported_to_redcap": 148,
        "pending_review": 8,
    }
