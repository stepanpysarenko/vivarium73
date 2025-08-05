# AGENT Instructions

## Architecture Overview

This project is composed of two services managed by Docker Compose:

- `services/web_server` – A Node.js/Express server that serves the web client and exposes a WebSocket API.
- `services/nn_service` – A FastAPI application providing neural network logic.

The web server communicates with the NN service over HTTP. Clients interact with the web server over HTTP and WebSocket connections.


## Testing
Run all tests before committing changes.

### Local environment setup script
```bash
#!/bin/bash

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

### Running tests
```bash
#!/bin/bash

# ---- Python (NN service) ----
PYTHONPATH=. pytest nn_service/tests

# ---- Node.js (Web server) ----
cd services/web_server
npm test
```


## Environment variables
- Copy vars from `services/web_server/.env.example` to `.env` and adjust them when running locally.

## General notes
- The Docker setup (`docker-compose.yml`) builds both services.
- Persistent state is stored under `services/web_server/data/state.json` if running the web server.
- Keep commit messages and PR descriptions concise and mention affected services.
- Always ensure the file ends with a single empty line (newline character) at the end of file.
