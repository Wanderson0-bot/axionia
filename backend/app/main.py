from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db.connection import connection, close_pool
from app.local import router, init


@asynccontextmanager
async def lifespan(app):
    init()
    try:
        yield
    finally:
        close_pool()


app = FastAPI(title='AXION IA API', version='0.3.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(router)


@app.get('/api/health')
def health():
    try:
        with connection() as db:
            db.execute('SELECT 1')
    except Exception:
        raise HTTPException(503, 'Banco de dados indisponível.')
    return {'status': 'ok', 'service': 'AXION IA', 'mode': 'postgresql'}