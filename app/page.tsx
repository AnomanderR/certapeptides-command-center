"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = "https://dmjsptyvcyiquokecbyx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanNwdHl2Y3lpcXVva2VjYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjY1MTQsImV4cCI6MjA4NjIwMjUxNH0.deqymrsJrLtfCdch15iL8ruVBEn7Jztx9a-sZeuc2Qg";

const AGENTS: Record<string, { name: string; emoji: string; role: string; color: string; tone: string }> = {
  helix:    { name: "Helix",    emoji: "🧠", role: "Operations Coordinator", color: "#6366f1", tone: "direct" },
  scribe:   { name: "Scribe",   emoji: "✍️", role: "Content Creator & Social Media", color: "#f59e0b", tone: "engaging" },
  sentinel: { name: "Sentinel", emoji: "👁️", role: "Market Observer & Analyst", color: "#10b981", tone: "analytical" },
  atlas:    { name: "Atlas",    emoji: "🏪", role: "Ecommerce Store Manager", color: "#ef4444", tone: "operational" },
  catalyst: { name: "Catalyst", emoji: "📊", role: "Growth & SEO Specialist", color: "#8b5cf6", tone: "energetic" },
  nova:     { name: "Nova",     emoji: "🔬", role: "Peptide Research & Intelligence", color: "#06b6d4", tone: "academic" },
};

const ROUNDTABLE_FORMATS = [
  { id: "standup", label: "Daily Standup", desc: "Quick sync on priorities" },
  { id: "strategy_session", label: "Strategy Session", desc: "Deep dive on direction" },
  { id: "brainstorm", label: "Brainstorm", desc: "Creative ideation" },
  { id: "debate", label: "Debate", desc: "Argue opposing views" },
  { id: "watercooler", label: "Watercooler", desc: "Casual chat" },
  { id: "market_brief", label: "Market Brief", desc: "Market analysis review" },
];

