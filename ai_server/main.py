from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from logic import (init_weights, mutate_weights, think)

app = FastAPI()

class Food(BaseModel):
    x: int
    y: int

class Creature(BaseModel):
    id: int
    x: float
    y: float
    prev_x: float
    prev_y: float
    weights: List[float]
    energy: int
    visible_food: List[Food]

class GameState(BaseModel):
    creatures: List[Creature]
    grid_size: int
    max_energy: int

class MutateRequest(BaseModel):
    weights: List[float]

@app.get("/api/health")
def healthcheck():
    return {"status": "OK"}

@app.get("/api/weights/init")
def initweights():
    return init_weights()

@app.post("/api/weights/mutate")
def mutateweights(request: MutateRequest):
    return mutate_weights(request.weights)

@app.post("/api/think")
def get_movements(state: GameState):
    movements = []
    for creature in state.creatures:
        move = think(creature, state.grid_size, state.max_energy)
        movements.append(move)
    return movements