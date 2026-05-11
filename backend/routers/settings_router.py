import os
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from auth import get_current_user
from mapper.field_mapper import mapper

load_dotenv()

router = APIRouter()

_settings: dict = {
    "redcap_url": os.getenv("REDCAP_URL", ""),
    "redcap_token": os.getenv("REDCAP_TOKEN", ""),
    "redcap_project_id": os.getenv("REDCAP_PROJECT_ID", ""),
}


class SettingsUpdate(BaseModel):
    redcap_url: Optional[str] = None
    redcap_token: Optional[str] = None
    redcap_project_id: Optional[str] = None


@router.get("/settings")
def get_settings(_: dict = Depends(get_current_user)):
    return {
        "redcap_url": _settings.get("redcap_url", ""),
        "redcap_token": "•••••••••••••" if _settings.get("redcap_token") else "",
        "redcap_project_id": _settings.get("redcap_project_id", ""),
    }


@router.put("/settings")
def update_settings(body: SettingsUpdate, _: dict = Depends(get_current_user)):
    if body.redcap_url is not None:
        _settings["redcap_url"] = body.redcap_url
    if body.redcap_token is not None:
        _settings["redcap_token"] = body.redcap_token
    if body.redcap_project_id is not None:
        _settings["redcap_project_id"] = body.redcap_project_id
    return {"status": "updated"}


@router.post("/settings/data-dictionary")
async def upload_data_dictionary(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV exported from REDCap.")
    content = (await file.read()).decode("utf-8-sig")
    count = mapper.load_data_dictionary(content)
    if count == 0:
        raise HTTPException(status_code=400, detail="No fields found — check this is a valid REDCap Data Dictionary CSV.")
    return {"status": "loaded", "field_count": count}


@router.get("/settings/data-dictionary")
def data_dictionary_status(_: dict = Depends(get_current_user)):
    return {
        "loaded": mapper.has_data_dictionary,
        "field_count": len(mapper.data_dictionary_fields()),
    }
