from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from ai_logic import think

app = FastAPI()

class Creature(BaseModel):
    id: int
    x: int
    y: int
    weights: List[List[float]]
    energy: int

class Food(BaseModel):
    x: int
    y: int

class GameState(BaseModel):
    creatures: List[Creature]
    food: List[Food]
    grid_size: int

@app.post("/ai/move")
def compute_movements(state: GameState):
    movements = []
    for creature in state.creatures:
        move = think(creature, [food for food in state.food], state.grid_size)
        movements.append(move)
    return movements

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)