# AGENT Instructions

This repository hosts two main services:
- `services/web_server`: Node.js/Express server with a WebSocket API and front-end assets.
- `services/nn_service`: FastAPI service providing neural network logic.

## Testing
Run all tests before committing changes.

### Testing environment setup script
```bash
#!/bin/bash
# Prepare dependencies for tests (assumes Python 3.11 and Node.js 20 are installed)

set -e

# ---- Python (NN service) ----
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r services/nn_service/requirements.txt
deactivate

# ---- Node.js (Web server) ----
cd services/web_server
npm ci
cd -
```

## Environment variables
- `services/web_server/.env.example` lists `PORT`, `WEBSOCKET_URL`, and `NN_SERVICE_URL`.
  Copy it to `.env` and adjust values when running locally.

## General notes
- The Docker setup (`docker-compose.yml`) builds both services.
- Persistent state is stored under `services/web_server/data/state.json` if running the web server.
- Keep commit messages and PR descriptions concise and mention affected services.
- Always ensure the file ends with a single empty line (newline character) at the end of file.

## To add

- High-level architecture overview
- NN overview
- State management overview
- Deployment details
- Contribution workflow
