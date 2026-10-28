import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import Database, LETTER_QUERY, letter_dict, letters_for_memory, memory_dict
from .providers import DemoStoryProvider, GenerationDisabled, LocalAssetProvider, Lux3DProvider, TEMPLATES
from .schemas import AssetRequest, Draft, LetterCreate, MemoryCreate

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


def create_app(db_path: str | None = None) -> FastAPI:
    db = Database(db_path or os.getenv("DB_PATH", str(BACKEND / "data" / "memorybox.sqlite3")))
    story_provider = DemoStoryProvider()
    assets = LocalAssetProvider(ROOT / "frontend" / "public" / "assets" / "manifest.json")
    app = FastAPI(title="MemoryBox local demo", version="0.1.0")
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-MemoryBox-Token", "Idempotency-Key"])

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": f"HTTP_{exc.status_code}", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = [".".join(str(p) for p in err["loc"][1:]) for err in exc.errors()]
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_INPUT", "message": "请检查输入：" + "、".join(fields)}})

    def owner(x_memorybox_token: Annotated[str | None, Header()] = None) -> str:
        if not x_memorybox_token or not 16 <= len(x_memorybox_token) <= 256:
            raise HTTPException(401, {"code": "OWNER_TOKEN_REQUIRED", "message": "缺少此浏览器的本地访问凭据。"})
        return hashlib.sha256(x_memorybox_token.encode("utf-8")).hexdigest()

    def owned(connection, memory_id: str, owner_hash: str):
        row = connection.execute("SELECT * FROM memories WHERE id=? AND owner_token_hash=?", (memory_id, owner_hash)).fetchone()
        if row is None:
            raise HTTPException(404, {"code": "NOT_FOUND", "message": "回忆不存在，或不属于当前浏览器。"})
        return row

    def payload_hash(payload) -> str:
        canonical = json.dumps(payload.model_dump(), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def previous_request(connection, owner_hash: str, resource: str, key: str | None, fingerprint: str):
        if key is None:
            return None
        row = connection.execute("SELECT resource_id, request_hash FROM idempotency_keys WHERE owner_token_hash=? AND resource_type=? AND client_key=?", (owner_hash, resource, key)).fetchone()
        if row is not None and row["request_hash"] != fingerprint:
            raise HTTPException(409, {"code": "IDEMPOTENCY_CONFLICT", "message": "同一保存凭据对应的内容已改变，请为新内容使用新的保存凭据。"})
        return row["resource_id"] if row is not None else None

    def remember_request(connection, owner_hash: str, resource: str, key: str | None, resource_id: str, fingerprint: str, now: str):
        if key is not None:
            connection.execute("INSERT INTO idempotency_keys VALUES (?, ?, ?, ?, ?, ?)", (owner_hash, resource, key, resource_id, fingerprint, now))

    @app.get("/api/health")
    def health():
        return {"status": "ok", "mode": "demo", "storyProvider": "template-demo", "assetProvider": "local", "lux3dEnabled": False}

    @app.get("/api/templates")
    def list_templates():
        return TEMPLATES

    @app.get("/api/templates/{template_id}")
    def get_template(template_id: str):
        template = next((t for t in TEMPLATES if t["id"] == template_id), None)
        if template is None:
            raise HTTPException(404, {"code": "NOT_FOUND", "message": "没有这个故事模板。"})
        return template

    @app.post("/api/memories/compose")
    def compose(draft: Draft):
        return story_provider.compose(draft)

    @app.post("/api/memories", status_code=201)
    def create_memory(payload: MemoryCreate, owner_hash: Annotated[str, Depends(owner)], idempotency_key: Annotated[str | None, Header(min_length=16, max_length=128)] = None):
        memory_id, now = str(uuid4()), datetime.now(UTC).isoformat()
        story = story_provider.compose(payload.draft)
        fingerprint = payload_hash(payload.draft)
        with db.connect() as connection:
            # Serializes lookup + insertion, including simultaneous retries after a lost response.
            connection.execute("BEGIN IMMEDIATE")
            existing = previous_request(connection, owner_hash, "memory", idempotency_key, fingerprint)
            if existing is not None:
                return memory_dict(connection, owned(connection, existing, owner_hash))
            connection.execute("INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?)", (memory_id, owner_hash, json.dumps(payload.draft.model_dump(), ensure_ascii=False), json.dumps(story, ensure_ascii=False), now, now))
            remember_request(connection, owner_hash, "memory", idempotency_key, memory_id, fingerprint, now)
            return memory_dict(connection, owned(connection, memory_id, owner_hash))

    @app.get("/api/memories")
    def list_memories(owner_hash: Annotated[str, Depends(owner)]):
        with db.connect() as connection:
            rows = connection.execute("SELECT * FROM memories WHERE owner_token_hash=? ORDER BY created_at DESC", (owner_hash,)).fetchall()
            return [memory_dict(connection, row) for row in rows]

    @app.get("/api/memories/{memory_id}")
    def get_memory(memory_id: str, owner_hash: Annotated[str, Depends(owner)]):
        with db.connect() as connection:
            return memory_dict(connection, owned(connection, memory_id, owner_hash))

    @app.post("/api/memories/{memory_id}/letters", status_code=201)
    def create_letter(memory_id: str, payload: LetterCreate, owner_hash: Annotated[str, Depends(owner)], idempotency_key: Annotated[str | None, Header(min_length=16, max_length=128)] = None):
        letter_id, now = str(uuid4()), datetime.now(UTC).isoformat()
        fingerprint = payload_hash(payload)
        with db.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            owned(connection, memory_id, owner_hash)
            existing = previous_request(connection, owner_hash, "letter", idempotency_key, fingerprint)
            if existing is not None:
                return letter_dict(connection.execute(LETTER_QUERY + " WHERE l.id=?", (existing,)).fetchone())
            connection.execute("INSERT INTO letters VALUES (?, ?, ?, ?, ?, ?)", (letter_id, memory_id, payload.recipient, payload.text, payload.branch, now))
            connection.execute("UPDATE memories SET updated_at=? WHERE id=?", (now, memory_id))
            remember_request(connection, owner_hash, "letter", idempotency_key, letter_id, fingerprint, now)
            return letter_dict(connection.execute(LETTER_QUERY + " WHERE l.id=?", (letter_id,)).fetchone())

    @app.get("/api/memories/{memory_id}/letters")
    def list_letters(memory_id: str, owner_hash: Annotated[str, Depends(owner)]):
        with db.connect() as connection:
            owned(connection, memory_id, owner_hash)
            return letters_for_memory(connection, memory_id)

    @app.delete("/api/memories/{memory_id}")
    def delete_memory(memory_id: str, owner_hash: Annotated[str, Depends(owner)]):
        with db.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            owned(connection, memory_id, owner_hash)
            connection.execute("DELETE FROM idempotency_keys WHERE owner_token_hash=? AND ((resource_type='memory' AND resource_id=?) OR (resource_type='letter' AND resource_id IN (SELECT id FROM letters WHERE memory_id=?)))", (owner_hash, memory_id, memory_id))
            connection.execute("DELETE FROM memories WHERE id=? AND owner_token_hash=?", (memory_id, owner_hash))
        return {"deleted": True, "id": memory_id}

    @app.get("/api/assets")
    def list_assets():
        return {"provider": "local", "lux3dEnabled": False, "assets": assets.list_assets()}

    @app.post("/api/assets/generations")
    def create_generation(payload: AssetRequest, idempotency_key: Annotated[str | None, Header()] = None):
        provider = Lux3DProvider() if payload.provider == "lux3d" else assets
        try:
            return provider.create_job(payload, idempotency_key or "disabled")
        except GenerationDisabled as exc:
            raise HTTPException(501, {"code": "FEATURE_DISABLED", "message": str(exc)}) from exc

    @app.get("/api/assets/generations/{job_id}")
    def get_generation(job_id: str):
        try:
            return assets.get_job(job_id)
        except GenerationDisabled as exc:
            raise HTTPException(501, {"code": "FEATURE_DISABLED", "message": str(exc)}) from exc

    return app


app = create_app()
