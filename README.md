# AXION IA — modo local

## Iniciar

Backend (Windows):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
npm install
npm run dev
```

Opcionalmente configure `VITE_API_URL=http://localhost:8000` em `.env`. A API usa SQLite em `backend/data/axion.db`, uploads privados em `backend/uploads` e resultados futuros em `backend/outputs`.

## Endpoints

`GET /api/health`, `POST /api/files/upload`, `GET /api/files`, `POST /api/executions`, `GET /api/executions`, `GET /api/executions/{id}`, e ações `approve`, `cancel`, `clarify`, `run`.

O motor local identifica intenções por regras e nunca chama modelo externo. Análises de CSV/XLSX, PDF e DOCX são locais. Criação/exportação e demais ações com impacto permanecem dependentes de aprovação humana. Um `FutureLLMReasoningEngine` pode substituir as regras posteriormente sem alterar a API de execuções.

Limitações: não há autenticação completa, OCR/visão avançada ou integração externa; XLS legado depende de suporte do ambiente Pandas.
