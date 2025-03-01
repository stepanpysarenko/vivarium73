import numpy as np
import random

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def think(creature, food, grid_size):
    """Compute movement direction based on a simple neural network."""
    if not food:
        # No food: move randomly to explore
        return {"move_x": random.choice([-1, 0, 1]), "move_y": random.choice([-1, 0, 1])}

    # Find the closest food based on Euclidean distance
    closest_food = min(food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)

    # Sensory input: relative food position (normalized)
    input_vector = np.array([
        (closest_food.x - creature.x) / grid_size,
        (closest_food.y - creature.y) / grid_size
    ])

    # Creature's neural weights (ensure correct shape)
    weights = np.array(creature.weights)

    if weights.shape != (2, 2):
        weights = np.random.randn(2, 2)  # Ensure a 2x2 matrix

    # Compute movement direction
    output = sigmoid(np.dot(weights, input_vector))

    # Movement logic
    move_x = 1 if output[0] > 0.6 else (-1 if output[0] < 0.4 else 0)
    move_y = 1 if output[1] > 0.6 else (-1 if output[1] < 0.4 else 0)

    # Small chance of random movement for exploration
    if np.random.rand() < 0.1:
        move_x = random.choice([-1, 0, 1])
        move_y = random.choice([-1, 0, 1])

    return {"move_x": move_x, "move_y": move_y}
