from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List
from logic import init_weights, mutate_weights, think

app = FastAPI()

class Position(BaseModel):
    x: float
    y: float

class Creature(BaseModel):
    id: int
    x: float
    y: float
    angle: float
    energy: float
    prev_x: float = Field(..., alias="prevX")
    prev_y: float = Field(..., alias="prevY")
    prev_angle: float = Field(..., alias="prevAngle")
    recent_path: List[Position] = Field(..., alias="recentPath")
    prev_energy: float = Field(..., alias="prevEnergy")
    just_reproduced: bool = Field(..., alias="justReproduced")
    weights: List[float]
    food: List[Position]
    obstacles: List[Position]
    creatures: List[Position]

class State(BaseModel):
    creatures: List[Creature]
    grid_size: int = Field(..., alias="gridSize")
    visibility_radius: int = Field(..., alias="visibilityRadius")
    max_energy: float = Field(..., alias="maxEnergy")
    max_turn_angle: float = Field(..., alias="maxTurnAngle")
    max_speed: float = Field(..., alias="maxSpeed")

    class Config:
        allow_population_by_field_name = True

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
