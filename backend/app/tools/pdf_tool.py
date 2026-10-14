from pathlib import Path
import fitz

def inspect_pdf(path: str) -> dict:
    document = fitz.open(path)
    data = {"type":"PDF", "size_bytes":Path(path).stat().st_size, "pages":len(document), "metadata":document.metadata or {}}
    document.close()
    return data
