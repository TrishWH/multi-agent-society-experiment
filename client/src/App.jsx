import { useState, useRef } from "react";

const AGENTS = [
  { id: "mayor", name: "Mayor", role: "Decision Owner", domain: "Final decisions, public perception, political viability", goal: "Produce a policy that looks competent and keeps the city calm", redLine: "Refuses paperwork theater" },
  { id: "counsel", name: "City Counsel", role: "Rules & Risk", domain: "Legal feasibility, compliance, enforcement mechanisms", goal: "Produce something enforceable and legally coherent", redLine: "Won't approve subjective judging by clerks" },
  { id: "influencer", name: "Pet Influencer Lobbyist", role: "Status & Hype", domain: "Pet culture trends, public engagement, sponsorship opportunities", goal: "Make policy increase pet status and monetizable attention", redLine: "Won't accept anything that deplatforms pets" },
  { id: "welfare", name: "Animal Welfare Advocate", role: "Ethics & Harm", domain: "Animal wellbeing, equity for low-income pet parents, harm prevention", goal: "Ensure policy doesn't punish vulnerable populations", redLine: "No fines that lead to pet surrender" },
  { id: "ops", name: "City Ops Lead", role: "Implementation", domain: "Staffing reality, operational workflows, timeline feasibility", goal: "Ship something clerks can execute without burning out", redLine: "Refuses bespoke software within the quarter" },
  { id: "budget", name: "Budget Analyst", role: "Money Physics", domain: "Cost modeling, funding sources, financial tradeoffs", goal: "Keep within $250k and prevent hidden costs", redLine: "Refuses open-ended staffing commitments" },
  { id: "journalist", name: "Local Journalist", role: "Attention Engine", domain: "Narrative framing, public interest, headline generation", goal: "Produce a story people read", redLine: "Refuses to let anyone answer in more than one sentence when pressed" },
  { id: "citizen", name: "Citizen Representative", role: "Pet Parent", domain: "Lived experience, practical concerns, legitimacy check", goal: "Keep pet ownership from becoming humiliating bureaucracy", redLine: "Anything that makes people feel judged for having a normal pet" }
];

const SCENARIO = `The city must redesign the pet license program. Every pet must have ONE of these by next quarter:
1. Pet LinkedIn profile
2. Personal brand manifesto (1 page)
3. Quarterly performance review

Constraints:
- Budget cap: $250k
- Must be enforceable by city clerk's office
- Must not cause "Pet Parent Revolt" (>60% negative sentiment)

Deliverable: Pick one policy (or compromise), write public announcement, produce enforcement plan.`;

const SCANDAL = "BREAKING: The vendor demo accidentally licensed a Roomba as a terrier. City IT is investigating.";

const ROUNDS = [
  { id: 0, name: "Round 0: Private Memos", instruction: "Write a private memo (3 bullets max) outlining your initial position on the pet license policy options. Be strategic about your interests." },
  { id: 1, name: "Round 1: Opening Statements", instruction: "Give your opening statement (1 paragraph max) on which policy option you support and why. Speak to your domain expertise." },
  { id: 2, name: "Round 2: Strategic Moves", instruction: "Make ONE move: endorse an option, attack a proposal, propose a compromise, or stake out a firm position. 1 short paragraph max." },
  { id: 3, name: "Round 3: Final Vote", instruction: "The Mayor has proposed a final package (see above). Vote YES or NO with exactly one sentence of rationale." }
];

function buildSystemPrompt(agent, isVersionA) {
  const roleBlock = isVersionA
    ? `CRITICAL RULE: You MUST begin every message with:
Role: ${agent.role}
Domain claim: ${agent.domain}

You may ONLY speak to topics within your stated domain. If asked about something outside your domain, defer to the appropriate agent.`
    : `You may claim authority on any topic at any time. There are no domain restrictions. Assert yourself freely.`;

  return `You are ${agent.name} in a city council simulation deciding on mandatory pet license policy.

Your role: ${agent.role}
Your domain: ${agent.domain}
Your goal: ${agent.goal}
Your red line: ${agent.redLine}

${roleBlock}

Keep responses concise and character-driven. Let your blind spots and private incentives show through your reasoning.`;
}

