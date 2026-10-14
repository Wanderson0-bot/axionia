from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads"
OUTPUT_DIR = BACKEND_DIR / "outputs"
ALLOWED_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".docx", ".png", ".jpg", ".jpeg", ".webp"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
