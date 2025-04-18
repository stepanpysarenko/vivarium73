import numpy as np
import random
from fastapi import FastAPI

app = FastAPI()

INPUT_SIZE = 10
HIDDEN_SIZE = 8
OUTPUT_SIZE = 2

def init_weights():
    total_weights_hidden = HIDDEN_SIZE * INPUT_SIZE
    total_weights_output = OUTPUT_SIZE * HIDDEN_SIZE
    weights_hidden = np.random.uniform(-1, 1, total_weights_hidden)
    weights_output = np.random.uniform(-1, 1, total_weights_output)
    weights = np.concatenate([weights_hidden, weights_output]).tolist()
    return {"weights": weights}

def mutate_weights(weights):
    mutated_weights = [w + (random.random() - 0.5) * 0.1 for w in weights]
    return {"weights": mutated_weights}

def compute_vector(x, y, targets, grid_size):
    vector_x, vector_y = 0.0, 0.0
    for t in targets:
        dx = t.x - x
        dy = t.y - y
        dist_sq = dx**2 + dy**2
        if dist_sq > 0:
            strength = 1 / dist_sq
            vector_x += dx * strength
            vector_y += dy * strength

    magnitude = np.hypot(vector_x, vector_y)
    if magnitude > 0:
        vector_x /= magnitude
        vector_y /= magnitude

    normalized_magnitude = 2 * (magnitude / np.sqrt(2)) - 1
    return vector_x, vector_y, np.clip(normalized_magnitude, -1, 1)

def think(creature, grid_size, max_energy):
    energy_level = 2 * (creature.energy / max_energy) - 1
    energy_dx = 2 * ((creature.energy - creature.prev_energy) / max_energy)
    move_dx = 2 * (creature.x - creature.prev_x) / grid_size
    move_dy = 2 * (creature.y - creature.prev_y) / grid_size
    just_reproduced = 1.0 if creature.just_reproduced else -1.0

    if creature.food:
        closest_food = min(creature.food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)
        food_dx = 2 * (closest_food.x - creature.x) / grid_size
        food_dy = 2 * (closest_food.y - creature.y) / grid_size
    else:
        food_dx = 0.0
        food_dy = 0.0

    obstacle_vector_x, obstacle_vector_y, obstacle_magnitude = compute_vector(
        creature.x, creature.y, creature.obstacles, grid_size
    )
    obstacle_magnitude *= -1

    inputs = np.array([
        energy_level,
        energy_dx,
        move_dx,
        move_dy,
        just_reproduced,
        food_dx,
        food_dy,
        obstacle_vector_x,
        obstacle_vector_y,
        obstacle_magnitude
    ])

    weights = np.array(creature.weights)
    total_hidden_weights = HIDDEN_SIZE * INPUT_SIZE
    hidden_weights = weights[:total_hidden_weights].reshape(HIDDEN_SIZE, INPUT_SIZE)
    output_weights = weights[total_hidden_weights:].reshape(OUTPUT_SIZE, HIDDEN_SIZE)

    hidden_layer = np.tanh(np.dot(hidden_weights, inputs))
    output = np.tanh(np.dot(output_weights, hidden_layer))
    move_x, move_y = output

    # exploration noise
    exploration_factor = np.tanh(move_x + move_y)
    if np.random.rand() < 0.2 + 0.3 * (1 - abs(exploration_factor)):
        angle = random.uniform(0, 2 * np.pi)
        magnitude = random.uniform(0.4, 0.7)
        move_x += magnitude * np.cos(angle)
        move_y += magnitude * np.sin(angle)
        move_x = np.clip(move_x, -1, 1)
        move_y = np.clip(move_y, -1, 1)

    return {"move_x": move_x, "move_y": move_y}
