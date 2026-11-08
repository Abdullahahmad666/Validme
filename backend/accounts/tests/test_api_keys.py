from rest_framework.test import APIClient

from accounts.models import ApiKey
from accounts.services import MAX_ACTIVE_API_KEYS


def auth(raw: str) -> dict:
    return {"HTTP_AUTHORIZATION": f"Api-Key {raw}"}


def test_create_returns_raw_key_once(api, user):
    r = api.post("/api/api-keys", {"name": "Claude Desktop"}, format="json")
    assert r.status_code == 201
    raw = r.json()["key"]
    assert raw.startswith("vm_")
    listed = api.get("/api/api-keys").json()["results"]
    assert len(listed) == 1
    assert "key" not in listed[0]
    assert ApiKey.objects.get().key_hash != raw  # only the hash is stored
    # The key authenticates the API (this is how the MCP server calls it).
    assert APIClient().get("/api/me", **auth(raw)).json()["email"] == user.email


def test_revoke_disables_key(api):
    created = api.post("/api/api-keys", {"name": "mcp"}, format="json").json()
    assert api.delete(f"/api/api-keys/{created['id']}").status_code == 204
    assert APIClient().get("/api/me", **auth(created["key"])).status_code == 401
    assert api.get("/api/api-keys").json()["count"] == 0


def test_other_user_cannot_see_or_revoke_key(api, other_api):
    created = api.post("/api/api-keys", {"name": "mcp"}, format="json").json()
    assert other_api.get("/api/api-keys").json()["count"] == 0
    assert other_api.delete(f"/api/api-keys/{created['id']}").status_code == 404
    assert ApiKey.objects.get(pk=created["id"]).revoked is False


def test_name_required(api):
    r = api.post("/api/api-keys", {"name": ""}, format="json")
    assert r.status_code == 400
    assert "name" in r.json()["error"]["details"]


def test_active_key_limit(api, user):
    for i in range(MAX_ACTIVE_API_KEYS):
        ApiKey.issue(user, f"k{i}")
    r = api.post("/api/api-keys", {"name": "one more"}, format="json")
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "api_key_limit"


def test_api_key_cannot_manage_keys_or_account(api):
    raw = api.post("/api/api-keys", {"name": "mcp"}, format="json").json()["key"]
    mcp = APIClient()
    assert mcp.get("/api/me", **auth(raw)).status_code == 200  # reading is fine
    assert mcp.post("/api/api-keys", {"name": "attacker"}, format="json", **auth(raw)).status_code == 403
    assert mcp.get("/api/api-keys", **auth(raw)).status_code == 403
    assert mcp.patch("/api/me", {"first_name": "x"}, format="json", **auth(raw)).status_code == 403
    assert ApiKey.objects.count() == 1
