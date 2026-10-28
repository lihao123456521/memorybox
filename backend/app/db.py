import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY, owner_token_hash TEXT NOT NULL,
                    draft_json TEXT NOT NULL, story_json TEXT NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_memories_owner ON memories(owner_token_hash);
                CREATE TABLE IF NOT EXISTS letters (
                    id TEXT PRIMARY KEY, memory_id TEXT NOT NULL,
                    recipient TEXT NOT NULL, text TEXT NOT NULL, branch TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                    owner_token_hash TEXT NOT NULL, resource_type TEXT NOT NULL,
                    client_key TEXT NOT NULL, resource_id TEXT NOT NULL,
                    request_hash TEXT NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(owner_token_hash, resource_type, client_key)
                );
                CREATE INDEX IF NOT EXISTS idx_idempotency_resource ON idempotency_keys(resource_type, resource_id);
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(str(self.path), timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()


def letter_dict(row) -> dict:
    return {"id": row["id"], "memoryId": row["memory_id"], "recipient": row["recipient"], "text": row["text"], "branch": row["branch"], "createdAt": row["created_at"], "clientId": row["client_id"] if "client_id" in row.keys() else None}


LETTER_QUERY = """SELECT l.*, k.client_key AS client_id FROM letters l
    LEFT JOIN idempotency_keys k ON k.resource_type='letter' AND k.resource_id=l.id"""


def letters_for_memory(db, memory_id: str) -> list[dict]:
    return [letter_dict(row) for row in db.execute(LETTER_QUERY + " WHERE l.memory_id=? ORDER BY l.created_at", (memory_id,)).fetchall()]


def memory_dict(db, row) -> dict:
    return {"id": row["id"], "draft": json.loads(row["draft_json"]), "story": json.loads(row["story_json"]), "createdAt": row["created_at"], "updatedAt": row["updated_at"], "letters": letters_for_memory(db, row["id"])}
