from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from ai_logic import (init_weights, mutate_weights, think)

app = FastAPI()

class Creature(BaseModel):
    id: int
    x: int
    y: int
    prev_x: int
    prev_y: int
    weights: List[float]
    energy: int

class Food(BaseModel):
    x: int
    y: int

class GameState(BaseModel):
    creatures: List[Creature]
    food: List[Food]
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
        move = think(creature, [food for food in state.food], state.grid_size, state.max_energy)
        movements.append(move)
    return movements