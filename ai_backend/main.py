from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

GRID_SIZE = 100

class Creature(BaseModel):
    x: int
    y: int

@app.get("/")
def read_root():
    return {"message": "AI Backend for vivarium73 is running!"}

@app.post("/move")
def move_creatures(creatures: list[Creature]):
    updated_creatures = []
    for creature in creatures:
        new_x = max(0, min(GRID_SIZE - 1, creature.x + random.choice([-1, 0, 1])))
        new_y = max(0, min(GRID_SIZE - 1, creature.y + random.choice([-1, 0, 1])))
        updated_creatures.append({"x": new_x, "y": new_y})
    
    return updated_creatures

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)
