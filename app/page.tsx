"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// CERTAPEPTIDES MISSION CONTROL v3.0 — Visual Command Center
// Live agent presence + game-style HQ scene + full ops dashboard
// ═══════════════════════════════════════════════════════════════

const SB_URL = "https://dmjsptyvcyiquokecbyx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanNwdHl2Y3lpcXVva2VjYnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjY1MTQsImV4cCI6MjA4NjIwMjUxNH0.deqymrsJrLtfCdch15iL8ruVBEn7Jztx9a-sZeuc2Qg";

type Agent = {
  key: string; name: string; emoji: string; role: string; color: string;
  tone: string; status: "online"|"busy"|"idle"|"offline";
  xp: number; level: number; missions: number; currentTask: string;
  rpgClass: string; vrl: number; spd: number; rch: number; tru: number; wis: number; cre: number;
};

type Relationship = { agent_a: string; agent_b: string; affinity: number };

const RPG_CLASSES: Record<string, { icon: string; color: string }> = {
  Commander: { icon: "⚔️", color: "#FFD700" },
  Strategist: { icon: "🎯", color: "#00E5FF" },
  Artisan: { icon: "🎨", color: "#E040FB" },
  Ranger: { icon: "🏹", color: "#76FF03" },
  Sage: { icon: "📚", color: "#FF6E40" },
  Alchemist: { icon: "⚗️", color: "#FFAB40" },
  Oracle: { icon: "🔮", color: "#7C4DFF" },
  Recruit: { icon: "🛡️", color: "#888" },
};

const STAT_LABELS: Record<string, { label: string; color: string }> = {
  VRL: { label: "Viral", color: "#f43f5e" },
  SPD: { label: "Speed", color: "#06b6d4" },
  RCH: { label: "Reach", color: "#8b5cf6" },
  TRU: { label: "Trust", color: "#22c55e" },
  WIS: { label: "Wisdom", color: "#3b82f6" },
  CRE: { label: "Creative", color: "#f59e0b" },
};

const RELEVANT_STATS: Record<string, string[]> = {
  snapsnap: ["TRU", "SPD", "WIS", "CRE"],
  helix: ["SPD", "TRU", "WIS", "RCH"],
  scribe: ["CRE", "VRL", "WIS", "TRU"],
  sentinel: ["WIS", "SPD", "TRU", "RCH"],
  atlas: ["WIS", "TRU", "SPD", "CRE"],
  catalyst: ["SPD", "VRL", "RCH", "CRE"],
  nova: ["WIS", "TRU", "SPD", "RCH"],
};

const AGENT_DEFAULTS: Agent[] = [
  { key:"snapsnap", name:"SnapSnap", emoji:"👑", role:"Chief Executive Agent", color:"#fbbf24", tone:"strategic", status:"online", xp:9500, level:10, missions:142, currentTask:"Monitoring fleet", rpgClass:"Commander", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"helix",    name:"Helix",    emoji:"🧬", role:"Operations Strategist", color:"#00E5FF", tone:"direct", status:"online", xp:7200, level:8, missions:98, currentTask:"Coordinating", rpgClass:"Strategist", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"scribe",   name:"Scribe",   emoji:"✍️", role:"Content Artisan", color:"#E040FB", tone:"engaging", status:"busy", xp:6100, level:7, missions:76, currentTask:"Writing content", rpgClass:"Artisan", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"sentinel", name:"Sentinel", emoji:"🛡️", role:"Data Ranger", color:"#76FF03", tone:"analytical", status:"online", xp:5800, level:7, missions:64, currentTask:"Scanning markets", rpgClass:"Ranger", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"atlas",    name:"Atlas",    emoji:"🗺️", role:"Market Sage", color:"#FF6E40", tone:"operational", status:"idle", xp:4200, level:6, missions:53, currentTask:"Standby", rpgClass:"Sage", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"catalyst", name:"Catalyst", emoji:"⚡", role:"Growth Alchemist", color:"#FFAB40", tone:"energetic", status:"online", xp:5400, level:6, missions:61, currentTask:"SEO tracking", rpgClass:"Alchemist", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
  { key:"nova",     name:"Nova",     emoji:"🔮", role:"Strategic Oracle", color:"#7C4DFF", tone:"academic", status:"idle", xp:4800, level:6, missions:47, currentTask:"Research loaded", rpgClass:"Oracle", vrl:25, spd:30, rch:20, tru:40, wis:30, cre:25 },
];

let AGENT_MAP: Record<string, Agent> = {};
AGENT_DEFAULTS.forEach(a => AGENT_MAP[a.key] = { ...a });

// ── Supabase helpers ──
async function sbFetch(table: string, q = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${q}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return r.json();
}

async function sbInsert(table: string, data: any) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  return r.json();
}

// ── LLM call ──
async function callAgent(agentKey: string, userMessage: string, history: any[] = []) {
  const a = AGENT_MAP[agentKey] || AGENT_MAP.helix;
  const sys = `You are ${a.name} ${a.emoji}, the ${a.role} for CertaPeptides, a European research peptide company.
Tone: ${a.tone}. Be concise (2-4 sentences). Show personality.
${agentKey === "snapsnap" ? "You are the CEO agent. You orchestrate all other agents and make strategic decisions." : ""}`;
  const res = await fetch("/api/agent", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: sys, messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }], max_tokens: 600 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content?.[0]?.text || "...";
}

// ══════════════════════════════════════
// VISUAL COMPONENTS
// ══════════════════════════════════════

