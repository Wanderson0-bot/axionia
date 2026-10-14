from pydantic import BaseModel

class UploadedFile(BaseModel):
    id: str
    original_name: str
    stored_name: str
    extension: str
    content_type: str | None = None
    size_bytes: int
    path: str

class UploadResponse(BaseModel):
    files: list[UploadedFile]
