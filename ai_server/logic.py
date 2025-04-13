import numpy as np
import random
from fastapi import FastAPI

app = FastAPI()

INPUT_SIZE = 5    
HIDDEN_SIZE = 6   
OUTPUT_SIZE = 2   

def init_weights():
    """Initialize a flat list of random weights for a new creature."""
    total_weights_hidden = HIDDEN_SIZE * INPUT_SIZE
    total_weights_output = OUTPUT_SIZE * HIDDEN_SIZE

    weights_hidden = np.random.uniform(-1, 1, total_weights_hidden)
    weights_output = np.random.uniform(-1, 1, total_weights_output)

    weights = np.concatenate([weights_hidden, weights_output]).tolist()
    return {"weights": weights}

def mutate_weights(weights):
    """Mutate the weights of a creature by adding a small random value."""
    mutated_weights = [w + (random.random() - 0.5) * 0.1 for w in weights]
    return {"weights": mutated_weights}

def think(creature, grid_size, max_energy):
    """Decide next movement for a creature based on its context."""   
    if len(creature.food) > 0:
        closest_food = min(creature.food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)
        food_dx = 2 * (closest_food.x - creature.x) / grid_size
        food_dy = 2 * (closest_food.y - creature.y) / grid_size
    else:
        food_dx, food_dy = 0, 0
    move_dx = 2 * (creature.x - creature.prev_x) / grid_size  
    move_dy = 2 * (creature.y - creature.prev_y) / grid_size  

    energy_level = 2 * (creature.energy / max_energy) - 1  

    inputs = np.array([
        food_dx,
        food_dy,
        energy_level,
        move_dx,
        move_dy
    ])

    weights = np.array(creature.weights)
    total_hidden_weights = HIDDEN_SIZE * INPUT_SIZE
    hidden_weights = weights[:total_hidden_weights].reshape(HIDDEN_SIZE, INPUT_SIZE)
    output_weights = weights[total_hidden_weights:].reshape(OUTPUT_SIZE, HIDDEN_SIZE)

    hidden_layer = np.tanh(np.dot(hidden_weights, inputs))
    output = np.tanh(np.dot(output_weights, hidden_layer))
    move_x = output[0]
    move_y = output[1] 

    exploration_factor = np.tanh(output[0] + output[1])
    if np.random.rand() < 0.3 + 0.4 * (1 - abs(exploration_factor)):
        angle = random.uniform(0, 2 * np.pi)
        magnitude = random.uniform(0.4, 0.7)

        move_x += magnitude * np.cos(angle)
        move_y += magnitude * np.sin(angle)

        move_x = np.clip(move_x, -1, 1)
        move_y = np.clip(move_y, -1, 1)

    return {"move_x": move_x, "move_y": move_y}