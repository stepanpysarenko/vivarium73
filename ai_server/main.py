from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from logic import (init_weights, mutate_weights, think)

app = FastAPI()

class Position(BaseModel):
    x: float
    y: float

class Creature(BaseModel):
    id: int
    x: float
    y: float
    facing_angle: float
    energy: float
    prev_x: float
    prev_y: float
    prev_facing_angle: float
    recent_path: List[Position]
    prev_energy: float
    just_reproduced: bool
    weights: List[float]
    food: List[Position]
    obstacles: List[Position]
    creatures: List[Position] 

class State(BaseModel):
    creatures: List[Creature]
    grid_size: int
    visibility_radius: int
    max_energy: float
    max_turn_angle: float
    max_speed: float

class MutateRequest(BaseModel):
    weights: List[float]

@app.get("/api/health")
def healthcheck():
    return { "status": "OK" }

@app.get("/api/weights/init")
def initweights():
    return init_weights()

@app.post("/api/weights/mutate")
def mutateweights(request: MutateRequest):
    return mutate_weights(request.weights)

@app.post("/api/think")
def get_movements(state: State):
    return {
        "movements": [
            think(
                creature,
                state.grid_size,
                state.visibility_radius,
                state.max_energy,
                state.max_turn_angle,
                state.max_speed
            )
            for creature in state.creatures
        ]
    }
