import os
from fastapi.testclient import TestClient

from nn_service.main import app
from nn_service import logic

client = TestClient(app)


def test_healthcheck():
    response = client.get("/api/health")
    assert response.status_code == 200
    expected_version = os.getenv("APP_VERSION", "dev")
    assert response.json() == {
        "status": "OK",
        "appVersion": expected_version
    }


def test_init_weights_length():
    response = client.get("/api/weights/init")
    assert response.status_code == 200
    data = response.json()
    expected_len = logic.HIDDEN_SIZE * logic.INPUT_SIZE + logic.OUTPUT_SIZE * logic.HIDDEN_SIZE
    assert "weights" in data
    assert len(data["weights"]) == expected_len


def test_mutate_weights_changes_values():
    weight_count = logic.HIDDEN_SIZE * logic.INPUT_SIZE + logic.OUTPUT_SIZE * logic.HIDDEN_SIZE
    weights = [0.0] * weight_count
    response = client.post("/api/weights/mutate", json={"weights": weights})
    assert response.status_code == 200
    data = response.json()
    assert "weights" in data
    assert len(data["weights"]) == weight_count
    assert any(w != 0.0 for w in data["weights"])


def test_think_returns_movements():
    weight_count = logic.HIDDEN_SIZE * logic.INPUT_SIZE + logic.OUTPUT_SIZE * logic.HIDDEN_SIZE
    weights = [0.0] * weight_count

    state = {
        "creatures": [
            {
                "id": 1,
                "x": 0,
                "y": 0,
                "angle": 0,
                "sex": "F",
                "wanderAngle": 0.0,
                "wanderStrength": 1.0,
                "energy": 100.0,
                "prevX": 0,
                "prevY": 0,
                "prevAngle": 0,
                "recentPath": [{"x": 0, "y": 0}, {"x": 0, "y": 0}],
                "prevEnergy": 100.0,
                "justReproduced": False,
                "matingCooldown": 0.0,
                "weights": weights,
                "food": [],
                "obstacles": [],
                "creatures": []
            }
        ],
        "gridSize": 50,
        "visibilityRadius": 10,
        "maxEnergy": 1000,
        "maxTurnAngle": 50,
        "maxSpeed": 1.0
    }

    response = client.post("/api/think", json=state)
    assert response.status_code == 200
    data = response.json()
    assert "movements" in data
    assert isinstance(data["movements"], list)
    assert len(data["movements"]) == 1
    assert "angleDelta" in data["movements"][0]
    assert "speed" in data["movements"][0]
    assert "mateIntent" in data["movements"][0]


def test_wander_vector_creates_movement():
    weight_count = logic.HIDDEN_SIZE * logic.INPUT_SIZE + logic.OUTPUT_SIZE * logic.HIDDEN_SIZE
    weights = logic.init_weights()["weights"]

    state = {
        "creatures": [
            {
                "id": 1,
                "x": 0,
                "y": 0,
                "angle": 0,
                "sex": "F",
                "wanderAngle": 1.0,
                "wanderStrength": 1.0,
                "energy": 100.0,
                "prevX": 0,
                "prevY": 0,
                "prevAngle": 0,
                "recentPath": [{"x": 0, "y": 0}, {"x": 0, "y": 0}],
                "prevEnergy": 100.0,
                "justReproduced": False,
                "matingCooldown": 0.0,
                "weights": weights,
                "food": [],
                "obstacles": [],
                "creatures": []
            }
        ],
        "gridSize": 50,
        "visibilityRadius": 10,
        "maxEnergy": 1000,
        "maxTurnAngle": 50,
        "maxSpeed": 1.0
    }

    response = client.post("/api/think", json=state)
    assert response.status_code == 200
    data = response.json()
    movement = data["movements"][0]
    assert movement["angleDelta"] != 0 or movement["speed"] != 0
