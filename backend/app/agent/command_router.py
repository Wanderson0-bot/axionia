from app.schemas.files import UploadedFile

def route_command(command: str, files: list[UploadedFile]) -> list[str]:
    text = command.lower()
    extensions = {file.extension for file in files}
    tools: list[str] = []
    if extensions & {".csv", ".xlsx"} or any(word in text for word in ("planilha", "notas", "excel", "csv", "xlsx")):
        tools.append("spreadsheet_tool")
    if ".pdf" in extensions or "pdf" in text:
        tools.append("pdf_tool")
    if ".docx" in extensions or any(word in text for word in ("documento", "docx")):
        tools.append("docx_tool")
    if extensions & {".png", ".jpg", ".jpeg", ".webp"} or "imagem" in text:
        tools.append("image_tool")
    if "relatório" in text or "relatorio" in text:
        tools.append("report_tool")
    return tools or ["report_tool"]
