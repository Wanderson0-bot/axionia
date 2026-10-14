from fastapi import APIRouter, HTTPException
from app.agent.execution_manager import execution_manager
from app.schemas.executions import ExecutionRequest, ExecutionResponse
from app.services.file_store import file_store

router = APIRouter(prefix="/api/executions", tags=["executions"])

@router.post("", response_model=ExecutionResponse)
def create_execution(payload: ExecutionRequest):
    try:
        files = file_store.get_many(payload.file_ids)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=f"Arquivo(s) não encontrado(s): {error.args[0]}") from error
    try:
        return execution_manager.run(payload.command, files)
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Não foi possível executar a tarefa: {error}") from error
