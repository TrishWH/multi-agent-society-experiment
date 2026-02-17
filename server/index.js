import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function callAnthropic(systemPrompt, userContent, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error?.message || res.statusText;
        if (res.status === 429) {
          const wait = attempt * 3000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (res.status === 401)
          throw new Error("Invalid API key. Check your key and try again.");
        if (res.status === 402)
          throw new Error("Payment required. Add billing to your API account.");
        throw new Error(`API error (${res.status}): ${msg}`);
      }

      const data = await res.json();
      return data.content[0].text;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

app.post("/api/chat", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "Server missing ANTHROPIC_API_KEY. Add it to .env and restart.",
    });
  }
  const { systemPrompt, userContent } = req.body;
  if (!systemPrompt || !userContent) {
    return res.status(400).json({ error: "systemPrompt and userContent required" });
  }
  try {
    const text = await callAnthropic(systemPrompt, userContent);
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API proxy running at http://localhost:${PORT}`);
});
