from fastapi.testclient import TestClient

from app.main import VERSION, app

client = TestClient(app)


def test_health_returns_ok_and_version() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == VERSION
