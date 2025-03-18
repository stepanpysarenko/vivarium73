import numpy as np
import random
from fastapi import FastAPI

app = FastAPI()

# Corrected layer sizes
INPUT_SIZE = 5    
HIDDEN_SIZE = 6   
OUTPUT_SIZE = 2   

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def tanh(x):
    return np.tanh(x)

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

def think(creature, food, grid_size, max_energy):
    """Decides movement based on food, borders, and movement history."""
    
    # Find the closest food if available
    if food:
        closest_food = min(food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)
        food_dx = 2 * (closest_food.x - creature.x) / grid_size
        food_dy = 2 * (closest_food.y - creature.y) / grid_size
    else:
        food_dx, food_dy = np.random.uniform(-1, 1), np.random.uniform(-1, 1)  # Encourage wandering

    # Encourage movement based on past motion instead of sticking in place
    move_dx = 2 * (creature.x - creature.prev_x) / grid_size  
    move_dy = 2 * (creature.y - creature.prev_y) / grid_size  

    # Normalize energy level
    energy_level = 2 * (creature.energy / max_energy) - 1  

    # AI Inputs: Food direction, energy level, movement history
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
    output = np.dot(output_weights, hidden_layer) 

    move_x = 1 if output[0] > 0.5 else (-1 if output[0] < -0.5 else 0)
    move_y = 1 if output[1] > 0.5 else (-1 if output[1] < -0.5 else 0)

    exploration_factor = tanh(output[0] + output[1])
    if np.random.rand() < (0.2 + 0.3 * (1 - abs(exploration_factor))):
        move_x = random.choice([-1, 0, 1])
        move_y = random.choice([-1, 0, 1])

    return {"move_x": move_x, "move_y": move_y}