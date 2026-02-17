# Pet License Rebrand — Multi-Agent Society Experiment

A React app that runs a city-council-style simulation comparing two coordination structures (role clarity vs status confusion) using Claude. Built for the essay *"Your Multi-Agent System Just Recreated Every Org Dysfunction You've Ever Hated"*.

## API key safety

- **The API key never lives in the frontend.** It is read from the server’s environment only.
- The browser talks to a small Express proxy; the proxy calls Anthropic with `ANTHROPIC_API_KEY` from `.env`.
- `.env` is gitignored, so the key is never committed.

## Setup

1. **Clone and install**
   ```bash
   cd pet-license-rebrand
   npm run install:all
   ```

2. **Configure the API key**
   ```bash
   cp .env.example .env
   # Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   - API proxy: http://localhost:3001  
   - App: http://localhost:5173 (Vite proxies `/api` to the server)

## Pushing to GitHub

Repo: **https://github.com/TrishWH/multi-agent-society-experiment**

From the project root (in your terminal):

```bash
cd /Users/trishwh/pet-license-rebrand
git init
git add .
git commit -m "Initial commit: Pet License multi-agent experiment with server-side API proxy"
git branch -M main
git remote add origin https://github.com/TrishWH/multi-agent-society-experiment.git
git push -u origin main
```

Confirm that **`.env` is not in the repo** (`git status` should not list it). Only `.env.example` (no real key) should be committed.

## Cost

Roughly **$3–5 per full run** (both versions A and B) with Claude Sonnet.
