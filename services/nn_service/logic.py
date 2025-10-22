import numpy as np
import random

INPUT_SIZE = 21
HIDDEN_SIZE = 9
OUTPUT_SIZE = 3

HIDDEN_SHAPE = (HIDDEN_SIZE, INPUT_SIZE)
OUTPUT_SHAPE = (OUTPUT_SIZE, HIDDEN_SIZE)

SQRT2 = np.sqrt(2)

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

def wrap_angle(angle):
    return (angle + np.pi) % (2 * np.pi) - np.pi

def influence_vector(x, y, targets, repel=False):
    """Return a unit attraction/repulsion vector using inverse-square weighting."""
    vector_x, vector_y = 0.0, 0.0
    for t in targets:
        dx = (x - t.x) if repel else (t.x - x)
        dy = (y - t.y) if repel else (t.y - y)
        dist_sq = dx**2 + dy**2
        if dist_sq > 0:
            strength = 1 / dist_sq
            vector_x += dx * strength
            vector_y += dy * strength

    magnitude = np.hypot(vector_x, vector_y)
    if magnitude > 0:
        vector_x /= magnitude
        vector_y /= magnitude

    return vector_x, vector_y

def angle_and_magnitude(x, y, angle=0.0):
    """Convert a world vector into a relative heading and clipped magnitude."""
    orientation = angle
    angle = np.arctan2(y, x)
    rel_angle = wrap_angle(angle - orientation)
    magnitude = np.hypot(x, y)
    return rel_angle / np.pi, np.clip(magnitude / SQRT2, 0, 1)

def angle_delta(current, prev):
    return wrap_angle(current - prev) / np.pi

def net_movement_vector(path, visibility_radius):
    """Compare displacement to visibility radius and squash components to [-1, 1]."""
    if len(path) < 2:
        return 0.0, 0.0

    dx = path[-1].x - path[0].x
    dy = path[-1].y - path[0].y
    return np.tanh(dx / visibility_radius), np.tanh(dy / visibility_radius)

def think(creature, grid_size, visibility_radius, max_energy, max_turn_angle, max_speed):
    energy_level = 2 * (creature.energy / max_energy) - 1
    energy_dx = np.clip((creature.energy - creature.prev_energy) / max_energy, -1, 1)
    just_reproduced = 1.0 if creature.just_reproduced else -1.0
    energy_absolute = np.clip(creature.energy / max_energy, 0, 1)
    sex_flag = 1.0 if getattr(creature, "sex", "F") == "F" else -1.0

    fx, fy = influence_vector(creature.x, creature.y, creature.food)
    food_angle, food_magnitude = angle_and_magnitude(fx, fy, creature.angle)

    ox, oy = influence_vector(creature.x, creature.y, creature.obstacles, True)
    obstacle_angle, obstacle_magnitude = angle_and_magnitude(ox, oy, creature.angle)

    cx, cy = influence_vector(creature.x, creature.y, creature.creatures, repel=True)
    creature_angle, creature_magnitude = angle_and_magnitude(cx, cy, creature.angle)

    opposite_sex = [c for c in creature.creatures if getattr(c, "sex", None) and getattr(c, "sex", None) != creature.sex]
    if opposite_sex:
        nearest = min(opposite_sex, key=lambda c: (c.x - creature.x) ** 2 + (c.y - creature.y) ** 2)
        mate_dx = nearest.x - creature.x
        mate_dy = nearest.y - creature.y
        mate_angle, mate_distance = angle_and_magnitude(mate_dx, mate_dy, creature.angle)
    else:
        mate_angle = 0.0
        mate_distance = 0.0

    net_dx, net_dy = net_movement_vector(creature.recent_path, visibility_radius)
    net_angle, net_magnitude = angle_and_magnitude(net_dx, net_dy, creature.angle)

    move_dx = creature.x - creature.prev_x
    move_dy = creature.y - creature.prev_y
    move_angle, move_magnitude = angle_and_magnitude(move_dx, move_dy, creature.angle)

    angle_delta_val = angle_delta(creature.angle, creature.prev_angle)

    wander_angle = wrap_angle(creature.wander_angle - creature.angle) / np.pi
    wander_magnitude = np.clip(creature.wander_strength / SQRT2, 0, 1)

    inputs = np.array([
        energy_level,
        energy_dx,
        just_reproduced,
        food_angle,
        food_magnitude,
        obstacle_angle,
        obstacle_magnitude,
        creature_angle, 
        creature_magnitude,
        net_angle,
        net_magnitude,
        angle_delta_val,
        move_angle,
        move_magnitude,
        wander_angle,
        wander_magnitude,
        energy_absolute,
        sex_flag,
        mate_angle,
        mate_distance,
        1.0  # bias
    ])

    weights = np.array(creature.weights)
    hidden_weights = weights[:np.prod(HIDDEN_SHAPE)].reshape(HIDDEN_SHAPE)
    output_weights = weights[np.prod(HIDDEN_SHAPE):].reshape(OUTPUT_SHAPE)

    hidden_layer = np.tanh(np.dot(hidden_weights, inputs))
    output = np.tanh(np.dot(output_weights, hidden_layer))

    return {
        "id": creature.id,
        "angleDelta": output[0] * max_turn_angle,
        "speed": ((output[1] + 1) / 2) * max_speed,
        "mateIntent": (output[2] + 1) / 2
    }
