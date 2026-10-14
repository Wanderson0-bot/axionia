from pydantic import BaseModel, Field

class ExecutionRequest(BaseModel):
    command: str = Field(min_length=1, max_length=5000)
    file_ids: list[str] = Field(default_factory=list)

class Step(BaseModel):
    name: str
    status: str
    detail: str

class ExecutionResponse(BaseModel):
    execution_id: str
    status: str
    command: str
    tools_used: list[str]
    steps: list[Step]
    summary: str
    data: dict
    generated_files: list[dict]
    requires_approval: bool
