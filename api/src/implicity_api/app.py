import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from implicity_api.backup import daily_backups


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(daily_backups())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