function GlowOrb({ color, size = 10, pulse = false }: { color: string; size?: number; pulse?: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, boxShadow: `0 0 ${size}px ${color}80`,
      animation: pulse ? "pulse 2s infinite" : undefined,
    }} />
  );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: string|number; icon: string; color: string; sub?: string }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 14,
      background: "rgba(15,15,25,0.8)", backdropFilter: "blur(12px)",
      border: `1px solid ${color}25`, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, fontSize: 60, opacity: 0.06 }}>{icon}</div>
      <div style={{ color: "#888", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: "#555", fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ═══ VISUAL COMMAND CENTER SCENE ═══
// Shows agents as visual avatars around a central command hub
function CommandCenterScene({ agents, onAgentClick, selectedAgent }: { agents: Agent[]; onAgentClick: (key: string) => void; selectedAgent: string|null }) {
  const statusColors: Record<string, string> = { online: "#22c55e", busy: "#f59e0b", idle: "#6366f1", offline: "#555" };
  const statusLabels: Record<string, string> = { online: "Active", busy: "Working", idle: "Standby", offline: "Offline" };

  // CEO sits at the center-top, others arranged in a semicircle
  const ceo = agents.find(a => a.key === "snapsnap")!;
  const fleet = agents.filter(a => a.key !== "snapsnap");

  return (
    <div style={{
      position: "relative", borderRadius: 20, overflow: "hidden",
      background: "linear-gradient(180deg, rgba(15,15,25,0.9) 0%, rgba(7,7,12,0.95) 100%)",
      border: "1px solid #fbbf2415", padding: "20px 20px 16px",
      minHeight: 320,
    }}>
      {/* Ambient grid background */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(251,191,36,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      {/* Radial glow from center */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)",
      }} />

      {/* Title bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: "#fbbf24", fontSize: 12 }}>⬡</span>
        <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase", letterSpacing: 2 }}>Fleet Command — Live View</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <GlowOrb color="#22c55e" size={6} pulse />
          <span style={{ color: "#22c55e", fontSize: 9 }}>LIVE</span>
        </div>
      </div>

      {/* CEO Command Desk — center top */}
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <button onClick={() => onAgentClick("snapsnap")} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          padding: "16px 28px", borderRadius: 20, cursor: "pointer",
          background: selectedAgent === "snapsnap"
            ? "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))"
            : "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(15,15,25,0.6))",
          border: selectedAgent === "snapsnap" ? "2px solid #fbbf24" : "1px solid #fbbf2430",
          boxShadow: "0 0 30px rgba(251,191,36,0.1)",
          transition: "all 0.3s",
        }}>
          {/* Desk illustration */}
          <div style={{ position: "relative" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, boxShadow: "0 4px 20px rgba(251,191,36,0.3)",
              animation: "glow 3s infinite",
            }}>👑</div>
            {/* Status indicator */}
            <div style={{
              position: "absolute", bottom: -2, right: -2, width: 16, height: 16,
              borderRadius: "50%", background: statusColors[ceo.status],
              border: "3px solid #0a0a10", boxShadow: `0 0 8px ${statusColors[ceo.status]}`,
            }} />
            {/* Desk */}
            <div style={{
              position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
              width: 80, height: 6, borderRadius: 3,
              background: "linear-gradient(90deg, transparent, #fbbf2430, transparent)",
            }} />
          </div>
          <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 13 }}>{ceo.name}</div>
          <div style={{ color: "#888", fontSize: 9 }}>{ceo.rpgClass ? `${RPG_CLASSES[ceo.rpgClass]?.icon || ""} ${ceo.rpgClass}` : ceo.role}</div>
          <div style={{ color: "#fbbf24", fontSize: 8, opacity: 0.7 }}>LV.{ceo.level}</div>
          <div style={{
            padding: "3px 10px", borderRadius: 6,
            background: `${statusColors[ceo.status]}15`, color: statusColors[ceo.status],
            fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
          }}>{ceo.currentTask}</div>
        </button>
      </div>

      {/* Connection lines from CEO to fleet */}
      <div style={{
        position: "absolute", top: 160, left: "50%", transform: "translateX(-50%)",
        width: "70%", height: 1, background: "linear-gradient(90deg, transparent, #fbbf2420, transparent)",
      }} />

      {/* Fleet agents in a grid */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {fleet.map((a) => (
          <button key={a.key} onClick={() => onAgentClick(a.key)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            padding: "12px 6px", borderRadius: 16, cursor: "pointer",
            background: selectedAgent === a.key
              ? `linear-gradient(135deg, ${a.color}15, ${a.color}05)`
              : "rgba(15,15,25,0.4)",
            border: selectedAgent === a.key ? `2px solid ${a.color}` : `1px solid ${a.color}15`,
            transition: "all 0.3s",
            transform: selectedAgent === a.key ? "scale(1.05)" : "scale(1)",
          }}>
            <div style={{ position: "relative" }}>
              {/* Agent avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: `linear-gradient(135deg, ${a.color}30, ${a.color}10)`,
                border: `2px solid ${a.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>{a.emoji}</div>
              {/* Live status dot */}
              <div style={{
                position: "absolute", bottom: -1, right: -1, width: 12, height: 12,
                borderRadius: "50%", background: statusColors[a.status],
                border: "2px solid #0a0a10", boxShadow: `0 0 6px ${statusColors[a.status]}`,
                animation: a.status === "online" || a.status === "busy" ? "pulse 2s infinite" : undefined,
              }} />
            </div>
            <div style={{ color: selectedAgent === a.key ? a.color : "#c0c0d0", fontWeight: 700, fontSize: 10, textAlign: "center" }}>{a.name}</div>
            <div style={{ color: RPG_CLASSES[a.rpgClass]?.color || "#888", fontSize: 7, fontWeight: 600 }}>
              {RPG_CLASSES[a.rpgClass]?.icon || "🛡️"} {a.rpgClass || "Recruit"} • LV.{a.level}
            </div>
            <div style={{
              padding: "2px 6px", borderRadius: 4,
              background: `${statusColors[a.status]}10`, color: statusColors[a.status],
              fontSize: 7, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
            }}>{statusLabels[a.status]}</div>
            {/* Mini stat bars */}
            <div style={{ width: "100%", padding: "0 4px", display: "flex", flexDirection: "column", gap: 2 }}>
              {(RELEVANT_STATS[a.key] || ["TRU","SPD"]).slice(0, 2).map(stat => {
                const val = (a as any)[stat.toLowerCase()] || 25;
                const sl = STAT_LABELS[stat];
                return (
                  <div key={stat} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ color: sl?.color || "#888", fontSize: 6, width: 18, textAlign: "right" }}>{stat}</span>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: "#1a1a25", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${val}%`, background: sl?.color || "#888", transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                    </div>
                    <span style={{ color: "#555", fontSize: 6, width: 14 }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Floor reflection */}
      <div style={{
        marginTop: 16, height: 2, borderRadius: 1,
        background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.1), rgba(251,191,36,0.1), transparent)",
      }} />
    </div>
  );
}

// ── RPG Stat Bar (animated elastic easing) ──
function RpgStatBar({ stat, value, maxVal = 100 }: { stat: string; value: number; maxVal?: number }) {
  const sl = STAT_LABELS[stat];
  const pct = Math.min(100, Math.max(0, (value / maxVal) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: sl?.color || "#888", fontSize: 9, fontWeight: 700, width: 24, textAlign: "right" }}>{stat}</span>
      <span style={{ color: "#555", fontSize: 8, width: 36 }}>{sl?.label || stat}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1a1a25", overflow: "hidden", position: "relative" }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${pct}%`,
          background: `linear-gradient(90deg, ${sl?.color || "#888"}cc, ${sl?.color || "#888"})`,
          boxShadow: `0 0 8px ${sl?.color || "#888"}40`,
          transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }} />
      </div>
      <span style={{ color: sl?.color || "#888", fontSize: 10, fontWeight: 800, width: 24, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Agent Detail Panel (appears when agent is selected in scene) ──
function AgentDetailPanel({ agent, events, relationships, onChat, onClose }: { agent: Agent; events: any[]; relationships: Relationship[]; onChat: () => void; onClose: () => void }) {
  const agentEvents = events.filter(e => e.agent_name === agent.key).slice(0, 5);
  const statusColors: Record<string, string> = { online: "#22c55e", busy: "#f59e0b", idle: "#6366f1", offline: "#555" };
  const rpgCls = RPG_CLASSES[agent.rpgClass] || RPG_CLASSES.Recruit;
  const relevantStats = RELEVANT_STATS[agent.key] || ["TRU", "SPD", "WIS", "CRE"];

  // Get affinities for this agent
  const agentRels = relationships.filter(r => r.agent_a === agent.key || r.agent_b === agent.key).map(r => {
    const otherKey = r.agent_a === agent.key ? r.agent_b : r.agent_a;
    const other = AGENT_MAP[otherKey];
    return { key: otherKey, name: other?.name || otherKey, emoji: other?.emoji || "?", color: other?.color || "#888", affinity: r.affinity };
  }).sort((a, b) => b.affinity - a.affinity);

  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: `linear-gradient(135deg, ${agent.color}08, rgba(15,15,25,0.9))`,
      border: `1px solid ${agent.color}25`, position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${agent.color}30, ${agent.color}10)`,
          border: `2px solid ${agent.color}40`, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24,
        }}>{agent.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: agent.color, fontWeight: 800, fontSize: 16 }}>{agent.name}</span>
            <span style={{ padding: "2px 8px", borderRadius: 6, background: `${rpgCls.color}15`, color: rpgCls.color, fontSize: 9, fontWeight: 700 }}>{rpgCls.icon} {agent.rpgClass}</span>
          </div>
          <div style={{ color: "#888", fontSize: 10 }}>{agent.role}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <GlowOrb color={statusColors[agent.status]} size={8} pulse={agent.status === "online" || agent.status === "busy"} />
            <span style={{ color: statusColors[agent.status], fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{agent.status}</span>
          </div>
          <span style={{ color: "#fbbf24", fontSize: 9 }}>★ Level {agent.level} • {agent.xp.toLocaleString()} XP</span>
        </div>
        <button onClick={onClose} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontSize: 12 }}>✕</button>
      </div>

      {/* Current task */}
      <div style={{
        padding: "8px 12px", borderRadius: 8, background: "rgba(10,10,16,0.6)",
        border: `1px solid ${agent.color}15`, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color: agent.color, fontSize: 10, fontWeight: 700 }}>CURRENT:</span>
        <span style={{ color: "#c0c0d0", fontSize: 11 }}>{agent.currentTask}</span>
      </div>

      {/* RPG Stats + Level section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Left: RPG stat bars */}
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(10,10,16,0.5)", border: "1px solid #ffffff06" }}>
          <div style={{ color: "#888", fontSize: 8, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Combat Stats</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {relevantStats.map(stat => (
              <RpgStatBar key={stat} stat={stat} value={(agent as any)[stat.toLowerCase()] || 0} />
            ))}
          </div>
        </div>
        {/* Right: Level + missions + XP */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ padding: "8px", borderRadius: 8, background: "rgba(10,10,16,0.4)", textAlign: "center" }}>
              <div style={{ color: "#fbbf24", fontSize: 18, fontWeight: 800 }}>{agent.level}</div>
              <div style={{ color: "#666", fontSize: 7, textTransform: "uppercase" }}>Level</div>
            </div>
            <div style={{ padding: "8px", borderRadius: 8, background: "rgba(10,10,16,0.4)", textAlign: "center" }}>
              <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 800 }}>{agent.missions}</div>
              <div style={{ color: "#666", fontSize: 7, textTransform: "uppercase" }}>Missions</div>
            </div>
          </div>
          {/* XP progress bar */}
          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(10,10,16,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#666", fontSize: 8 }}>XP: {agent.xp.toLocaleString()}</span>
              <span style={{ color: "#666", fontSize: 8 }}>{agent.xp % 1000}/1000</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "#1a1a25", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${(agent.xp % 1000) / 10}%`, background: `linear-gradient(90deg, ${agent.color}, ${agent.color}80)`, transition: "width 1s" }} />
            </div>
          </div>
          {/* Affinities */}
          {agentRels.length > 0 && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(10,10,16,0.4)" }}>
              <div style={{ color: "#888", fontSize: 7, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Bonds</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {agentRels.slice(0, 4).map(r => {
                  const affColor = r.affinity >= 0.7 ? "#22c55e" : r.affinity >= 0.5 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 4, background: `${affColor}10`, border: `1px solid ${affColor}20` }}>
                      <span style={{ fontSize: 10 }}>{r.emoji}</span>
                      <span style={{ color: affColor, fontSize: 8, fontWeight: 700 }}>{(r.affinity * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ color: "#888", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Recent Activity</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 100, overflowY: "auto", marginBottom: 12 }}>
        {agentEvents.map((e, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 6, background: "rgba(10,10,16,0.5)", color: "#888", fontSize: 10, lineHeight: 1.3 }}>
            {e.title?.slice(0, 80)}
          </div>
        ))}
        {agentEvents.length === 0 && <div style={{ color: "#444", fontSize: 10, padding: 8 }}>No recent activity</div>}
      </div>

      <button onClick={onChat} style={{
        width: "100%", padding: "10px 0", borderRadius: 10,
        border: "none", background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
        color: "#000", fontWeight: 800, fontSize: 12, cursor: "pointer",
      }}>💬 Chat with {agent.name}</button>
    </div>
  );
}

// ── Live Activity Ticker ──
function ActivityTicker({ events }: { events: any[] }) {
  const iconMap: Record<string, string> = {
    step_completed: "✅", step_failed: "❌", mission_completed: "🏆",
    mission_failed: "💥", insight_gained: "💡", trigger_fired: "⚡", human_intervention: "👤",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", padding: "2px 4px" }}>
      {events.slice(0, 20).map((e, i) => {
        const a = AGENT_MAP[e.agent_name];
        return (
          <div key={e.id || i} style={{
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(15,15,25,0.7)", backdropFilter: "blur(8px)",
            borderLeft: `3px solid ${a?.color || "#555"}`,
            animation: i === 0 ? "fadeIn 0.5s ease" : undefined,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>{iconMap[e.event_type] || "📋"}</span>
              <span style={{ color: a?.color || "#888", fontWeight: 700, fontSize: 10 }}>{a?.name || e.agent_name}</span>
              <span style={{ color: "#444", fontSize: 9, marginLeft: "auto" }}>
                {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
              </span>
            </div>
            <div style={{ color: "#a0a0b0", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{e.title}</div>
          </div>
        );
      })}
      {events.length === 0 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: 20 }}>Waiting for activity...</div>}
    </div>
  );
}

// ── Mission Kanban Board ──
function MissionBoard({ missions, onExecute }: { missions: any[]; onExecute: (m: any) => void }) {
  const cols = [
    { status: "queued", label: "📋 Queued", color: "#6366f1" },
    { status: "in_progress", label: "⚡ In Progress", color: "#f59e0b" },
    { status: "completed", label: "✅ Completed", color: "#22c55e" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, height: "100%", overflow: "hidden" }}>
      {cols.map(col => {
        const items = missions.filter(m => {
          if (col.status === "queued") return m.status === "queued" || m.status === "planned";
          if (col.status === "in_progress") return m.status === "in_progress" || m.status === "executing";
          return m.status === "completed";
        });
        return (
          <div key={col.status} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ padding: "8px 12px", borderRadius: 10, background: `${col.color}12`, border: `1px solid ${col.color}25`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13 }}>{col.label}</span>
              <span style={{ marginLeft: "auto", background: `${col.color}20`, color: col.color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{items.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(m => {
                const a = AGENT_MAP[m.assigned_to] || AGENT_MAP.helix;
                return (
                  <div key={m.id} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(15,15,25,0.7)", backdropFilter: "blur(8px)", border: `1px solid ${a.color}15` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{a.emoji}</span>
                      <span style={{ color: "#d0d0e0", fontWeight: 600, fontSize: 12, flex: 1 }}>{m.title}</span>
                    </div>
                    {m.description && <div style={{ color: "#666", fontSize: 10, marginBottom: 6 }}>{m.description?.slice(0, 80)}</div>}
                    {col.status === "queued" && (
                      <button onClick={() => onExecute(m)} style={{
                        padding: "4px 12px", borderRadius: 8, border: "none",
                        background: `${a.color}20`, color: a.color, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}>▶ Execute</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CEO Command Desk ──
function CEOCommandDesk({ onChat }: { onChat: (agent: string) => void }) {
  const [commanding, setCommanding] = useState(false);
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState("");

  const executeCommand = async () => {
    if (!command.trim()) return;
    setCommanding(true);
    try {
      const r = await callAgent("snapsnap", `CEO DIRECTIVE: ${command}`, []);
      setResponse(r);
    } catch (e: any) { setResponse(`Error: ${e.message}`); }
    setCommanding(false);
  };

  return (
    <div style={{
      padding: 20, borderRadius: 18, position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(15,15,25,0.9))",
      border: "1px solid rgba(251,191,36,0.2)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #fbbf24, transparent)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #fbbf24, #f59e0b)", fontSize: 26 }}>👑</div>
        <div>
          <div style={{ color: "#fbbf24", fontWeight: 800, fontSize: 16 }}>CEO Command Desk</div>
          <div style={{ color: "#888", fontSize: 11 }}>SnapSnap v3.1 — Beast Mode + Opus Brain</div>
        </div>
        <div style={{ marginLeft: "auto" }}><GlowOrb color="#22c55e" size={10} pulse /><span style={{ color: "#22c55e", fontSize: 10, marginLeft: 6 }}>ACTIVE</span></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={e => e.key === "Enter" && executeCommand()}
          placeholder="Issue a CEO directive..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #fbbf2430", background: "rgba(10,10,16,0.8)", color: "#e8e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={executeCommand} disabled={commanding} style={{
          padding: "10px 20px", borderRadius: 10, border: "none",
          background: commanding ? "#333" : "linear-gradient(135deg, #fbbf24, #f59e0b)",
          color: "#000", fontWeight: 800, fontSize: 13, cursor: commanding ? "wait" : "pointer",
        }}>{commanding ? "⏳" : "⚡ Execute"}</button>
      </div>
      {response && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(10,10,16,0.6)", border: "1px solid #fbbf2415", color: "#c8c8d8", fontSize: 12, lineHeight: 1.6, maxHeight: 150, overflowY: "auto", whiteSpace: "pre-wrap" }}>
          <span style={{ color: "#fbbf24", fontWeight: 700 }}>SnapSnap:</span> {response}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        {["Morning Briefing", "Check Fleet Status", "Revenue Analysis", "Content Strategy"].map(q => (
          <button key={q} onClick={() => { setCommand(q); }} style={{
            padding: "5px 12px", borderRadius: 8, border: "1px solid #fbbf2420",
            background: "rgba(251,191,36,0.06)", color: "#fbbf24", fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          }}>{q}</button>
        ))}
      </div>
    </div>
  );
}

// ── Chat Panel ──
function ChatPanel({ agentKey, onClose }: { agentKey: string; onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const a = AGENT_MAP[agentKey] || AGENT_MAP.helix;

  useEffect(() => {
    const greetings: Record<string, string> = {
      snapsnap: "CEO SnapSnap online. All systems operational. What's the directive?",
      helix: "Helix here — ops coordinator. I keep the fleet aligned. What do you need?",
      scribe: "Hey! Scribe ready to craft. What content are we making today?",
      sentinel: "Sentinel monitoring. Markets are active. What should I analyze?",
      atlas: "Atlas, store ops. Conversion rates holding steady. What's up?",
      catalyst: "Catalyst here — growth metrics looking good. What lever should we pull?",
      nova: "Nova, research division. Latest peptide data loaded. How can I assist?",
    };
    setMessages([{ role: "assistant", content: greetings[agentKey] || "Ready." }]);
  }, [agentKey]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const reply = await callAgent(agentKey, userMsg, messages);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) { setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]); }
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, width: 420, height: "100vh", zIndex: 100,
      background: "rgba(10,10,16,0.95)", backdropFilter: "blur(20px)",
      borderLeft: `1px solid ${a.color}30`, display: "flex", flexDirection: "column",
      boxShadow: `-10px 0 40px rgba(0,0,0,0.5)`, animation: "slideIn 0.3s ease",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${a.color}20`, display: "flex", alignItems: "center", gap: 10, background: `${a.color}08` }}>
        <span style={{ fontSize: 24 }}>{a.emoji}</span>
        <div style={{ flex: 1 }}><div style={{ color: a.color, fontWeight: 800, fontSize: 14 }}>{a.name}</div><div style={{ color: "#666", fontSize: 10 }}>{a.role}</div></div>
        <GlowOrb color="#22c55e" size={8} pulse />
        <button onClick={onClose} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", padding: "10px 14px",
            borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: m.role === "user" ? "#2563eb" : `${a.color}12`,
            border: m.role === "user" ? "none" : `1px solid ${a.color}15`,
            color: "#e0e0e8", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
          }}>{m.content}</div>
        ))}
        {loading && <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 14, background: `${a.color}12`, color: "#888", fontSize: 13 }}>
          <span style={{ animation: "pulse 1.5s infinite" }}>{a.emoji} thinking...</span>
        </div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, borderTop: "1px solid #1a1a25", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`Message ${a.name}...`}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${a.color}20`, background: "rgba(10,10,16,0.8)", color: "#e8e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          padding: "10px 18px", borderRadius: 10, border: "none", background: loading ? "#333" : a.color,
          color: "#000", fontWeight: 800, fontSize: 13, cursor: loading ? "wait" : "pointer",
        }}>→</button>
      </div>
    </div>
  );
}

// ── Roundtable Panel ──
function RoundtableOverlay({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState("standup");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState(["helix", "scribe", "sentinel"]);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);

  const formats = [
    { id: "standup", label: "Daily Standup" }, { id: "strategy_session", label: "Strategy Session" },
    { id: "brainstorm", label: "Brainstorm" }, { id: "debate", label: "Debate" },
  ];

  const toggleAgent = (key: string) => setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const startRoundtable = async () => {
    if (selected.length < 2 || !topic.trim()) return;
    setRunning(true); setTranscript([]);
    const maxTurns = selected.length * 2;
    for (let i = 0; i < maxTurns; i++) {
      const agentKey = selected[i % selected.length];
      const a = AGENT_MAP[agentKey];
      const context = transcript.length > 0 ? `\nSo far:\n${transcript.map(t => `${t.name}: ${t.text}`).join("\n")}` : "";
      try {
        const text = await callAgent(agentKey, `Topic: ${topic}${context}\n\nIt's your turn.`, []);
        const turn = { agentKey, name: a.name, emoji: a.emoji, color: a.color, text, turn: i + 1 };
        setTranscript(prev => [...prev, turn]);
        transcript.push(turn);
        setProgress({ current: i + 1, total: maxTurns });
      } catch { break; }
      await new Promise(r => setTimeout(r, 300));
    }
    setRunning(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "90%", maxWidth: 800, maxHeight: "85vh", background: "rgba(12,12,20,0.95)", borderRadius: 20, border: "1px solid #6366f130", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a25", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔄</span>
          <div style={{ flex: 1, color: "#e0e0e8", fontWeight: 800, fontSize: 16 }}>Agent Roundtable</div>
          <button onClick={onClose} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {formats.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)} style={{
                padding: "6px 12px", borderRadius: 8, border: format === f.id ? "2px solid #6366f1" : "1px solid #2a2a35",
                background: format === f.id ? "#6366f115" : "transparent", color: format === f.id ? "#a5b4fc" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>{f.label}</button>
            ))}
          </div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Discussion topic..."
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a35", background: "#0d0d14", color: "#e8e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AGENT_DEFAULTS.filter(a => a.key !== "snapsnap").map(a => (
              <button key={a.key} onClick={() => toggleAgent(a.key)} style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 11,
                border: selected.includes(a.key) ? `2px solid ${a.color}` : "1px solid #2a2a35",
                background: selected.includes(a.key) ? `${a.color}15` : "transparent",
                color: selected.includes(a.key) ? a.color : "#555", cursor: "pointer", fontWeight: 600,
              }}>{a.emoji} {a.name}</button>
            ))}
          </div>
          <button onClick={startRoundtable} disabled={running || selected.length < 2 || !topic.trim()} style={{
            padding: "10px 0", borderRadius: 10, border: "none",
            background: running ? "#333" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontWeight: 800, fontSize: 13, cursor: running ? "wait" : "pointer",
          }}>{running ? `▶ Turn ${progress.current}/${progress.total}...` : "Start Roundtable"}</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {transcript.map((t, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: "#12121a", borderLeft: `3px solid ${t.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{t.emoji}</span>
                <span style={{ color: t.color, fontWeight: 700, fontSize: 11 }}>{t.name}</span>
                <span style={{ color: "#444", fontSize: 9, marginLeft: "auto" }}>Turn {t.turn}</span>
              </div>
              <div style={{ color: "#c0c0d0", fontSize: 12, lineHeight: 1.5 }}>{t.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ── Create Mission Modal ──
function CreateMissionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [assignee, setAssignee] = useState("helix"); const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const proposal = await sbInsert("ops_mission_proposals", {
        title: title.trim(), description: desc.trim(), proposed_by: assignee,
        status: "auto_approved", auto_approve_eligible: true, auto_approved_at: new Date().toISOString(),
        risk_level: "low", estimated_cost_usd: 0.05,
      });
      if (Array.isArray(proposal) && proposal[0]) {
        await sbInsert("ops_missions", {
          proposal_id: proposal[0].id, title: title.trim(), description: desc.trim(),
          assigned_to: assignee, status: "queued", total_steps: 1,
        });
      }
      onCreated(); onClose();
    } catch {}
    setCreating(false);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "90%", maxWidth: 500, padding: 24, borderRadius: 20, background: "rgba(12,12,20,0.95)", border: "1px solid #22c55e30" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div style={{ flex: 1, color: "#e0e0e8", fontWeight: 800, fontSize: 16 }}>New Mission</div>
          <button onClick={onClose} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mission title..."
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a35", background: "#0d0d14", color: "#e8e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." rows={3}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #2a2a35", background: "#0d0d14", color: "#e8e8f0", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "#888", fontSize: 11 }}>Assign:</span>
            {AGENT_DEFAULTS.map(a => (
              <button key={a.key} onClick={() => setAssignee(a.key)} style={{
                padding: "5px 10px", borderRadius: 8, fontSize: 11,
                border: assignee === a.key ? `2px solid ${a.color}` : "1px solid #2a2a35",
                background: assignee === a.key ? `${a.color}15` : "transparent",
                color: assignee === a.key ? a.color : "#555", cursor: "pointer", fontWeight: 600,
              }}>{a.emoji} {a.name}</button>
            ))}
          </div>
          <button onClick={create} disabled={!title.trim() || creating} style={{
            padding: "12px 0", borderRadius: 10, border: "none",
            background: creating ? "#333" : "linear-gradient(135deg, #22c55e, #10b981)",
            color: "#000", fontWeight: 800, fontSize: 14, cursor: creating ? "wait" : "pointer",
          }}>{creating ? "Creating..." : "🚀 Launch Mission"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Infrastructure Panel (migrated from old dashboard) ──
function InfraPanel() {
  const services = [
    { name: "WooCommerce VPS", host: "72.60.181.81", status: "online", cpu: "12%", mem: "62%", color: "#22c55e" },
    { name: "Agent VPS", host: "76.13.44.127", status: "online", cpu: "8%", mem: "45%", color: "#22c55e" },
    { name: "Supabase", host: "dmjsptyvcyiquokecbyx", status: "online", cpu: "—", mem: "—", color: "#22c55e" },
    { name: "Redis Cache", host: "WooCommerce VPS", status: "online", cpu: "—", mem: "18MB", color: "#22c55e" },
    { name: "Vercel Edge", host: "certapeptides-cc", status: "online", cpu: "—", mem: "—", color: "#22c55e" },
    { name: "Discord Bot", host: "PM2 snapsnap", status: "online", cpu: "2%", mem: "80MB", color: "#22c55e" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
      {services.map(s => (
        <div key={s.name} style={{
          padding: "14px 16px", borderRadius: 14,
          background: "rgba(15,15,25,0.8)", border: `1px solid ${s.color}20`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <GlowOrb color={s.color} size={8} pulse />
            <span style={{ color: "#d0d0e0", fontWeight: 700, fontSize: 12 }}>{s.name}</span>
          </div>
          <div style={{ color: "#555", fontSize: 9, marginBottom: 6 }}>{s.host}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div><span style={{ color: "#666", fontSize: 9 }}>CPU: </span><span style={{ color: "#c0c0d0", fontSize: 10, fontWeight: 600 }}>{s.cpu}</span></div>
            <div><span style={{ color: "#666", fontSize: 9 }}>MEM: </span><span style={{ color: "#c0c0d0", fontSize: 10, fontWeight: 600 }}>{s.mem}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ══════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════
export default function MissionControl() {
  const [agents, setAgents] = useState<Agent[]>(AGENT_DEFAULTS.map(a => ({ ...a })));
  const [events, setEvents] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [chatAgent, setChatAgent] = useState<string | null>(null);
  const [selectedSceneAgent, setSelectedSceneAgent] = useState<string | null>(null);
  const [showRoundtable, setShowRoundtable] = useState(false);
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [view, setView] = useState<"overview"|"missions"|"fleet"|"infra">("overview");
  const [time, setTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Data fetching — now includes agent status
  const loadData = useCallback(async () => {
    try {
      const [ev, mi, co, st, rels] = await Promise.all([
        sbFetch("ops_agent_events", "select=*&order=created_at.desc&limit=25"),
        sbFetch("ops_missions", "select=*&order=created_at.desc&limit=20"),
        sbFetch("ops_cost_log", `select=*&created_at=gte.${new Date(Date.now() - 86400000).toISOString()}&order=created_at.desc&limit=50`),
        sbFetch("ops_agent_status", "select=*"),
        sbFetch("ops_agent_relationships", "select=agent_a,agent_b,affinity"),
      ]);
      if (Array.isArray(ev)) setEvents(ev);
      if (Array.isArray(mi)) setMissions(mi);
      if (Array.isArray(co)) setCosts(co);
      if (Array.isArray(rels)) setRelationships(rels);

      // Update agents with live status + RPG stats from Supabase
      if (Array.isArray(st) && st.length > 0) {
        setAgents(prev => prev.map(agent => {
          const live = st.find((s: any) => s.agent_name === agent.key);
          if (live) {
            const updated = {
              ...agent,
              status: live.status as Agent["status"],
              xp: live.xp || agent.xp,
              level: live.level || agent.level,
              missions: live.missions_completed || agent.missions,
              currentTask: live.current_task || agent.currentTask,
              rpgClass: live.rpg_class || agent.rpgClass,
              vrl: live.vrl ?? agent.vrl,
              spd: live.spd ?? agent.spd,
              rch: live.rch ?? agent.rch,
              tru: live.tru ?? agent.tru,
              wis: live.wis ?? agent.wis,
              cre: live.cre ?? agent.cre,
            };
            AGENT_MAP[agent.key] = updated;
            return updated;
          }
          return agent;
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 8000);
    return () => clearInterval(id);
  }, [loadData]);

  // Derived stats
  const todayCost = costs.reduce((sum, c) => sum + (c.cost_usd || 0), 0);
  const activeMissions = missions.filter(m => m.status === "in_progress" || m.status === "executing").length;
  const completedMissions = missions.filter(m => m.status === "completed").length;
  const totalEvents24h = events.length;
  const onlineAgents = agents.filter(a => a.status === "online" || a.status === "busy").length;

  const executeMission = async (m: any) => {
    const a = AGENT_MAP[m.assigned_to] || AGENT_MAP.helix;
    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are ${a.name} ${a.emoji}, the ${a.role} for CertaPeptides. Execute this mission.`,
          messages: [{ role: "user", content: `Mission: ${m.title}\n${m.description || ""}\nProvide analysis and deliverables.` }],
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      const result = data.content?.[0]?.text || "Done.";
      await sbInsert("ops_agent_events", {
        event_type: "mission_completed", agent_name: m.assigned_to || "helix",
        mission_id: m.id, title: `Completed: ${m.title}`,
        description: result.slice(0, 500), impact_score: 0.7,
      }).catch(() => {});
      loadData();
    } catch {}
  };

  const openChat = (key: string) => { setChatAgent(key); setSelectedSceneAgent(null); };
  const selectedAgent = selectedSceneAgent ? agents.find(a => a.key === selectedSceneAgent) || null : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(251,191,36,0.04) 0%, transparent 50%), #07070c",
      color: "#e8e8f0",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(251,191,36,0.3); } 50% { box-shadow: 0 0 20px rgba(251,191,36,0.6); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
      `}</style>

      {/* CRT scanline overlay — full page */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40, opacity: 0.025,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 4px)",
      }} />

      {/* ─── HEADER ─── */}
      <div style={{
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
        borderBottom: "1px solid #ffffff08",
        background: "rgba(10,10,16,0.8)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 900, color: "#000", animation: "glow 3s infinite",
        }}>C</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.5, color: "#fbbf24" }}>CertaPeptides</div>
          <div style={{ color: "#444", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" }}>Mission Control v4.0 — RPG Edition</div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 4, marginLeft: 30 }}>
          {[
            { id: "overview" as const, label: "⚡ Overview" },
            { id: "missions" as const, label: "🎯 Missions" },
            { id: "fleet" as const, label: "🤖 Fleet" },
            { id: "infra" as const, label: "🔧 Infra" },
          ].map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              padding: "6px 14px", borderRadius: 8,
              border: view === n.id ? "1px solid #fbbf2430" : "1px solid transparent",
              background: view === n.id ? "#fbbf2410" : "transparent",
              color: view === n.id ? "#fbbf24" : "#666", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>{n.label}</button>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowRoundtable(true)} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #6366f130",
            background: "#6366f110", color: "#6366f1", fontSize: 10, fontWeight: 700, cursor: "pointer",
          }}>🔄 Roundtable</button>
          <button onClick={() => setShowCreateMission(true)} style={{
            padding: "6px 14px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #22c55e, #10b981)",
            color: "#000", fontSize: 10, fontWeight: 800, cursor: "pointer",
          }}>+ New Mission</button>
          <div style={{ color: "#555", fontSize: 11, borderLeft: "1px solid #1a1a25", paddingLeft: 12, marginLeft: 4 }}>
            <div style={{ color: "#888", fontSize: 10 }}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── STAT BAR ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatCard label="Active Missions" value={activeMissions} icon="🎯" color="#f59e0b" sub={`${completedMissions} completed`} />
          <StatCard label="Fleet Agents" value={`${onlineAgents}/${agents.length}`} icon="🤖" color="#22c55e" sub="Online / Total" />
          <StatCard label="Events (24h)" value={totalEvents24h} icon="⚡" color="#6366f1" sub="Auto-refreshing" />
          <StatCard label="Today's Cost" value={`$${todayCost.toFixed(3)}`} icon="💰" color="#fbbf24" sub="$10/day budget" />
          <StatCard label="LLM Brain" value="Opus 4.6" icon="🧠" color="#8b5cf6" sub="+ Kimi K2.5 fallback" />
        </div>

        {/* ── VIEW: OVERVIEW ── */}
        {view === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            {/* Left col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* ★ VISUAL COMMAND CENTER SCENE ★ */}
              <CommandCenterScene
                agents={agents}
                onAgentClick={(key) => setSelectedSceneAgent(selectedSceneAgent === key ? null : key)}
                selectedAgent={selectedSceneAgent}
              />

              {/* Agent Detail Panel — shows when agent clicked in scene */}
              {selectedAgent && (
                <AgentDetailPanel
                  agent={selectedAgent}
                  events={events}
                  relationships={relationships}
                  onChat={() => openChat(selectedAgent.key)}
                  onClose={() => setSelectedSceneAgent(null)}
                />
              )}

              {/* CEO Command Desk */}
              <CEOCommandDesk onChat={setChatAgent} />

              {/* Mission Board preview */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>Active Missions</span>
                  <button onClick={() => setView("missions")} style={{
                    marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
                    border: "1px solid #333", background: "transparent", color: "#888", fontSize: 10, cursor: "pointer",
                  }}>View All →</button>
                </div>
                <div style={{ maxHeight: 300 }}>
                  <MissionBoard missions={missions.slice(0, 9)} onExecute={executeMission} />
                </div>
              </div>
            </div>

            {/* Right col — Activity Feed */}
            <div style={{
              padding: 16, borderRadius: 16,
              background: "rgba(12,12,20,0.6)", backdropFilter: "blur(10px)",
              border: "1px solid #ffffff08",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>📡</span>
                <span style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>Live Activity</span>
                <div style={{ marginLeft: "auto" }}>
                  <GlowOrb color="#22c55e" size={6} pulse />
                  <span style={{ color: "#22c55e", fontSize: 9, marginLeft: 4 }}>LIVE</span>
                </div>
              </div>
              <ActivityTicker events={events} />
            </div>
          </div>
        )}

        {/* ── VIEW: MISSIONS ── */}
        {view === "missions" && (
          <div style={{ height: "calc(100vh - 200px)" }}>
            <MissionBoard missions={missions} onExecute={executeMission} />
          </div>
        )}

        {/* ── VIEW: FLEET ── */}
        {view === "fleet" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {agents.map(a => {
              const rpgCls = RPG_CLASSES[a.rpgClass] || RPG_CLASSES.Recruit;
              const relevantStats = RELEVANT_STATS[a.key] || ["TRU", "SPD", "WIS", "CRE"];
              const agentRels = relationships.filter(r => r.agent_a === a.key || r.agent_b === a.key).map(r => {
                const otherKey = r.agent_a === a.key ? r.agent_b : r.agent_a;
                const other = AGENT_MAP[otherKey];
                return { key: otherKey, emoji: other?.emoji || "?", affinity: r.affinity };
              }).sort((x, y) => y.affinity - x.affinity);
              return (
                <div key={a.key} style={{
                  padding: 20, borderRadius: 18, position: "relative", overflow: "hidden",
                  background: "rgba(15,15,25,0.7)", backdropFilter: "blur(12px)",
                  border: `1px solid ${a.color}20`,
                }}>
                  {/* CRT scanline overlay */}
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 4px)", zIndex: 1 }} />
                  <div style={{ position: "relative", zIndex: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
                        background: `linear-gradient(135deg, ${a.color}30, ${a.color}10)`,
                        border: `2px solid ${a.color}40`, fontSize: 28,
                      }}>{a.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: a.color, fontWeight: 800, fontSize: 16 }}>{a.name}</span>
                          <span style={{ padding: "2px 6px", borderRadius: 4, background: `${rpgCls.color}15`, color: rpgCls.color, fontSize: 8, fontWeight: 700 }}>{rpgCls.icon} {a.rpgClass}</span>
                        </div>
                        <div style={{ color: "#888", fontSize: 10 }}>{a.role}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <GlowOrb color={a.status === "online" ? "#22c55e" : a.status === "busy" ? "#f59e0b" : "#6366f1"} size={8} />
                          <span style={{ color: "#888", fontSize: 10, textTransform: "uppercase" }}>{a.status}</span>
                        </div>
                        <span style={{ color: "#fbbf24", fontSize: 10, marginTop: 2 }}>★ LV.{a.level}</span>
                      </div>
                    </div>
                    {/* Current task */}
                    <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(10,10,16,0.5)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: a.color, fontSize: 9, fontWeight: 700 }}>TASK:</span>
                      <span style={{ color: "#a0a0b0", fontSize: 10 }}>{a.currentTask}</span>
                    </div>
                    {/* RPG Stat bars */}
                    <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(10,10,16,0.4)", display: "flex", flexDirection: "column", gap: 5 }}>
                      {relevantStats.map(stat => (
                        <RpgStatBar key={stat} stat={stat} value={(a as any)[stat.toLowerCase()] || 0} />
                      ))}
                    </div>
                    {/* XP bar + missions */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#666", fontSize: 9 }}>XP: {a.xp.toLocaleString()}</span>
                        <span style={{ color: "#666", fontSize: 9 }}>{a.missions} missions</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "#1a1a25", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${(a.xp % 1000) / 10}%`, background: `linear-gradient(90deg, ${a.color}, ${a.color}80)` }} />
                      </div>
                    </div>
                    {/* Bonds */}
                    {agentRels.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                        <span style={{ color: "#555", fontSize: 8, width: "100%", marginBottom: 2 }}>BONDS</span>
                        {agentRels.slice(0, 6).map(r => {
                          const affColor = r.affinity >= 0.7 ? "#22c55e" : r.affinity >= 0.5 ? "#f59e0b" : "#ef4444";
                          return (
                            <span key={r.key} style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "1px 5px", borderRadius: 4, background: `${affColor}08`, border: `1px solid ${affColor}15`, fontSize: 9 }}>
                              {r.emoji}<span style={{ color: affColor, fontWeight: 700 }}>{(r.affinity * 100).toFixed(0)}%</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => setChatAgent(a.key)} style={{
                      width: "100%", padding: "8px 0", borderRadius: 10,
                      border: `1px solid ${a.color}30`, background: `${a.color}10`,
                      color: a.color, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>💬 Chat with {a.name}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── VIEW: INFRASTRUCTURE ── */}
        {view === "infra" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>System Infrastructure</div>
            <InfraPanel />
            <div style={{ color: "#888", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 8 }}>System Architecture</div>
            <div style={{ padding: 16, borderRadius: 14, background: "rgba(15,15,25,0.8)", border: "1px solid #ffffff08" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(10,10,16,0.6)", border: "1px solid #fbbf2415" }}>
                  <div style={{ color: "#fbbf24", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>🧠 LLM Stack</div>
                  <div style={{ color: "#888", fontSize: 10, lineHeight: 1.6 }}>
                    Primary: Claude Opus 4.6<br/>Dashboard: Sonnet 4.5<br/>Fallback: Kimi K2.5<br/>Router: 7-route strategic
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(10,10,16,0.6)", border: "1px solid #6366f115" }}>
                  <div style={{ color: "#6366f1", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>💾 Data Layer</div>
                  <div style={{ color: "#888", fontSize: 10, lineHeight: 1.6 }}>
                    Database: Supabase<br/>Cache: Redis<br/>State: PM2 + Redis<br/>Logs: ops_agent_events
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(10,10,16,0.6)", border: "1px solid #22c55e15" }}>
                  <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>🌐 Channels</div>
                  <div style={{ color: "#888", fontSize: 10, lineHeight: 1.6 }}>
                    Discord: Fleet webhooks<br/>WordPress: WooCommerce<br/>Dashboard: Vercel Edge<br/>API: MCP Bridge
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── OVERLAYS ─── */}
      {chatAgent && <ChatPanel agentKey={chatAgent} onClose={() => setChatAgent(null)} />}
      {showRoundtable && <RoundtableOverlay onClose={() => setShowRoundtable(false)} />}
      {showCreateMission && <CreateMissionModal onClose={() => setShowCreateMission(false)} onCreated={loadData} />}
    </div>
  );
}
