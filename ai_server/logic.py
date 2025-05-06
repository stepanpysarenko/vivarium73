import numpy as np
import random
from fastapi import FastAPI

app = FastAPI()

INPUT_SIZE = 17
HIDDEN_SIZE = 9
OUTPUT_SIZE = 2

def init_weights():
    total_weights_hidden = HIDDEN_SIZE * INPUT_SIZE
    total_weights_output = OUTPUT_SIZE * HIDDEN_SIZE
    weights_hidden = np.random.uniform(-1, 1, total_weights_hidden)
    weights_output = np.random.uniform(-1, 1, total_weights_output)
    weights = np.concatenate([weights_hidden, weights_output]).tolist()
    return {"weights": weights}

def mutate_weights(weights):
    mutated_weights = [
        np.clip(w + (random.random() - 0.5) * 0.1, -1, 1)
        for w in weights
    ]
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

def get_net_movement_vector(path, visibility_radius):
    if len(path) < 2:
        return 0.0, 0.0

    dx = path[-1].x - path[0].x
    dy = path[-1].y - path[0].y
    return np.tanh(dx / visibility_radius), np.tanh(dy / visibility_radius)

def think(creature, grid_size, max_energy, visibility_radius):
    energy_level = 2 * (creature.energy / max_energy) - 1
    energy_dx = (creature.energy - creature.prev_energy) / max_energy
    move_dx = np.tanh((creature.x - creature.prev_x) / grid_size)
    move_dy = np.tanh((creature.y - creature.prev_y) / grid_size)
    just_reproduced = 1.0 if creature.just_reproduced else -1.0

    if creature.food:
        closest_food = min(creature.food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)
        food_dx = np.tanh((closest_food.x - creature.x) / visibility_radius)
        food_dy = np.tanh((closest_food.y - creature.y) / visibility_radius)
    else:
        food_dx = 0
        food_dy = 0

    food_vector_x, food_vector_y, food_magnitude = compute_vector(
        creature.x, creature.y, creature.food, visibility_radius
    )

    obstacle_vector_x, obstacle_vector_y, obstacle_magnitude = compute_vector(
        creature.x, creature.y, creature.obstacles, visibility_radius
    )
    obstacle_magnitude *= -1

    net_dx, net_dy = get_net_movement_vector(creature.recent_path, visibility_radius)

    inputs = np.array([
        energy_level,
        energy_dx,
        move_dx,
        move_dy,
        just_reproduced,
        food_dx,
        food_dy,
        food_vector_x,
        food_vector_y,
        food_magnitude,
        obstacle_vector_x,
        obstacle_vector_y,
        obstacle_magnitude,
        net_dx,
        net_dy,
        random.uniform(-1, 1), # exploration noise
        1.0 # bias
    ])

    weights = np.array(creature.weights)
    total_hidden_weights = HIDDEN_SIZE * INPUT_SIZE
    hidden_weights = weights[:total_hidden_weights].reshape(HIDDEN_SIZE, INPUT_SIZE)
    output_weights = weights[total_hidden_weights:].reshape(OUTPUT_SIZE, HIDDEN_SIZE)

    hidden_layer = np.tanh(np.dot(hidden_weights, inputs))
    output = np.tanh(np.dot(output_weights, hidden_layer))
    angle_delta_normalized = output[0]  # [-1, 1]
    speed_normalized = (output[1] + 1) / 2  # [0, 1]

    MAX_TURN_ANGLE = np.pi / 2  # 90 degrees
    angle_delta = angle_delta_normalized * MAX_TURN_ANGLE

    return {
        "angle_delta": angle_delta,
        "speed": speed_normalized
    }
