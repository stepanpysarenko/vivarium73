# AGENTS.md

## Overview
- vivarium73 is a real-time evolutionary simulation where autonomous creatures search for food, avoid obstacles, and evolve over generations.

## Architecture
- Two services managed via Docker Compose:
  - `services/web_server`: Node.js/Express server of the client app, exposes the REST API, and broadcasts state over WebSocket.
  - `services/nn_service`: FastAPI service that initializes and mutates neural-network weights and returns creature movement decisions.
- Web server calls the NN service over HTTP; clients connect to the web server over HTTP and WebSocket for real-time updates.

## Dev environment setup

### Prerequisites
- Python 3.11
- Node.js 22.x and npm
- pip (latest version)
- Docker + Docker Compose (optional, for containerized runs)

### Steps
1. Copy `services/web_server/.env.example` to `services/web_server/.env` and update values for your local environment.
   - When using Docker Compose, also copy the repo root `.env.example` to `.env` (root) and adjust values as needed.
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
   cd services/web_server
   npm ci
   cd -
   ```

Run these steps once after cloning, or again if dependencies change. For daily development, activate the Python venv when working on `nn_service`, then run the relevant tests.

## Local dev (without Docker)
1. Start **nn_service** from the repo root:
   ```bash
   source .venv/bin/activate
   PYTHONPATH=services uvicorn nn_service.main:app --reload --port 8000
   ```
2. In a new shell, start **web_server**:
   ```bash
   cd services/web_server
   npm start
   ```
   Ensure `services/web_server/.env` points `NN_SERVICE_URL` at `http://localhost:8000/api`.

## Testing instructions
- Always run tests before committing.
- Run **nn_service** tests:
  ```bash
  source .venv/bin/activate && PYTHONPATH=services pytest services/nn_service/tests
  ```
- Run **web_server** tests:
  ```bash
  cd services/web_server && npm test
  ```
- Optional E2E tests (Playwright):
  ```bash
  cd services/web_server && npm run test:e2e
  ```

## Docker notes
- `docker-compose.yml` builds and runs both services; copy `.env.example` to `.env` at the repo root before running `docker compose up --build`.
- Persistent state path:
  - Local (without Docker): `services/web_server/data/state.json` (default `STATE_SAVE_PATH`).
  - With Docker Compose: host directory `./data` is mounted to `/app/data` in the web service; the state file resolves to `./data/state.json` on the host.

## PR guidelines
- Keep commit messages and PR descriptions concise.
- Mention which service(s) are affected.
- Link related issues if available.
- Ensure files end with a single trailing newline.
- Leave an empty line at the end of each file so EOF is well-formed.
