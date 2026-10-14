from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile
from app.schemas.files import UploadResponse
from app.services.file_store import file_store
from app.utils.config import ALLOWED_EXTENSIONS

router = APIRouter(prefix="/api/files", tags=["files"])

@router.post("/upload", response_model=UploadResponse)
async def upload_files(files: list[UploadFile] = File(...)):
    uploaded = []
    for file in files:
        name = file.filename or "arquivo"
        extension = Path(name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=415, detail=f"Formato não aceito: {name}")
        content = await file.read()
        if not content:
            raise HTTPException(status_code=422, detail=f"Arquivo vazio: {name}")
        uploaded.append(file_store.save(name, file.content_type, content))
    return UploadResponse(files=uploaded)
