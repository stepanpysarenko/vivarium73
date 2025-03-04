from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from ai_logic import (init_weights, think)

app = FastAPI()

class Creature(BaseModel):
    id: int
    x: int
    y: int
    prev_x: int
    prev_y: int
    weights: List[float]
    energy: int
    generation: int

class Food(BaseModel):
    x: int
    y: int

class GameState(BaseModel):
    creatures: List[Creature]
    food: List[Food]
    grid_size: int
    max_energy: int

# @app.get("/init_weights")
# def get_init_weights():
#     return init_weights()

@app.post("/think")
def get_movements(state: GameState):
    movements = []
    for creature in state.creatures:
        move = think(creature, [food for food in state.food], state.grid_size, state.max_energy)
        movements.append(move)
    return movements

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)