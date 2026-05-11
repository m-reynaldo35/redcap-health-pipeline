import io
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from inspector.pdf_inspector import inspect_pdf
from auth import get_current_user

router = APIRouter()


@router.post("/inspect")
async def inspect_pdf_route(
    file: UploadFile = File(...),
    _: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    content = await file.read()
    result = inspect_pdf(io.BytesIO(content))
    return {"filename": file.filename, **result}
