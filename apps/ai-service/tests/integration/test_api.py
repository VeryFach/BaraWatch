def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["active_models"] == {}
    assert "X-Request-ID" in response.headers


def test_internal_endpoint_requires_key(client):
    response = client.get("/v1/ping")
    assert response.status_code == 401


def test_internal_endpoint_rejects_wrong_key(client):
    response = client.get("/v1/ping", headers={"X-Internal-Key": "wrong"})
    assert response.status_code == 401


def test_internal_endpoint_with_key(client):
    response = client.get("/v1/ping", headers={"X-Internal-Key": "a" * 40})
    assert response.status_code == 200
    assert response.json() == {"message": "pong"}


def test_openapi_available(client):
    schema = client.get("/openapi.json").json()
    assert "/health" in schema["paths"]
    assert "/v1/ping" in schema["paths"]