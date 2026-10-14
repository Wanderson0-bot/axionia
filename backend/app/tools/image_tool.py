from pathlib import Path
from PIL import Image

def inspect_image(path: str) -> dict:
    with Image.open(path) as image:
        return {"type":"Image", "size_bytes":Path(path).stat().st_size, "format":image.format, "width":image.width, "height":image.height, "mode":image.mode}
