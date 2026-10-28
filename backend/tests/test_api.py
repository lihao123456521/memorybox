import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


DRAFT = {
    "templateId": "old-home", "year": "2005", "place": "奶奶家的客厅",
    "importantPerson": "奶奶", "importantObject": "红色布娃娃",
    "storyText": "暑假的下午，奶奶在厨房忙，我抱着她做的布娃娃看电视。傍晚我要回自己家。",
    "actualChoice": "傍晚和父母离开",
}
OWNER = {"X-MemoryBox-Token": "owner-token-1234567890"}
OTHER = {"X-MemoryBox-Token": "different-owner-token-1234567890"}


@pytest.fixture
def api(tmp_path):
    path = tmp_path / "test.sqlite3"
    with TestClient(create_app(str(path))) as client:
        yield client, path


def create(api, headers=OWNER):
    response = api[0].post("/api/memories", json={"draft": DRAFT}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_health_and_templates(api):
    client, _ = api
    health = client.get("/api/health").json()
    assert health["status"] == "ok" and health["mode"] == "demo"
    assert health["lux3dEnabled"] is False
    templates = client.get("/api/templates").json()
    assert {t["id"] for t in templates} == {"old-home", "station", "classroom"}
    assert client.get("/api/templates/station").json()["sceneStatus"] == "shared-scene"
    assert client.get("/api/templates/missing").status_code == 404


@pytest.mark.parametrize("template_id", ["old-home", "station", "classroom"])
def test_compose_structure_and_facts(api, template_id):
    client, _ = api
    draft = {**DRAFT, "templateId": template_id, "place": "旧书房", "importantPerson": "舅舅", "storyText": "那天，我们一起整理旧书。", "actualChoice": "我选择留下吃晚饭"}
    response = client.post("/api/memories/compose", json=draft)
    assert response.status_code == 200
    story = response.json()
    assert story["mode"] == "template-demo"
    assert story["facts"]["person"] == "舅舅"
    assert story["facts"]["actualChoice"] == draft["actualChoice"]
    assert {a["id"] for a in story["anchors"]} == {"tv", "doll", "photo"}
    assert "并非真实历史" in story["decision"]["imagined"]["disclaimer"]
    assert draft["actualChoice"] in story["decision"]["real"]["script"][0]
    assert draft["storyText"] in story["decision"]["real"]["script"][1]
    assert "奶奶" not in "".join(a["narration"] for a in story["anchors"])


def test_memory_letter_roundtrip_and_delete_cascade(api):
    client, path = api
    memory = create(api)
    assert memory["draft"] == DRAFT
    assert memory["letters"] == []
    assert len(client.get("/api/memories", headers=OWNER).json()) == 1
    letter = {"recipient": "那时的自己", "text": "  不要总着急长大。记住那天下午的光。  ", "branch": "imagined"}
    response = client.post(f"/api/memories/{memory['id']}/letters", json=letter, headers=OWNER)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["text"] == letter["text"].strip()
    reread = client.get(f"/api/memories/{memory['id']}", headers=OWNER).json()
    assert reread["letters"] == [saved]
    assert client.get(f"/api/memories/{memory['id']}/letters", headers=OWNER).json() == [saved]
    assert client.delete(f"/api/memories/{memory['id']}", headers=OWNER).status_code == 200
    assert client.get(f"/api/memories/{memory['id']}", headers=OWNER).status_code == 404
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM letters").fetchone()[0] == 0


def test_owner_isolation_and_missing_credentials(api):
    client, _ = api
    memory = create(api)
    route = f"/api/memories/{memory['id']}"
    assert client.get("/api/memories").status_code == 401
    assert client.get(route, headers=OTHER).status_code == 404
    assert client.get("/api/memories", headers=OTHER).json() == []
    assert client.delete(route, headers=OTHER).status_code == 404
    assert client.post(route + "/letters", json={"recipient": "我", "text": "test", "branch": "real"}, headers=OTHER).status_code == 404
    assert client.get(route, headers=OWNER).status_code == 200


@pytest.mark.parametrize("bad", [{**DRAFT, "storyText": "  "}, {**DRAFT, "templateId": "unknown"}, {**DRAFT, "year": ""}, {**DRAFT, "place": "x" * 121}])
def test_bad_draft_inputs(api, bad):
    response = api[0].post("/api/memories", json={"draft": bad}, headers=OWNER)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_empty_letter_and_server_owns_story(api):
    client, _ = api
    response = client.post("/api/memories", json={"draft": DRAFT, "story": {"title": "untrusted-client-script"}}, headers=OWNER)
    assert response.status_code == 201
    memory = response.json()
    assert memory["story"]["title"] != "untrusted-client-script"
    blank = client.post(f"/api/memories/{memory['id']}/letters", json={"recipient": "我", "text": "  \n ", "branch": "real"}, headers=OWNER)
    assert blank.status_code == 422


def test_rich_demo_details_require_exact_confirmed_example(api):
    client, _ = api
    example = {**DRAFT, "storyText": "暑假的下午，奶奶在厨房忙，我抱着她做的布娃娃看电视。窗外有蝉鸣，阳光落在地板上。傍晚，我要和父母回自己家。", "actualChoice": "傍晚和父母离开，向奶奶挥手告别。"}
    rich = client.post("/api/memories/compose", json=example).json()
    assert "黑纽扣" in rich["anchors"][1]["narration"]
    edited = client.post("/api/memories/compose", json={**example, "storyText": "我和奶奶一起看了一本旧书。"}).json()
    assert "黑纽扣" not in edited["anchors"][1]["narration"]
    assert "象征替身" in edited["anchors"][1]["narration"]


def test_generation_never_claims_success(api):
    client, _ = api
    for provider in ("local", "lux3d"):
        response = client.post("/api/assets/generations", json={"provider": provider, "prompt": "a red doll"})
        assert response.status_code == 501
        assert response.json()["error"]["code"] == "FEATURE_DISABLED"
    assert client.get("/api/assets/generations/fake-task").status_code == 501
    assert client.get("/api/assets").json()["lux3dEnabled"] is False


def test_cors_is_local_allowlist(api):
    client, _ = api
    allowed = client.options("/api/memories", headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-MemoryBox-Token,Content-Type"})
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    rejected = client.options("/api/memories", headers={"Origin": "https://unrelated.example", "Access-Control-Request-Method": "POST"})
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers


def test_idempotent_retry_after_response_loss(api):
    client, path = api
    key = "a7df22aa-1630-4890-bbb0-1dab1cb7685c"
    headers = {**OWNER, "Idempotency-Key": key}
    # A caller can lose the first HTTP response after commit; resending is equivalent.
    first = client.post("/api/memories", json={"draft": DRAFT}, headers=headers)
    retry = client.post("/api/memories", json={"draft": DRAFT}, headers=headers)
    assert first.status_code == retry.status_code == 201
    assert first.json()["id"] == retry.json()["id"]
    memory_id = first.json()["id"]
    letter = {"recipient": "past-self", "text": "Save exactly once, even when the response is lost.", "branch": "real"}
    first_letter = client.post(f"/api/memories/{memory_id}/letters", json=letter, headers=headers)
    retry_letter = client.post(f"/api/memories/{memory_id}/letters", json=letter, headers=headers)
    assert first_letter.status_code == retry_letter.status_code == 201
    assert first_letter.json() == retry_letter.json()
    assert first_letter.json()["clientId"] == key
    assert client.get(f"/api/memories/{memory_id}/letters", headers=OWNER).json()[0]["clientId"] == key
    assert client.get(f"/api/memories/{memory_id}", headers=OWNER).json()["letters"][0]["clientId"] == key
    assert client.get("/api/memories", headers=OWNER).json()[0]["letters"][0]["clientId"] == key
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM memories").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM letters").fetchone()[0] == 1
        # Reusing the UUID across memory/letter endpoints is intentionally safe.
        assert connection.execute("SELECT COUNT(*) FROM idempotency_keys").fetchone()[0] == 2


def test_idempotency_keys_are_owner_scoped(api):
    client, _ = api
    key = "37d66f61-64af-4c61-b99a-33ac53c4efca"
    owner_headers = {**OWNER, "Idempotency-Key": key}
    other_headers = {**OTHER, "Idempotency-Key": key}
    owner_memory = client.post("/api/memories", json={"draft": DRAFT}, headers=owner_headers).json()
    other_memory = client.post("/api/memories", json={"draft": DRAFT}, headers=other_headers).json()
    assert owner_memory["id"] != other_memory["id"]
    body = {"recipient": "past-self", "text": "Owner isolated retry", "branch": "imagined"}
    owner_letter = client.post(f"/api/memories/{owner_memory['id']}/letters", json=body, headers=owner_headers).json()
    other_letter = client.post(f"/api/memories/{other_memory['id']}/letters", json=body, headers=other_headers).json()
    assert owner_letter["id"] != other_letter["id"]
    assert client.get(f"/api/memories/{owner_memory['id']}", headers=OTHER).status_code == 404


def test_reusing_key_for_changed_payload_is_explicit_conflict(api):
    client, _ = api
    headers = {**OWNER, "Idempotency-Key": "27e07911-0e08-4daa-8c4b-b9cc3e8ab717"}
    memory = client.post("/api/memories", json={"draft": DRAFT}, headers=headers).json()
    changed = client.post("/api/memories", json={"draft": {**DRAFT, "year": "2006"}}, headers=headers)
    assert changed.status_code == 409
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    body = {"recipient": "past-self", "text": "First letter", "branch": "real"}
    assert client.post(f"/api/memories/{memory['id']}/letters", json=body, headers=headers).status_code == 201
    changed_letter = client.post(f"/api/memories/{memory['id']}/letters", json={**body, "text": "Different letter"}, headers=headers)
    assert changed_letter.status_code == 409
    assert len(client.get(f"/api/memories/{memory['id']}/letters", headers=OWNER).json()) == 1


def test_delete_clears_its_idempotency_ledger(api):
    client, path = api
    headers = {**OWNER, "Idempotency-Key": "fe67479a-a1cd-4593-9bc6-949174688fc4"}
    memory = client.post("/api/memories", json={"draft": DRAFT}, headers=headers).json()
    client.post(f"/api/memories/{memory['id']}/letters", json={"recipient": "past-self", "text": "Delete this record", "branch": "real"}, headers=headers)
    assert client.delete(f"/api/memories/{memory['id']}", headers=OWNER).status_code == 200
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM idempotency_keys").fetchone()[0] == 0
    retry = client.post("/api/memories", json={"draft": DRAFT}, headers=headers)
    assert retry.status_code == 201
    assert retry.json()["id"] != memory["id"]


def test_simultaneous_retries_are_atomic(api):
    client, path = api
    headers = {**OWNER, "Idempotency-Key": "9e52af6e-b7aa-40ff-951d-203c8ddcd7b5"}
    def post_retry(_):
        return client.post("/api/memories", json={"draft": DRAFT}, headers=headers)
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(post_retry, range(6)))
    assert {response.status_code for response in responses} == {201}
    assert len({response.json()["id"] for response in responses}) == 1
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM memories").fetchone()[0] == 1
