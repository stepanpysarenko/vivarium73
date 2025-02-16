from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI()

# Define the grid size and number of creatures
GRID_SIZE = 100
CREATURE_COUNT = 20

# Define the Creature model
class Creature(BaseModel):
    x: int
    y: int

# Initialize the creatures with random positions
creatures = [Creature(x=random.randint(0, GRID_SIZE-1), y=random.randint(0, GRID_SIZE-1)) for _ in range(CREATURE_COUNT)]

@app.get("/move")
def move_creatures():
    # Update the positions of the creatures randomly
    for creature in creatures:
        creature.x = (creature.x + random.choice([-1, 0, 1])) % GRID_SIZE
        creature.y = (creature.y + random.choice([-1, 0, 1])) % GRID_SIZE
    return creatures