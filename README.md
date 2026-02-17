# Pet License Multi-Agent Experiment

Companion code for the essay *"Your Multi-Agent System Just Recreated Every Org Dysfunction You've Ever Hated."* (Article: https://medium.com/words-in-tech/e5dd9c063310)

Run two versions of the same scenario with 8 AI agents. The only variable: **social structure** (role clarity vs status confusion).

## Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/TrishWH/multi-agent-society-experiment.git
   cd multi-agent-society-experiment
   npm run install:all
   ```

2. **Configure the API key** (stored on the server only, never in the browser)
   ```bash
   cp .env.example .env
   # Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Run**
   ```bash
   npm run dev
   ```
   Open **http://localhost:5173** and click **Run Experiment (Version A + B)**.

## Cost

~**$3–5** per full run (both versions).

## Known limitations

- Analysis may vary between runs.
- Meter scores (legitimacy / feasibility) are directional, not precise.

## Security

The API key lives in `.env` on the server; the frontend talks to a small Express proxy. `.env` is gitignored—never commit it.