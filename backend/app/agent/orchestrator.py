from uuid import uuid4
from app.agent.command_router import route_command
from app.schemas.executions import ExecutionResponse, Step
from app.schemas.files import UploadedFile
from app.tools.spreadsheet_tool import read_spreadsheet
from app.tools.pdf_tool import inspect_pdf
from app.tools.docx_tool import inspect_docx
from app.tools.image_tool import inspect_image
from app.tools.report_tool import build_report

def requires_approval(command: str) -> bool:
    return any(word in command.lower() for word in ("enviar", "comunicado", "publicar", "responsáveis", "responsaveis"))

def execute(command: str, files: list[UploadedFile]) -> ExecutionResponse:
    execution_id = str(uuid4())
    steps = [Step(name="Interpretando solicitação", status="completed", detail="Comando recebido e validado."), Step(name="Identificando arquivos", status="completed", detail=f"{len(files)} arquivo(s) associado(s).")]
    selected_tools = route_command(command, files)
    data: dict = {"files": []}
    used: list[str] = []
    for tool in selected_tools:
        if tool == "spreadsheet_tool":
            spreadsheet_files = [file for file in files if file.extension in {".csv", ".xlsx"}]
            if spreadsheet_files:
                data["spreadsheets"] = [{"name": file.original_name, "analysis": read_spreadsheet(file.path)} for file in spreadsheet_files]
                used.append("Leitor de planilhas")
        elif tool == "pdf_tool":
            pdf_files = [file for file in files if file.extension == ".pdf"]
            if pdf_files:
                data["pdfs"] = [{"name": file.original_name, "metadata": inspect_pdf(file.path)} for file in pdf_files]
                used.append("Leitor de PDF")
        elif tool == "docx_tool":
            docx_files = [file for file in files if file.extension == ".docx"]
            if docx_files:
                data["documents"] = [{"name": file.original_name, "metadata": inspect_docx(file.path)} for file in docx_files]
                used.append("Leitor de DOCX")
        elif tool == "image_tool":
            image_files = [file for file in files if file.extension in {".png", ".jpg", ".jpeg", ".webp"}]
            if image_files:
                data["images"] = [{"name": file.original_name, "metadata": inspect_image(file.path)} for file in image_files]
                used.append("Analisador de imagem")
    if "report_tool" in selected_tools:
        data["report"] = build_report(data)
        used.append("Gerador de relatório")
    steps.extend([Step(name="Utilizando ferramentas", status="completed", detail=", ".join(used) or "Preparação de relatório local."), Step(name="Validando resultado", status="completed", detail="Resultado estruturado gerado localmente.")])
    summary = f"Execução local concluída com {len(used)} ferramenta(s) e {len(files)} arquivo(s)."
    return ExecutionResponse(execution_id=execution_id, status="waiting_approval" if requires_approval(command) else "completed", command=command, tools_used=used, steps=steps, summary=summary, data=data, generated_files=[], requires_approval=requires_approval(command))
