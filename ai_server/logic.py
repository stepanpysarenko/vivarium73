import numpy as np
import random
from fastapi import FastAPI

app = FastAPI()

INPUT_SIZE = 14
HIDDEN_SIZE = 8
OUTPUT_SIZE = 2

HIDDEN_SHAPE = (HIDDEN_SIZE, INPUT_SIZE)
OUTPUT_SHAPE = (OUTPUT_SIZE, HIDDEN_SIZE)

def xavier_uniform(shape):
    fan_in, fan_out = shape[1], shape[0]
    limit = np.sqrt(6 / (fan_in + fan_out))
    return np.random.uniform(-limit, limit, shape)

def init_weights():
    hidden_weights = xavier_uniform(HIDDEN_SHAPE)
    output_weights = xavier_uniform(OUTPUT_SHAPE)
    weights = np.concatenate([hidden_weights.flatten(), output_weights.flatten()]).tolist()
    return {"weights": weights}

def mutate_weights(weights):
    mutated_weights = [
        np.clip(w + (random.random() - 0.5) * 0.1, -1, 1)
        for w in weights
    ]
    return {"weights": mutated_weights}

def compute_vector(x, y, targets):
    vector_x, vector_y = 0.0, 0.0
    for t in targets:
        dx = t.x - x
        dy = t.y - y
        dist_sq = dx**2 + dy**2
        if dist_sq > 0:
            strength = 1 / dist_sq
            vector_x += dx * strength
            vector_y += dy * strength
    return vector_x, vector_y

def compute_angle_and_magnitude(x, y, facing_angle=0.0):
    angle = np.arctan2(y, x)
    rel_angle = (angle - facing_angle + np.pi) % (2 * np.pi) - np.pi  # wrap to [-pi, pi]
    magnitude = np.hypot(x, y)
    return rel_angle / np.pi, np.clip(magnitude / np.sqrt(2), 0, 1)

def compute_facing_delta(current, prev):
    delta = (current - prev + np.pi) % (2 * np.pi) - np.pi  # wrap to [-pi, pi]
    return delta / np.pi

def get_net_movement_vector(path, visibility_radius):
    if len(path) < 2:
        return 0.0, 0.0

    dx = path[-1].x - path[0].x
    dy = path[-1].y - path[0].y
    return np.tanh(dx / visibility_radius), np.tanh(dy / visibility_radius)

def think(creature, grid_size, max_energy, visibility_radius):
    energy_level = 2 * (creature.energy / max_energy) - 1
    energy_dx = np.clip((creature.energy - creature.prev_energy) / max_energy, -1, 1)
    just_reproduced = 1.0 if creature.just_reproduced else -1.0

    fx, fy = compute_vector(creature.x, creature.y, creature.food)
    food_angle, food_magnitude = compute_angle_and_magnitude(fx, fy, creature.facing_angle)

    ox, oy = compute_vector(creature.x, creature.y, creature.obstacles)
    obstacle_angle, obstacle_magnitude = compute_angle_and_magnitude(ox, oy, creature.facing_angle)
    obstacle_magnitude *= -1  # repulsion

    net_dx, net_dy = get_net_movement_vector(creature.recent_path, visibility_radius)
    net_angle, net_magnitude = compute_angle_and_magnitude(net_dx, net_dy, creature.facing_angle)

    move_dx = creature.x - creature.prev_x
    move_dy = creature.y - creature.prev_y
    move_angle, move_magnitude = compute_angle_and_magnitude(move_dx, move_dy, creature.facing_angle)

    facing_delta = compute_facing_delta(creature.facing_angle, creature.prev_facing_angle)

    inputs = np.array([
        energy_level,
        energy_dx,
        just_reproduced,
        food_angle,
        food_magnitude,
        obstacle_angle,
        obstacle_magnitude,
        net_angle,
        net_magnitude,
        facing_delta,
        move_angle,
        move_magnitude,
        random.uniform(-1, 1),  # exploration noise
        1.0  # bias
    ])

    weights = np.array(creature.weights)
    hidden_weights = weights[:np.prod(HIDDEN_SHAPE)].reshape(HIDDEN_SHAPE)
    output_weights = weights[np.prod(HIDDEN_SHAPE):].reshape(OUTPUT_SHAPE)

    hidden_layer = np.tanh(np.dot(hidden_weights, inputs))
    output = np.tanh(np.dot(output_weights, hidden_layer))

    MAX_TURN_ANGLE = np.pi / 3 * 2  # 120 degrees
    angle_delta = output[0] * MAX_TURN_ANGLE
    speed = (output[1] + 1) / 2

    return {
        "angle_delta": angle_delta,
        "speed": speed
    }
