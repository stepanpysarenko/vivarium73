from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import numpy as np

app = FastAPI()

GRID_SIZE = 100

class Position(BaseModel):
    x: int
    y: int

class Creature(BaseModel):
    x: int
    y: int
    weights: List[List[float]]  # Neural network weights (2 values)

class GameState(BaseModel):
    creatures: List[Creature]
    food: List[Position]

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

@app.get("/")
def read_root():
    return {"message": "AI Backend for vivarium73 is running!"}

@app.post("/move")
def move_creatures(state: GameState):
    new_positions = []
    remaining_food = state.food.copy()

    for creature in state.creatures:
        # Find nearest food
        nearest_food = min(
            remaining_food, key=lambda f: abs(f.x - creature.x) + abs(f.y - creature.y), default=None
        )

        if nearest_food:
            dx = nearest_food.x - creature.x
            dy = nearest_food.y - creature.y
        else:
            dx, dy = 0, 0  # No food nearby

        # Neural network decision
        inputs = np.array([dx, dy])
        weights = np.array(creature.weights)  # Two sets of weights for X and Y movement
        output_x, output_y = sigmoid(np.dot(inputs, weights[0])), sigmoid(np.dot(inputs, weights[1]))  

        # Convert NN output into movement
        move_x = 1 if output_x > 0.5 else -1 if output_x < -0.5 else 0
        move_y = 1 if output_y > 0.5 else -1 if output_y < -0.5 else 0

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