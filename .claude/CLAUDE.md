# CLAUDE.md

## Overview

vivarium73 is a real-time evolutionary simulation (PWA) where autonomous creatures navigate a 2D grid, consume food, avoid obstacles, and evolve neural networks across generations. 

**Simulation loop (300ms tick):** 
 - web_server computes physics/collisions
 - calls nn_service to get movement decisions
 - broadcasts state via WebSocket
 - clients render on JS Canvas

## Architecture

Two services managed via Docker Compose:

- **`services/web_server`** — Node.js 22 / Express 5: simulation engine, REST API, WebSocket broadcast, state persistence.
- **`services/nn_service`** — Python 3.11 / FastAPI: neural network weight init/mutation and batch movement decisions.

Web server drives the simulation; NN service is a stateless computation backend called each tick.

## Key source files

### web_server (`services/web_server/src/`)
| File | Purpose |
|------|---------|
| `server.js` | Express setup, WebSocket server, 300ms simulation tick loop |
| `state.js` | Creature lifecycle, physics, collision detection, reproduction, food |
| `config.js` | ~40 tunable simulation parameters (grid size, energy, FOV, mutation rates) |
| `creature.js` | Creature initialization and scoring |
| `nn.js` | HTTP client to nn_service (init weights, mutate, think) |
| `grid.js` | Spatial indexing, obstacle definitions, food distribution |
| `performance.js` | Top-performer tracking, population restart logic |
| `routes.js` | REST endpoints: `/api/health`, `/api/config`, `/api/place-food` |

### nn_service (`services/nn_service/`)
| File | Purpose |
|------|---------|
| `main.py` | FastAPI routes: `GET /api/weights/init`, `POST /api/weights/mutate`, `POST /api/think` |
| `logic.py` | NN computation: 17 inputs → 9 hidden (tanh) → 2 outputs (tanh); Xavier init, Gaussian mutation |

### Client (`services/web_server/public/`)
Vanilla JS + HTML5 Canvas. WebSocket consumer for real-time state rendering.

## Simulation parameters (config.js highlights)
- Grid: 50×50 cells; visibility radius: 10; FOV: ~100°
- Population: 20 creatures; restarts when <3 remain using top 5 performers
- Reproduction at 1000 energy; costs 400; 50% mutation chance
- Food: max 30 pieces, 130 energy each
- State saved every 5 min to `data/state.json`

## Dev environment setup

### Prerequisites
- Python 3.11, Node.js 22.x / npm, pip (latest)
- Docker + Docker Compose (optional)

### Steps
1. Copy `services/web_server/.env.example` → `services/web_server/.env` and update values.
   - For Docker Compose, also copy root `.env.example` → `.env`.
2. Set up **nn_service**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r services/nn_service/requirements.txt
   deactivate
   ```
3. Set up **web_server**:
   ```bash
   cd services/web_server && npm ci && cd -
   ```

## Local dev (without Docker)
```bash
# Terminal 1 — nn_service
source .venv/bin/activate
PYTHONPATH=services uvicorn nn_service.main:app --reload --port 8000

# Terminal 2 — web_server (ensure NN_SERVICE_URL=http://localhost:8000/api in .env)
cd services/web_server && npm start
```

## Testing instructions
- Always run tests before committing.
- **nn_service:**
  ```bash
  source .venv/bin/activate && PYTHONPATH=services pytest services/nn_service/tests
  ```
- **web_server:**
  ```bash
  cd services/web_server && npm test
  ```
- **E2E (Playwright, optional):**
  ```bash
  cd services/web_server && npm run test:e2e
  ```

## Docker notes
- `docker-compose.yml` builds and runs both services; copy `.env.example` → `.env` at repo root first, then `docker compose up --build`.
- State file: `./data/state.json` on the host (mounted to `/app/data` in the web container).

## PR guidelines
- Keep commit messages and PR descriptions concise.
- Mention which service(s) are affected.
- Link related issues if available.
- Ensure files end with a single trailing newline.
- Leave an empty line at the end of each file so EOF is well-formed.
