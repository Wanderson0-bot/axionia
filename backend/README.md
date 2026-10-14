# AXION IA — Backend local

Primeira versão local do agente operacional da AXION. Não usa banco de dados, autenticação, APIs externas ou modelos de IA.

## Requisitos

- Python 3.11 ou superior
- Ambiente virtual recomendado

## Instalação

No Windows (PowerShell):

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

No macOS/Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Iniciar

```bash
uvicorn app.main:app --reload --port 8000
```

A documentação interativa estará em `http://127.0.0.1:8000/docs`.

## Fluxo de teste

1. Envie um ou mais arquivos compatíveis:

```bash
curl -X POST http://127.0.0.1:8000/api/files/upload -F "files=@./exemplo.csv"
```

2. Copie o `id` retornado e envie uma execução:

```bash
curl -X POST http://127.0.0.1:8000/api/executions -H "Content-Type: application/json" -d '{"command":"Analise esta planilha e gere um relatório", "file_ids":["ID_DO_ARQUIVO"]}'
```

## Ferramentas locais

- CSV/XLSX: colunas, registros, ausências, estatísticas e valores abaixo da média.
- PDF/DOCX/imagens: validação e metadados.
- Relatórios: resposta estruturada localmente.

Os uploads são mantidos apenas em memória durante a execução do servidor; os arquivos físicos ficam em `uploads/`.
