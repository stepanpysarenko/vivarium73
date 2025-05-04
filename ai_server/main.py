from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from logic import (init_weights, mutate_weights, think)

app = FastAPI()

class Position(BaseModel):
    x: int
    y: int

class Creature(BaseModel):
    id: int
    x: float
    y: float
    facing_angle: float
    energy: float
    prev_x: float
    prev_y: float
    prev_facing_angle: float
    prev_energy: float
    just_reproduced: bool
    weights: List[float]
    food: List[Position]
    obstacles: List[Position]

class State(BaseModel):
    creatures: List[Creature]
    grid_size: int
    max_energy: int
    visibility_radius: int

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
    movements = []
    for creature in state.creatures:
        move = think(creature, state.grid_size, state.max_energy, state.visibility_radius)
        movements.append(move)
    return { "movements": movements }