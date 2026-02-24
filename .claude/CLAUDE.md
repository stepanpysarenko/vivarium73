
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
