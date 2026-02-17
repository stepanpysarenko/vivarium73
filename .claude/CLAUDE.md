# CLAUDE.md

## Overview

vivarium73 is a real-time evolutionary simulation (PWA) where autonomous creatures navigate a 2D grid, consume food, avoid obstacles, and evolve neural networks across generations.

**Simulation loop (300ms tick):**
 - web_server computes physics/collisions and neural network movement decisions
 - broadcasts state via WebSocket
 - clients render on JS Canvas

## Architecture

Single Node.js service, optionally run via Docker.

Node.js 22 / Express 5: simulation engine, neural network inference, REST API, WebSocket broadcast, state persistence.

## Key source files

### Source (`src/`)
| File | Purpose |
|------|---------|
| `server.js` | Express setup, WebSocket server, 300ms simulation tick loop |
| `state.js` | Creature lifecycle, physics, collision detection, reproduction, food |
| `config.js` | ~40 tunable simulation parameters (grid size, energy, FOV, mutation rates) |
| `creature.js` | Creature initialization and scoring |
| `nn.js` | Neural network: 17 inputs → 9 hidden (tanh) → 2 outputs (tanh); Xavier init, Gaussian mutation |
| `grid.js` | Spatial indexing, obstacle definitions, food distribution |
| `performance.js` | Top-performer tracking, population restart logic |
| `routes.js` | REST endpoints: `/api/health`, `/api/config`, `/api/place-food` |
| `logger.js` | Log-level aware logger (LOG_LEVEL env var) |

### Client (`public/`)
Vanilla JS + HTML5 Canvas. WebSocket consumer for real-time state rendering.

## Simulation parameters (config.js highlights)
- Grid: 50×50 cells; visibility radius: 10; FOV: ~100°
- Population: 20 creatures; restarts when <3 remain using top 5 performers
- Reproduction at 1000 energy; costs 400; 50% mutation chance
- Food: max 30 pieces, 130 energy each
- State saved every 5 min to `data/state.json`

## Dev environment setup

### Prerequisites
- Node.js 22.x / npm
- Docker + Docker Compose (optional)

### Steps
1. Copy `.env.example` → `.env` and update values.
2. Install dependencies:
   ```bash
   npm ci
   ```

## Local dev (without Docker)
```bash
npm start
```

## Testing instructions
- Always run tests before committing.
  ```bash
  npm test
  ```
- **E2E (Playwright, optional):**
  ```bash
  npm run test:e2e
  ```

## Docker notes
- `docker-compose.yml` builds and runs the service; copy `.env.example` → `.env` at repo root first, then `docker compose up --build`.
- State file: `./data/state.json` on the host (mounted to `/app/data` in the web container).

## PR guidelines
- Keep commit messages and PR descriptions concise.
- Link related issues if available.
- Ensure files end with a single trailing newline.
- Leave an empty line at the end of each file so EOF is well-formed.