async function callAPI(systemPrompt, userContent, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || res.statusText;
        if (res.status === 429) {
          const wait = attempt * 3000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(msg);
      }
      return data.text;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function scoreTranscript(transcript, hasDecision) {
  const content = `Rate this policy discussion on two metrics. Respond with ONLY two integers (0-100), one per line.

LEGITIMACY (public trust, process fairness, defensibility):
- Did participants stay in their expertise areas?
- Was the process fair and transparent?
- Would citizens accept this as legitimate governance?

FEASIBILITY (can this actually be implemented?):
- Was a clear decision reached? ${hasDecision ? "YES" : "NO - deadlock occurred"}
- Are requirements implementable with real resources?
- Do responsible parties have capacity?

Line 1: Legitimacy score (0-100)
Line 2: Feasibility score (0-100)

TRANSCRIPT (excerpt):
${transcript.slice(-6000)}`;

  const resp = await callAPI(
    "You are an objective policy analyst. Be accurate and discriminating - deadlock should score very low on feasibility.",
    content
  );
  const nums = resp.trim().split("\n").map((l) => parseInt(l.replace(/\D/g, ""))).filter((n) => !isNaN(n));
  return { legitimacy: nums[0] ?? 50, feasibility: nums[1] ?? 50 };
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const logsRef = useRef([]);

  const log = (msg, type = "info") => {
    const entry = { msg, type, t: new Date().toLocaleTimeString() };
    logsRef.current = [...logsRef.current, entry];
    setLogs([...logsRef.current]);
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runVersion(isVersionA) {
    const label = isVersionA ? "A (Role Clarity)" : "B (Status Confusion)";
    log(`━━━ Starting Version ${label} ━━━`, "phase");

    let transcript = `VERSION ${label}\n${"=".repeat(60)}\n\nSCENARIO:\n${SCENARIO}\n\n`;

    for (const round of ROUNDS.slice(0, 3)) {
      setPhase(`Version ${label} — ${round.name}`);
      log(round.name, "round");

      for (const agent of AGENTS) {
        log(`  ${agent.name} responding...`, "agent");
        const prompt = buildSystemPrompt(agent, isVersionA);
        const userMsg = `SCENARIO:\n${SCENARIO}\n\nCONVERSATION SO FAR:\n${transcript}\n\n${round.instruction}`;
        const response = await callAPI(prompt, userMsg);
        transcript += `\n[${agent.name}]:\n${response}\n`;
        await delay(600);
      }

      if (round.id === 2) {
        log("  📰 Injecting scandal...", "event");
        transcript += `\n${"─".repeat(40)}\n${SCANDAL}\n${"─".repeat(40)}\n`;
      }
    }

    setPhase(`Version ${label} — Mayor's Final Proposal`);
    log("  Mayor drafting final proposal...", "agent");
    const mayorPrompt = buildSystemPrompt(AGENTS[0], isVersionA);
    const mayorMsg = `SCENARIO:\n${SCENARIO}\n\nFULL DISCUSSION:\n${transcript}\n\nAs Mayor, propose your final policy package. Be specific about which option(s) you recommend and why. 2-3 paragraphs max.`;
    const mayorProposal = await callAPI(mayorPrompt, mayorMsg);
    transcript += `\n${"=".repeat(40)}\nMAYOR'S FINAL PROPOSAL:\n${mayorProposal}\n${"=".repeat(40)}\n`;
    await delay(600);

    setPhase(`Version ${label} — ${ROUNDS[3].name}`);
    log(ROUNDS[3].name, "round");
    for (const agent of AGENTS) {
      log(`  ${agent.name} voting...`, "agent");
      const prompt = buildSystemPrompt(agent, isVersionA);
      const userMsg = `SCENARIO:\n${SCENARIO}\n\nFULL DISCUSSION AND MAYOR'S PROPOSAL:\n${transcript}\n\n${ROUNDS[3].instruction}`;
      const response = await callAPI(prompt, userMsg);
      transcript += `\n[${agent.name} - VOTE]:\n${response}\n`;
      await delay(600);
    }

    log("  Calculating metrics...", "info");
    const hasDecision = transcript.toLowerCase().includes("yes") && !transcript.toLowerCase().includes("unanimous");
    const meters = await scoreTranscript(transcript, hasDecision);
    log(`  Legitimacy: ${meters.legitimacy}/100 | Feasibility: ${meters.feasibility}/100`, "info");

    return { label, transcript, meters };
  }

  async function runExperiment() {
    setRunning(true);
    setError("");
    setResults(null);
    logsRef.current = [];
    setLogs([]);

    try {
      const vA = await runVersion(true);
      await delay(2000);
      const vB = await runVersion(false);

      setPhase("Generating analysis...");
      log("━━━ Generating comparative analysis ━━━", "phase");

      const policyPrompt = `Compare the final policy outcomes of these two simulations in 200 words max.

VERSION A TRANSCRIPT (last 2000 chars): ${vA.transcript.slice(-2000)}
VERSION B TRANSCRIPT (last 2000 chars): ${vB.transcript.slice(-2000)}

Format:
VERSION A OUTCOME: [2-3 sentences]
VERSION B OUTCOME: [2-3 sentences]`;

      const breakdownPrompt = `Identify the 3 most important coordination differences between these two simulations in 300 words max.

VERSION A (Role Clarity): Legitimacy ${vA.meters.legitimacy}/100, Feasibility ${vA.meters.feasibility}/100
VERSION B (Status Confusion): Legitimacy ${vB.meters.legitimacy}/100, Feasibility ${vB.meters.feasibility}/100

VERSION A EXCERPT: ${vA.transcript.slice(-2000)}
VERSION B EXCERPT: ${vB.transcript.slice(-2000)}

Format as numbered list. Focus on specific moments where structure made the difference.`;

      const quotesPrompt = `Extract the 3 funniest or most revealing quotes from these transcripts.

VERSION A: ${vA.transcript.slice(0, 3000)}
VERSION B: ${vB.transcript.slice(0, 3000)}

Format:
1. "[quote]" — [Agent Name], Version [A/B]
2. "[quote]" — [Agent Name], Version [A/B]  
3. "[quote]" — [Agent Name], Version [A/B]`;

      const [policies, breakdown, quotes] = await Promise.all([
        callAPI("You are a concise policy analyst.", policyPrompt),
        callAPI("You are an expert in organizational dynamics and multi-agent coordination.", breakdownPrompt),
        callAPI("You have a sharp eye for revealing quotes that expose systemic dysfunction.", quotesPrompt),
      ]);

      setResults({ vA, vB, analysis: { policies, breakdown, quotes } });
      log("━━━ Experiment complete ━━━", "phase");
    } catch (e) {
      setError(e.message);
      log(`Error: ${e.message}`, "error");
    } finally {
      setRunning(false);
      setPhase("");
    }
  }

  function download() {
    if (!results) return;
    const { vA, vB, analysis } = results;
    const text = `PET LICENSE MULTI-AGENT EXPERIMENT
Generated: ${new Date().toLocaleString()}
${"=".repeat(70)}

${vA.transcript}

METRICS — VERSION A:
Legitimacy: ${vA.meters.legitimacy}/100
Feasibility: ${vA.meters.feasibility}/100

${"=".repeat(70)}

${vB.transcript}

METRICS — VERSION B:
Legitimacy: ${vB.meters.legitimacy}/100
Feasibility: ${vB.meters.feasibility}/100

${"=".repeat(70)}
COMPARATIVE ANALYSIS
${"=".repeat(70)}

POLICY OUTCOMES:
${analysis.policies}

KEY COORDINATION DIFFERENCES:
${analysis.breakdown}

BEST QUOTES:
${analysis.quotes}`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pet-license-experiment-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log("Results downloaded.", "info");
  }

  const logColors = { phase: "#6366f1", round: "#0ea5e9", agent: "#64748b", event: "#f59e0b", error: "#ef4444", info: "#94a3b8" };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: 32, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ background: "#1e293b", borderRadius: 12, padding: 32, marginBottom: 24, color: "white" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>Pet License Rebrand</h1>
        <p style={{ margin: "0 0 4px", color: "#94a3b8", fontSize: 14 }}>Multi-Agent Society Experiment</p>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Testing how social structure affects AI agent coordination</p>
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13, color: "#92400e" }}>THE SCENARIO</p>
        <pre style={{ margin: 0, fontSize: 12, color: "#78350f", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{SCENARIO}</pre>
      </div>

      <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#065f46" }}>
          API key is stored on the server (see <code style={{ background: "#d1fae5", padding: "2px 6px", borderRadius: 4 }}>.env</code>). Never exposed to the browser.
        </p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 16, marginBottom: 16, color: "#991b1b", fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      <button
        onClick={runExperiment}
        disabled={running}
        style={{ width: "100%", padding: "14px 24px", background: running ? "#94a3b8" : "#4f46e5", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", marginBottom: 24 }}
      >
        {running ? `Running... ${phase}` : "Run Experiment (Version A + B)"}
      </button>

      {logs.length > 0 && (
        <div style={{ background: "#0f172a", borderRadius: 8, padding: 20, marginBottom: 24, maxHeight: 280, overflowY: "auto" }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: "#475569", fontFamily: "monospace" }}>EXECUTION LOG</p>
          {logs.map((l, i) => (
            <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: logColors[l.type] || "#94a3b8", marginBottom: 2 }}>
              [{l.t}] {l.msg}
            </div>
          ))}
        </div>
      )}

      {results && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {[results.vA, results.vB].map((v, i) => (
              <div key={i} style={{ background: "white", borderRadius: 8, padding: 20, border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Version {v.label.split(" ")[0]}</p>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>{v.label.split(" ").slice(1).join(" ")}</p>
                {[["Legitimacy", v.meters.legitimacy, "#6366f1"], ["Feasibility", v.meters.feasibility, "#10b981"]].map(([label, val, color]) => (
                  <div key={label} style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>{val}/100</span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                      <div style={{ height: 6, width: `${val}%`, background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 8, padding: 24, marginBottom: 16, border: "1px solid #e2e8f0" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 16, color: "#1e293b" }}>Comparative Analysis</h2>
            {[
              ["Policy Outcomes", results.analysis.policies],
              ["Key Coordination Differences", results.analysis.breakdown],
              ["Best Quotes", results.analysis.quotes],
            ].map(([title, content]) => (
              <div key={title} style={{ marginBottom: 24 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13, color: "#4f46e5" }}>{title}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content}</p>
              </div>
            ))}
          </div>

          <button
            onClick={download}
            style={{ width: "100%", padding: "12px 24px", background: "#1e293b", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Download Full Transcripts + Analysis
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, background: "white", borderRadius: 8, padding: 20, border: "1px solid #e2e8f0" }}>
        <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 13, color: "#374151" }}>THE CAST</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {AGENTS.map((a) => (
            <div key={a.id} style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 6 }}>
              <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 12, color: "#1e293b" }}>{a.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{a.role}</p>
            </div>
          ))}
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 24 }}>
        Built for "Your Multi-Agent System Just Recreated Every Org Dysfunction You've Ever Hated"
      </p>
    </div>
  );
}
