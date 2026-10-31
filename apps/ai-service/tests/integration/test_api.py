from app.core.config import get_settings


def test_health(client):
    response = client.get("/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
    assert data["version"] == "0.2.0"

def test_internal_endpoint_requires_key(client):
    response = client.get("/v1/ping")

    assert response.status_code == 401

def test_internal_endpoint_rejects_wrong_key(client):
    response = client.get(
        "/v1/ping",
        headers={
            "X-Internal-Key": "wrong"
        },
    )

    assert response.status_code == 401

def test_internal_endpoint_with_key(client):
    response = client.get(
        "/v1/ping",
        headers={
            "X-Internal-Key": "a" * 40
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_openapi_available(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200

    schema = response.json()

    assert "/health" in schema["paths"]
    assert "/v1/ping" in schema["paths"]
    assert "/v1/cluster" in schema["paths"]

def test_cluster_requires_key(client):
    response = client.post(
        "/v1/cluster",
        json={"hotspots": []},
    )

    assert response.status_code == 401

def test_cluster_empty_input(client):
    response = client.post(
        "/v1/cluster",
        headers={
            "X-Internal-Key": "a" * 40
        },
        json={
            "hotspots": [],
            "open_incidents": [],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["clusters"] == []
    assert data["input_count"] == 0