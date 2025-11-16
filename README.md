# vivarium73

vivarium73 is a continuous evolutionary simulation where autonomous agents battle scarcity, mutate under pressure, and either persist or disappear. The project ships as a Node.js web client backed by a neural-network service so the entire ecosystem updates in real time across browsers and WebSocket streams.

## Mechanics
- Creatures scan every frame for nearby food, obstacles, and neighboring agents.
- Energy is earned through food intake and spent on movement or collisions.
- Full-energy creatures reproduce with built-in mutation probabilities.
- When a generation collapses, the top performers reseed the simulation.

## Controls
- Click anywhere inside the arena to inject additional food.
- Select an individual creature to pin its live stats in the header.
- Install the web app on desktop or mobile to keep a persistent viewport.

## Live  
[https://vivarium73.life](https://vivarium73.life)
