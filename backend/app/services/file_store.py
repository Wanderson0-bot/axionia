from uuid import uuid4
from pathlib import Path
from app.schemas.files import UploadedFile
from app.utils.config import UPLOAD_DIR

class FileStore:
    def __init__(self) -> None:
        self._files: dict[str, UploadedFile] = {}

    def save(self, filename: str, content_type: str | None, content: bytes) -> UploadedFile:
        extension = Path(filename).suffix.lower()
        file_id = str(uuid4())
        stored_name = f"{file_id}{extension}"
        path = UPLOAD_DIR / stored_name
        path.write_bytes(content)
        item = UploadedFile(id=file_id, original_name=filename, stored_name=stored_name, extension=extension, content_type=content_type, size_bytes=len(content), path=str(path))
        self._files[file_id] = item
        return item

    def get_many(self, file_ids: list[str]) -> list[UploadedFile]:
        missing = [file_id for file_id in file_ids if file_id not in self._files]
        if missing:
            raise KeyError(", ".join(missing))
        return [self._files[file_id] for file_id in file_ids]

file_store = FileStore()
