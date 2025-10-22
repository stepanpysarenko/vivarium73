import math

from fastapi.testclient import TestClient

from nn_service import logic
from nn_service.main import app

client = TestClient(app)


def test_mutate_weights_within_bounds():
    weights = [1.0, -1.0, 0.25, -0.75]
    mutated = logic.mutate_weights(weights)["weights"]

    assert len(mutated) == len(weights)
    assert all(-1.0 <= value <= 1.0 for value in mutated)


def test_think_endpoint_matches_creature_count():
    weight_count = logic.HIDDEN_SIZE * logic.INPUT_SIZE + logic.OUTPUT_SIZE * logic.HIDDEN_SIZE
    weights = [0.0] * weight_count

    state = {
        "creatures": [
            {
                "id": idx + 1,
                "x": 0.0,
                "y": 0.0,
                "angle": 0.0,
                "sex": "F" if idx % 2 == 0 else "M",
                "wanderAngle": 0.0,
                "wanderStrength": 0.5,
                "energy": 100.0,
                "prevX": 0.0,
                "prevY": 0.0,
                "prevAngle": 0.0,
                "recentPath": [{"x": 0.0, "y": 0.0}, {"x": 0.0, "y": 0.0}],
                "prevEnergy": 100.0,
                "justReproduced": False,
                "matingCooldown": 0.0,
                "weights": weights,
                "food": [],
                "obstacles": [],
                "creatures": [],
            }
            for idx in range(2)
        ],
        "gridSize": 10,
        "visibilityRadius": 5,
        "maxEnergy": 1000,
        "maxTurnAngle": math.pi / 2,
        "maxSpeed": 1.0,
    }

    response = client.post("/api/think", json=state)
    assert response.status_code == 200

    data = response.json()
    movements = data["movements"]

    assert len(movements) == len(state["creatures"])
    for original, movement in zip(state["creatures"], movements):
        assert movement["id"] == original["id"]
        assert {"angleDelta", "speed", "mateIntent"}.issubset(movement.keys())
