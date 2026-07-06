# Docker Setup & Tunneling

Everything runs in a single container — backend, frontend, database. One port, one command.

## Quick Start (one command)

```bash
npm run tunnel:dev
```

Builds the Docker image, starts the container, and opens a Cloudflare tunnel. Send the URL to your friend.

To stop: `npm run docker:stop` or Ctrl+C.

## All Scripts

| Script | What it does |
|--------|-------------|
| `npm run tunnel:dev` | Build + run + tunnel — the full combo |
| `npm run docker:build` | Build the Docker image |
| `npm run docker:run` | Start the container on port 8000 |
| `npm run docker:stop` | Stop the running container |
| `npm run tunnel` | Open a Cloudflare tunnel to localhost:8000 |

## Prerequisites

- **Docker Desktop** installed and running (the whale icon in your menu bar should be alive)
- **cloudflared** (`brew install cloudflared`) for tunneling

## Manual Steps

### Build

```bash
docker build -t marches-publics .
```

This does two things under the hood:
1. Builds the React frontend into static files
2. Packages them with the Python backend into one image

## Run

```bash
docker run -p 8000:8000 -v marches-data:/app/data marches-publics
```

The app is now live at **http://localhost:8000**

| Flag | What it does |
|------|-------------|
| `-p 8000:8000` | Maps container port to your machine |
| `-v marches-data:/app/data` | Persists the SQLite database across restarts |

To run in background (detached):

```bash
docker run -d -p 8000:8000 -v marches-data:/app/data --name marches marches-publics
```

Stop it with `docker stop marches`, restart with `docker start marches`.

## Share with a friend (tunneling)

Pick one. All three expose your localhost to a public URL.

### Cloudflared (no account needed, recommended)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

Gives you a `https://xxx.trycloudflare.com` URL instantly.

### ngrok

```bash
brew install ngrok
ngrok http 8000
```

Requires a free account at ngrok.com. Gives you a `https://xxx.ngrok-free.app` URL.

### localtunnel

```bash
npx localtunnel --port 8000
```

No install needed if you have Node. Gives you a `https://xxx.loca.lt` URL.

---

Send the URL to your friend. They get the full app — browsing, filtering, tender details, DCE downloads, everything.

## Dev mode (without Docker)

If you're developing locally and don't need Docker:

```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn main:app --port 8000

# Terminal 2 — frontend (with hot reload)
cd frontend && npm run dev
```

Frontend runs on `:5173` and proxies `/api` calls to the backend on `:8000`.