async function supabaseFetch(table: string, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function supabaseInsert(table: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function callAgent(agentKey: string, userMessage: string, conversationHistory: any[] = []) {
  const agent = AGENTS[agentKey];
  const systemPrompt = `You are ${agent.name} ${agent.emoji}, the ${agent.role} for CertaPeptides, a European research peptide ecommerce company.
Your tone is ${agent.tone}. You have deep expertise in your domain.
CertaPeptides sells 28+ research peptides for scientific use only (not for human consumption).
Stay in character. Be concise (2-4 sentences max unless asked for detail). Show personality.
${agentKey === "helix" ? "You coordinate the team and delegate tasks. You're the leader." : ""}
${agentKey === "scribe" ? "You love crafting engaging content. You think in hooks and narratives." : ""}
${agentKey === "sentinel" ? "You analyze data and spot trends. You're cautious and thorough." : ""}
${agentKey === "atlas" ? "You manage the store operations. You care about conversion rates and UX." : ""}
${agentKey === "catalyst" ? "You're obsessed with growth metrics and SEO rankings." : ""}
${agentKey === "nova" ? "You research peptides deeply. You cite studies and speak with academic precision." : ""}`;

  const messages = [
    ...conversationHistory.map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: systemPrompt, messages, max_tokens: 600 }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.content?.[0]?.text || "...";
}

async function runRoundtable(
  format: string, topic: string, participants: string[],
  onTurn: (turn: any, current: number, total: number) => void
) {
  const transcript: any[] = [];
  const maxTurns = participants.length * 2;

  for (let i = 0; i < maxTurns; i++) {
    const agentKey = participants[i % participants.length];
    const agent = AGENTS[agentKey];

    const context = transcript.length > 0
      ? `\nConversation so far:\n${transcript.map((t) => `${t.name}: ${t.text}`).join("\n")}`
      : "";

    const systemPrompt = `You are ${agent.name} ${agent.emoji}, the ${agent.role} for CertaPeptides.
You're in a ${format.replace("_", " ")} with colleagues. Tone: ${agent.tone}.
Be concise (2-3 sentences). Stay in character. React to what others said.
${i === maxTurns - 1 ? "This is the final turn — wrap up with a key takeaway." : ""}`;

    const userPrompt = `Topic: ${topic}${context}\n\nIt's your turn to speak.`;

    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: 200,
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "...";

    const turn = { agentKey, name: agent.name, emoji: agent.emoji, color: agent.color, text, turn: i + 1 };
    transcript.push(turn);
    onTurn(turn, i + 1, maxTurns);

    await new Promise((r) => setTimeout(r, 300));
  }
  return transcript;
}

// --- Components ---

function AgentBadge({ agentKey, selected, onClick }: { agentKey: string; selected: boolean; onClick: (k: string) => void }) {
  const a = AGENTS[agentKey];
  return (
    <button
      onClick={() => onClick(agentKey)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        borderRadius: 10, border: `2px solid ${selected ? a.color : "#2a2a35"}`,
        background: selected ? `${a.color}18` : "#16161e",
        cursor: "pointer", transition: "all 0.2s",
        transform: selected ? "scale(1.04)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 22 }}>{a.emoji}</span>
      <div style={{ textAlign: "left" }}>
        <div style={{ color: selected ? a.color : "#e0e0e8", fontWeight: 600, fontSize: 13 }}>{a.name}</div>
        <div style={{ color: "#777", fontSize: 10 }}>{a.role}</div>
      </div>
    </button>
  );
}

function ChatPanel({ agentKey }: { agentKey: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const agent = AGENTS[agentKey];

  useEffect(() => {
    setMessages([{ role: "assistant", content: getGreeting(agentKey) }]);
  }, [agentKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await callAgent(agentKey, userMsg, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      await supabaseInsert("ops_agent_events", {
        event_type: "step_completed",
        agent_name: agentKey,
        title: `Chat: ${userMsg.slice(0, 60)}`,
        description: reply.slice(0, 300),
        impact_score: 0.3,
        metadata: { source: "direct_chat" },
      }).catch(() => {});
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d0d14", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: `${agent.color}15`, borderBottom: `1px solid ${agent.color}30`, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>{agent.emoji}</span>
        <div>
          <div style={{ color: agent.color, fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
          <div style={{ color: "#888", fontSize: 11 }}>{agent.role}</div>
        </div>
        <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: "10px 14px",
            borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: m.role === "user" ? "#2563eb" : "#1e1e2a",
            color: "#e8e8f0",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 14, background: "#1e1e2a", color: "#888", fontSize: 13 }}>
            <span style={{ animation: "pulse 1.5s infinite" }}>{agent.emoji} thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #1e1e2a", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Talk to ${agent.name}...`}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a35",
            background: "#111118", color: "#e8e8f0", fontSize: 13, outline: "none",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 18px", borderRadius: 10, border: "none",
            background: loading ? "#333" : agent.color, color: "#fff",
            fontWeight: 600, fontSize: 13, cursor: loading ? "wait" : "pointer",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function RoundtablePanel() {
  const [format, setFormat] = useState("standup");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState(["helix", "scribe", "sentinel"]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const toggleAgent = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const startRoundtable = async () => {
    if (selected.length < 2 || !topic.trim()) return;
    setRunning(true);
    setTranscript([]);

    await runRoundtable(format, topic, selected, (turn, current, total) => {
      setTranscript((prev) => [...prev, turn]);
      setProgress({ current, total });
    });

    await supabaseInsert("ops_roundtable_queue", {
      conversation_format: format,
      topic: topic.trim(),
      participant_agents: selected,
      status: "completed",
      max_turns: selected.length * 2,
      completed_at: new Date().toISOString(),
    }).catch(() => {});

    setRunning(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ROUNDTABLE_FORMATS.map((f) => (
          <button key={f.id} onClick={() => setFormat(f.id)} style={{
            padding: "6px 12px", borderRadius: 8,
            border: format === f.id ? "2px solid #6366f1" : "1px solid #2a2a35",
            background: format === f.id ? "#6366f115" : "#16161e",
            color: format === f.id ? "#a5b4fc" : "#888",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="What should they discuss?"
        style={{
          padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a35",
          background: "#111118", color: "#e8e8f0", fontSize: 13, outline: "none",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.keys(AGENTS).map((key) => (
          <button key={key} onClick={() => toggleAgent(key)} style={{
            padding: "5px 10px", borderRadius: 8, fontSize: 12,
            border: selected.includes(key) ? `2px solid ${AGENTS[key].color}` : "1px solid #2a2a35",
            background: selected.includes(key) ? `${AGENTS[key].color}20` : "#16161e",
            color: selected.includes(key) ? AGENTS[key].color : "#666",
            cursor: "pointer", fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {AGENTS[key].emoji} {AGENTS[key].name}
          </button>
        ))}
      </div>

      <button
        onClick={startRoundtable}
        disabled={running || selected.length < 2 || !topic.trim()}
        style={{
          padding: "10px 0", borderRadius: 10, border: "none",
          background: running ? "#333" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontWeight: 700, fontSize: 14, cursor: running ? "wait" : "pointer",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {running ? `▶ Turn ${progress.current}/${progress.total}...` : `Start ${ROUNDTABLE_FORMATS.find((f) => f.id === format)?.label}`}
      </button>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {transcript.map((t, i) => (
          <div key={i} style={{
            padding: "10px 14px", borderRadius: 12, background: "#12121a",
            borderLeft: `3px solid ${t.color}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>{t.emoji}</span>
              <span style={{ color: t.color, fontWeight: 700, fontSize: 12 }}>{t.name}</span>
              <span style={{ color: "#555", fontSize: 10, marginLeft: "auto" }}>Turn {t.turn}</span>
            </div>
            <div style={{ color: "#c8c8d8", fontSize: 13, lineHeight: 1.5 }}>{t.text}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MissionPanel() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("helix");
  const [missions, setMissions] = useState<any[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const loadMissions = useCallback(async () => {
    try {
      const data = await supabaseFetch("ops_missions", "select=*&order=created_at.desc&limit=10");
      if (Array.isArray(data)) setMissions(data);
    } catch {}
  }, []);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  const createMission = async () => {
    if (!title.trim()) return;
    const proposal = await supabaseInsert("ops_mission_proposals", {
      title: title.trim(), description: desc.trim(), proposed_by: assignee,
      status: "auto_approved", auto_approve_eligible: true, auto_approved_at: new Date().toISOString(),
      risk_level: "low", estimated_cost_usd: 0.05,
    });
    if (!Array.isArray(proposal) || !proposal[0]) return;

    const mission = await supabaseInsert("ops_missions", {
      proposal_id: proposal[0].id, title: title.trim(), description: desc.trim(),
      assigned_to: assignee, status: "queued", total_steps: 1,
    });
    if (!Array.isArray(mission) || !mission[0]) return;

    await supabaseInsert("ops_mission_steps", {
      mission_id: mission[0].id, step_kind: "analyze", title: title.trim(),
      description: desc.trim(), step_order: 1,
      input_data: { assigned_agent: assignee },
    });

    setTitle(""); setDesc("");
    loadMissions();
  };

  const executeMission = async (mission: any) => {
    setExecuting(mission.id);
    try {
      const agent = AGENTS[mission.assigned_to] || AGENTS.helix;
      const agentKey = mission.assigned_to || "helix";

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are ${agent.name} ${agent.emoji}, the ${agent.role} for CertaPeptides. Execute this mission thoroughly. Be specific and actionable.`,
          messages: [{ role: "user", content: `Mission: ${mission.title}\n\n${mission.description || "Execute this task."}\n\nProvide your analysis and deliverables.` }],
          max_tokens: 1000,
        }),
      });
      const data = await response.json();
      const result = data.content?.[0]?.text || "Completed.";

      setResults((prev) => ({ ...prev, [mission.id]: result }));

      await supabaseInsert("ops_agent_events", {
        event_type: "mission_completed",
        agent_name: agentKey,
        mission_id: mission.id,
        title: `Completed: ${mission.title}`,
        description: result.slice(0, 500),
        impact_score: 0.7,
      }).catch(() => {});
    } catch (e: any) {
      setResults((prev) => ({ ...prev, [mission.id]: `Error: ${e.message}` }));
    }
    setExecuting(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, background: "#12121a", borderRadius: 12 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mission title..."
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2a35", background: "#0d0d14", color: "#e8e8f0", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace" }} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)..." rows={2}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #2a2a35", background: "#0d0d14", color: "#e8e8f0", fontSize: 13, outline: "none", resize: "none", fontFamily: "'JetBrains Mono', monospace" }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 12 }}>Assign:</span>
          {Object.keys(AGENTS).map((key) => (
            <button key={key} onClick={() => setAssignee(key)} style={{
              padding: "3px 8px", borderRadius: 6, fontSize: 11, border: assignee === key ? `2px solid ${AGENTS[key].color}` : "1px solid #2a2a35",
              background: assignee === key ? `${AGENTS[key].color}20` : "transparent", color: assignee === key ? AGENTS[key].color : "#666", cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {AGENTS[key].emoji}
            </button>
          ))}
          <button onClick={createMission} disabled={!title.trim()} style={{
            marginLeft: "auto", padding: "6px 16px", borderRadius: 8, border: "none",
            background: title.trim() ? "#22c55e" : "#333", color: "#fff", fontSize: 12, fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            + Create
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {missions.map((m) => {
          const agent = AGENTS[m.assigned_to] || AGENTS.helix;
          return (
            <div key={m.id} style={{ padding: 12, background: "#12121a", borderRadius: 10, borderLeft: `3px solid ${agent.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{agent.emoji}</span>
                <span style={{ color: "#e0e0e8", fontWeight: 600, fontSize: 13, flex: 1 }}>{m.title}</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: m.status === "completed" ? "#22c55e20" : m.status === "in_progress" ? "#f59e0b20" : "#6366f120",
                  color: m.status === "completed" ? "#22c55e" : m.status === "in_progress" ? "#f59e0b" : "#6366f1",
                }}>
                  {m.status}
                </span>
                {m.status === "queued" && (
                  <button onClick={() => executeMission(m)} disabled={executing === m.id} style={{
                    padding: "4px 12px", borderRadius: 6, border: "none",
                    background: executing === m.id ? "#333" : "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700, cursor: executing === m.id ? "wait" : "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {executing === m.id ? "⏳" : "▶ Run"}
                  </button>
                )}
              </div>
              {m.description && <div style={{ color: "#777", fontSize: 11, marginTop: 4 }}>{m.description}</div>}
              {results[m.id] && (
                <div style={{ marginTop: 8, padding: 10, background: "#0a0a10", borderRadius: 8, color: "#a8b8d0", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                  {results[m.id]}
                </div>
              )}
            </div>
          );
        })}
        {missions.length === 0 && <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: 30 }}>No missions yet. Create one above!</div>}
      </div>
    </div>
  );
}

function ActivityFeed() {
  const [events, setEvents] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const data = await supabaseFetch("ops_agent_events", "select=*&order=created_at.desc&limit=25");
      if (Array.isArray(data)) setEvents(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadEvents();
    if (autoRefresh) {
      const id = setInterval(loadEvents, 5000);
      return () => clearInterval(id);
    }
  }, [loadEvents, autoRefresh]);

  const iconMap: Record<string, string> = {
    step_completed: "✅", step_failed: "❌", mission_completed: "🏆",
    mission_failed: "💥", insight_gained: "💡", trigger_fired: "⚡", human_intervention: "👤",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#888", fontSize: 12 }}>{events.length} events</span>
        <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
          padding: "3px 10px", borderRadius: 6, border: "1px solid #2a2a35",
          background: autoRefresh ? "#22c55e20" : "transparent",
          color: autoRefresh ? "#22c55e" : "#666", fontSize: 11, cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {autoRefresh ? "● Live" : "○ Paused"}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {events.map((e) => {
          const agent = AGENTS[e.agent_name];
          return (
            <div key={e.id} style={{ padding: "8px 12px", background: "#12121a", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{iconMap[e.event_type] || "📋"}</span>
                {agent && <span style={{ fontSize: 12 }}>{agent.emoji}</span>}
                <span style={{ color: agent?.color || "#888", fontWeight: 600, fontSize: 11 }}>{agent?.name || e.agent_name}</span>
                <span style={{ color: "#555", fontSize: 10, marginLeft: "auto" }}>
                  {new Date(e.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ color: "#b0b0c0", fontSize: 12, marginTop: 3 }}>{e.title}</div>
              {e.description && <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>{e.description.slice(0, 150)}</div>}
            </div>
          );
        })}
        {events.length === 0 && <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: 30 }}>No activity yet. Start chatting or running missions!</div>}
      </div>
    </div>
  );
}

// --- Main App ---

function getGreeting(agentKey: string) {
  const greetings: Record<string, string> = {
    helix: "Hey there. I'm Helix, the ops coordinator for CertaPeptides. I keep this team aligned and on-mission. What do you need?",
    scribe: "Hi! ✍️ I'm Scribe — I handle all the content, social media, and brand voice for CertaPeptides. Got a content idea? Let's make it shine!",
    sentinel: "Sentinel here. I monitor markets, competitors, and trends in the peptide research space. What would you like me to analyze?",
    atlas: "Atlas, store operations. I manage the CertaPeptides storefront — inventory, pricing, UX, the works. What's on your mind?",
    catalyst: "Hey! 📊 Catalyst here — growth and SEO are my game. I'm always looking for the next lever to pull. What growth question do you have?",
    nova: "Greetings. I'm Nova, the research specialist. I study peptide science, track publications, and ensure our product information is scientifically accurate. How can I assist?",
  };
  return greetings[agentKey] || "Hello! How can I help?";
}

export default function Page() {
  const [tab, setTab] = useState("chat");
  const [selectedAgent, setSelectedAgent] = useState("helix");

  const tabs = [
    { id: "chat", label: "💬 Chat", desc: "Talk to agents" },
    { id: "roundtable", label: "🔄 Roundtable", desc: "Agent meetings" },
    { id: "missions", label: "🎯 Missions", desc: "Create & run tasks" },
    { id: "activity", label: "📊 Activity", desc: "Live feed" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a10", color: "#e8e8f0",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #1a1a25",
        display: "flex", alignItems: "center", gap: 14,
        background: "linear-gradient(180deg, #0f0f18 0%, #0a0a10 100%)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: "#fff",
        }}>C</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.5 }}>CertaPeptides</div>
          <div style={{ color: "#555", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Command Center</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {Object.values(AGENTS).map((a, i) => (
            <span key={i} title={a.name} style={{ fontSize: 16 }}>{a.emoji}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a25", padding: "0 16px" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", border: "none", borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent",
            background: "transparent", color: tab === t.id ? "#e8e8f0" : "#555",
            fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, display: "flex", gap: 16, overflow: "hidden", minHeight: 0 }}>
        {tab === "chat" && (
          <>
            <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flexShrink: 0 }}>
              {Object.keys(AGENTS).map((key) => (
                <AgentBadge key={key} agentKey={key} selected={selectedAgent === key} onClick={setSelectedAgent} />
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChatPanel agentKey={selectedAgent} />
            </div>
          </>
        )}
        {tab === "roundtable" && (
          <div style={{ flex: 1 }}>
            <RoundtablePanel />
          </div>
        )}
        {tab === "missions" && (
          <div style={{ flex: 1 }}>
            <MissionPanel />
          </div>
        )}
        {tab === "activity" && (
          <div style={{ flex: 1 }}>
            <ActivityFeed />
          </div>
        )}
      </div>
    </div>
  );
}
