import uuid
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from typing import List
from auth import get_current_user
from extractors.ecg_extractor import ECGExtractor
from extractors.echo_extractor import EchoExtractor
from extractors.ct_extractor import CTExtractor
from extractors.mri_extractor import MRIExtractor
from mapper.field_mapper import mapper
import store

router = APIRouter()

MODALITIES = {"ECG", "Echo", "CT", "MRI"}

_EXTRACTORS = {
    "ECG": ECGExtractor(),
    "Echo": EchoExtractor(),
    "CT": CTExtractor(),
    "MRI": MRIExtractor(),
}


@router.post("/upload")
async def upload_pdfs(
    files: List[UploadFile] = File(...),
    modality: str = Form(...),
    _: dict = Depends(get_current_user),
):
    if modality not in MODALITIES:
        raise HTTPException(status_code=400, detail=f"Invalid modality. Must be one of: {', '.join(MODALITIES)}")

    extractor = _EXTRACTORS[modality]
    results = []

    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            results.append({"filename": f.filename, "status": "skipped", "reason": "Not a PDF"})
            continue

        content = await f.read()
        try:
            extracted = extractor.extract(content)
            record_id = str(uuid.uuid4())[:8]

            # Run field mapper (validates + coerces against Data Dictionary if loaded)
            mapped = mapper.map(extracted, record_id)

            record = {
                "record_id": record_id,
                "filename": f.filename,
                "modality": modality,
                "status": "pending_review",
                "extracted": mapped.fields,
                "warnings": mapped.warnings,
                "errors": mapped.errors,
            }
            store.save(record)
            results.append({
                "record_id": record_id,
                "filename": f.filename,
                "modality": modality,
                "status": "pending_review",
                "warnings": mapped.warnings,
            })
        except Exception as e:
            results.append({
                "filename": f.filename,
                "modality": modality,
                "status": "error",
                "reason": str(e),
            })

    return {"uploaded": len(results), "modality": modality, "files": results}
