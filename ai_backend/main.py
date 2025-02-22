from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict
from logic import think

GRID_SIZE = 100

app = FastAPI()

class Position(BaseModel):
    x: int
    y: int

class Creature(BaseModel):
    x: int
    y: int
    weights: List[List[float]]  # Neural network weights

class GameState(BaseModel):
    creatures: List[Creature]
    food: List[Position]

@app.get("/")
def read_root():
    return {"message": "AI Backend for vivarium73 is running!"}

@app.post("/move")
async def move_creatures(state: GameState):
    new_positions = []
    remaining_food = state.food.copy()
    for creature in state.creatures:
        move_x, move_y = think(creature, state.food, GRID_SIZE)
                
        # Update position within grid
        new_x = max(0, min(GRID_SIZE - 1, creature.x + move_x))
        new_y = max(0, min(GRID_SIZE - 1, creature.y + move_y))

        # Check if creature eats food
        if any(f.x == new_x and f.y == new_y for f in remaining_food):
            remaining_food = [f for f in remaining_food if not (f.x == new_x and f.y == new_y)]

        new_positions.append({"x": new_x, "y": new_y, "weights": creature.weights})

    return {"creatures": new_positions, "food": [vars(f) for f in remaining_food]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)