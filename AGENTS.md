# AGENT Instructions

This repository hosts two main services:
- `services/web_server`: Node.js/Express server with a WebSocket API and front-end assets.
- `services/nn_service`: FastAPI service providing neural network logic.

## Testing
Run all tests before committing changes.

### Web server
```bash
cd services/web_server
npm ci
npm run test
```

### Neural network service
```bash
cd services/nn_service
pip install -r requirements.txt
pytest
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
