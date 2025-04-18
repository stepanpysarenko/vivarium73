# vivarium73

**vivarium73** is a simulation where virtual creatures move, search for food, and avoid obstacles. Each creature is controlled by a simple neural network that decides what to do based on nearby food and obstacles.

Live version: [https://vivarium73.life](https://vivarium73.life)

### Simulation mechanics
- creatures detect food and obstacles in their surroundings  
- they gain energy by eating and lose energy by moving  
- when a creature reaches full energy, it creates an offspring, which may have small mutations  
- if a creature runs out of energy, it dies  
- when all creatures are gone, the simulation restarts with the best-performing ones from the previous generation  
- over time, mutations can lead to more effective survival strategies

