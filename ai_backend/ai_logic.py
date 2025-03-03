import numpy as np
import random

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def tanh(x):
    return np.tanh(x)  # Output range: [-1, 1]

def think(creature, food, grid_size, max_energy):
    closest_food = min(food, key=lambda f: (f.x - creature.x)**2 + (f.y - creature.y)**2)

    inputs = np.array([
        (closest_food.x - creature.x) / (grid_size / 2),  
        (closest_food.y - creature.y) / (grid_size / 2),  
        (creature.prev_x - creature.x) / (grid_size / 2),
        (creature.prev_y - creature.y) / (grid_size / 2),
        (2 * creature.energy / max_energy) - 1
    ])

    weights = np.array(creature.weights)

    weights_hidden = weights[:20].reshape(4, 5)
    weights_output = weights[20:].reshape(2, 4)

    hidden_layer = tanh(np.dot(weights_hidden, inputs)) 
    output = np.dot(weights_output, hidden_layer)

    move_x = 1 if output[0] > 0.5 else (-1 if output[0] < -0.5 else 0)
    move_y = 1 if output[1] > 0.5 else (-1 if output[1] < -0.5 else 0)

    # Small chance of random movement for exploration
    if np.random.rand() < 0.1:
        move_x = random.choice([-1, 0, 1])
        move_y = random.choice([-1, 0, 1])

    return {"move_x": move_x, "move_y": move_y}
