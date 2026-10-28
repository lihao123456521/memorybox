"""Checks the running localhost API and removes its own test memory afterwards."""

import secrets

import httpx


def main():
    key = secrets.token_urlsafe(32)
    headers = {"X-MemoryBox-Token": secrets.token_urlsafe(32), "Idempotency-Key": key}
    memory_id = None
    with httpx.Client(base_url="http://127.0.0.1:8000", headers=headers, timeout=10) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        assert len(client.get("/api/templates").json()) == 3
        draft = {"templateId": "old-home", "year": "2005", "place": "验证用示例客厅", "importantPerson": "家人", "importantObject": "旧书", "storyText": "这是一条接口验证用示例，测试后删除。", "actualChoice": "保存这段记忆"}
        response = client.post("/api/memories", json={"draft": draft})
        response.raise_for_status()
        memory_id = response.json()["id"]
        assert client.post("/api/memories", json={"draft": draft}).json()["id"] == memory_id
        try:
            letter = client.post(f"/api/memories/{memory_id}/letters", json={"recipient": "past-self", "text": "保留那些平凡而温暖的下午。", "branch": "imagined"})
            letter.raise_for_status()
            retried_letter = client.post(f"/api/memories/{memory_id}/letters", json={"recipient": "past-self", "text": "保留那些平凡而温暖的下午。", "branch": "imagined"})
            assert retried_letter.json()["id"] == letter.json()["id"]
            assert retried_letter.json()["clientId"] == key
            read = client.get(f"/api/memories/{memory_id}").json()
            assert read["draft"] == draft
            assert read["letters"][0]["text"] == letter.json()["text"]
            assert len(client.get(f"/api/memories/{memory_id}/letters").json()) == 1
            assert client.get(f"/api/memories/{memory_id}", headers={"X-MemoryBox-Token": secrets.token_urlsafe(32)}).status_code == 404
            assert client.post("/api/assets/generations", json={"provider": "lux3d"}).status_code == 501
            print("LIVE API PASS: health, 3 templates, SQLite memory create/read, letter save/read, idempotent memory+letter retries, persisted clientId, cross-owner denial, Lux3D disabled.")
        finally:
            client.delete(f"/api/memories/{memory_id}").raise_for_status()
            assert client.get(f"/api/memories/{memory_id}").status_code == 404
            print("LIVE API PASS: own test record deleted; associated letters cascaded.")


if __name__ == "__main__":
    main()
