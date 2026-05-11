import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from auth import get_current_user
from routers.settings_router import _settings
from redcap.api_import import import_records, ImportRecord
import store

router = APIRouter()


class ImportRequest(BaseModel):
    record_ids: List[str]


@router.post("/import")
async def import_to_redcap(body: ImportRequest, _: dict = Depends(get_current_user)):
    redcap_url = _settings.get("redcap_url", "")
    token = _settings.get("redcap_token", "")

    records_to_import: list[ImportRecord] = []
    for rid in body.record_ids:
        rec = store.get(rid)
        if not rec:
            raise HTTPException(status_code=404, detail=f"Record {rid} not found")
        if rec.get("status") != "approved":
            raise HTTPException(status_code=400, detail=f"Record {rid} is not approved")
        records_to_import.append(ImportRecord(
            record_id=rid,
            fields=rec.get("mapped_fields", rec.get("extracted", {})),
        ))

    batch_id = str(uuid.uuid4())[:8]

    # If REDCap is not configured, return a clear error rather than silently failing
    if not redcap_url or not token:
        raise HTTPException(
            status_code=400,
            detail="REDCap URL and API token are not configured. Go to Settings to add them.",
        )

    result = await import_records(records_to_import, redcap_url, token, batch_id)

    now = datetime.now(timezone.utc).isoformat()
    for r in result.results:
        store.update(r.record_id, {
            "status": "imported" if r.success else "import_failed",
            "imported_at": now if r.success else None,
            "import_error": r.error,
        })

    return {
        "batch_id": result.batch_id,
        "imported": result.imported,
        "failed": result.failed,
        "results": [
            {
                "record_id": r.record_id,
                "status": "success" if r.success else "error",
                "message": r.redcap_response if r.success else r.error,
            }
            for r in result.results
        ],
    }


@router.get("/import/{batch_id}")
def get_import_status(batch_id: str, _: dict = Depends(get_current_user)):
    return {"batch_id": batch_id, "status": "complete"}
