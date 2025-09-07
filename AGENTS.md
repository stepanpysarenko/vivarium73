# AGENTS.md

## Architecture
- Two services managed via Docker Compose:
  - `services/web_server` – web server with client app and WebSocket API built with Node.js/Express
  - `services/nn_service` – neural network service built with FastAPI
- Web server communicates with NN service over HTTP.
- Clients communicate with the web server via HTTP and WebSocket for real-time updates.

## Dev environment setup

### Prerequisites
- Python 3.11
- Node.js 18+ and npm
- pip (latest version)

### Steps
1. Copy `services/web_server/.env.example` to `.env` and update values for your local environment.
2. Set up **nn_service**:
   ```bash
   python3.11 -m venv .venv
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

Run these steps once after cloning, or again if dependencies change. For daily development, only activate the Python venv (if working on `nn_service`) and then run tests.

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

## Docker notes
- `docker-compose.yml` builds and runs both services.
- Persistent state is stored at `services/web_server/data/state.json`.

## PR guidelines
- Keep commit messages and PR descriptions concise.
- Mention which service(s) are affected.
- Link related issues if available.
- Ensure files end with a single trailing newline.
