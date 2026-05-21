import { useState, useRef, useEffect } from "react";

export default function CalculusTutor() {
  const [graph, setGraph] = useState(null);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [graphError, setGraphError] = useState(null);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load graph from storage on mount
  useEffect(() => {
    async function load() {
      try {
        const stored = await window.storage.get("calculus_graph");
        if (stored && stored.value) {
          const parsed = JSON.parse(stored.value);
          setGraph(parsed);
        }
      } catch (e) {
        // No stored graph yet
      }
      setLoadingGraph(false);
    }
    load();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileUpload(file) {
    if (!file) return;
    setLoadingGraph(true);
    setGraphError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.concepts || !parsed.edges) {
        throw new Error("File must contain 'concepts' and 'edges' fields");
      }
      await window.storage.set("calculus_graph", text);
      setGraph(parsed);
    } catch (e) {
      setGraphError(e.message);
    }
    setLoadingGraph(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function clearGraph() {
    if (confirm("Clear stored graph? You'll need to re-upload.")) {
      window.storage.delete("calculus_graph");
      setGraph(null);
      setMessages([]);
    }
  }

  // ---------- LLM call to Claude ----------
  async function askClaude(userQuestion, conceptContext) {
    const systemPrompt = `You are a Socratic calculus tutor. You NEVER give direct answers or solve problems. Instead, you guide students to figure it out themselves using the knowledge graph context provided.

Your job:
1. Acknowledge what they're stuck on
2. Reference the prerequisite concepts they should think about (from the graph context)
3. Ask a leading question or give a conceptual nudge
4. Be warm and encouraging — like a peer tutor, not a textbook

Keep responses SHORT (3-5 sentences max). Use the hints from the graph naturally.`;

    const userPrompt = `Student question: "${userQuestion}"

Relevant concept from knowledge graph: ${conceptContext.name}
Description: ${conceptContext.description}
Hint: ${conceptContext.hint}

Prerequisites (concepts the student may need to review first):
${conceptContext.prereqs.map(p => `- ${p.name}: ${p.hint}`).join("\n")}

Related concepts (could spark insight):
${conceptContext.related.map(r => `- ${r.name}`).join("\n")}

Guide the student WITHOUT solving the problem. Reference 1-2 specific prereq/related concepts that would help.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await response.json();
    return data.content.map(c => c.type === "text" ? c.text : "").join("");
  }

  // ---------- Use Claude to ROUTE the question to a concept ----------
  async function routeToConcept(userQuestion, conceptNames) {
    // Truncate concept list if it's huge
    const conceptList = conceptNames.slice(0, 500).join(", ");
    const systemPrompt = `You match student calculus questions to the most relevant concept from a list. Reply with ONLY the exact concept name from the list, nothing else. If no concept matches, reply with "NONE".`;
    const userPrompt = `Student question: "${userQuestion}"

Available concepts (pick the single MOST relevant one):
${conceptList}

Reply with ONLY the exact concept name, no explanation.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 80,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await response.json();
    const text = data.content.map(c => c.type === "text" ? c.text : "").join("").trim();
    return text;
  }

  // ---------- Graph helpers ----------
  function getPrereqs(conceptName) {
    if (!graph) return [];
    return graph.edges
      .filter(e => (e.target === conceptName || e.t === conceptName) && (e.type === "prerequisite" || e.ty === "prerequisite"))
      .map(e => {
        const srcName = e.source || e.s;
        const c = graph.concepts[srcName];
        return c ? { name: srcName, hint: c.hint || c.h || "", description: c.description || c.d || "", volume: c.volume || c.v, chapter: c.chapter || c.c } : null;
      })
      .filter(Boolean);
  }

  function getRelated(conceptName) {
    if (!graph) return [];
    const out = [];
    graph.edges.forEach(e => {
      const src = e.source || e.s;
      const tgt = e.target || e.t;
      const ty = e.type || e.ty;
      if (ty === "related_to" || ty === "uses") {
        if (src === conceptName) {
          const c = graph.concepts[tgt];
          if (c) out.push({ name: tgt, hint: c.hint || c.h || "", description: c.description || c.d || "" });
        } else if (tgt === conceptName) {
          const c = graph.concepts[src];
          if (c) out.push({ name: src, hint: c.hint || c.h || "", description: c.description || c.d || "" });
        }
      }
    });
    return out.slice(0, 5);
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!query.trim() || loading || !graph) return;

    const userMsg = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      // Step 1: Route the question to a concept using Claude
      const conceptNames = Object.keys(graph.concepts);
      const matchedConcept = await routeToConcept(userMsg, conceptNames);

      if (matchedConcept === "NONE" || !graph.concepts[matchedConcept]) {
        // Try fuzzy match
        const lower = matchedConcept.toLowerCase();
        const fuzzy = conceptNames.find(n => n.toLowerCase() === lower)
          || conceptNames.find(n => n.toLowerCase().includes(lower) || lower.includes(n.toLowerCase()));
        if (fuzzy && graph.concepts[fuzzy]) {
          await handleMatchedConcept(userMsg, fuzzy);
        } else {
          setMessages(prev => [...prev, {
            role: "tutor",
            text: "Hmm, I couldn't figure out which calculus concept you're asking about. Could you be more specific? Try mentioning a specific topic like 'chain rule', 'integration by parts', or 'limits at infinity'.",
          }]);
        }
      } else {
        await handleMatchedConcept(userMsg, matchedConcept);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "tutor",
        text: `Something went wrong: ${err.message}. Try again?`,
      }]);
    }
    setLoading(false);
  }

  async function handleMatchedConcept(userMsg, conceptName) {
    const concept = graph.concepts[conceptName];
    const prereqs = getPrereqs(conceptName);
    const related = getRelated(conceptName);

    // Step 2: Get Socratic guidance from Claude
    const guidance = await askClaude(userMsg, {
      name: conceptName,
      description: concept.description || concept.d || "",
      hint: concept.hint || concept.h || "",
      prereqs: prereqs.slice(0, 3),
      related: related.slice(0, 3),
    });

    setMessages(prev => [...prev, {
      role: "tutor",
      concept: conceptName,
      conceptData: concept,
      prereqs,
      related,
      guidance,
    }]);
  }

  function handleConceptClick(name) {
    if (!graph.concepts[name]) return;
    setQuery(`Tell me about ${name}`);
    setTimeout(() => handleSubmit(), 50);
  }

  const sampleQuestions = [
    "I'm stuck on the chain rule",
    "How do I find the volume of a rotated solid?",
    "When do I use L'Hopital's rule?",
    "What's a Taylor series for?",
    "Help me with related rates",
  ];

  // ============================================================
  // Render
  // ============================================================
  if (loadingGraph) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
        Loading...
      </div>
    );
  }

  if (!graph) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif", padding: 24 }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 600, margin: "60px auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed 0%, #0891b2 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700,
            }}>∇</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Calculus Navigator</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Knowledge-graph powered Socratic tutoring</div>
            </div>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#7c3aed" : "rgba(255,255,255,0.2)"}`,
              background: dragOver ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.02)",
              borderRadius: 16,
              padding: 48, textAlign: "center", cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
              Drop your knowledge graph JSON here
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              or click to browse — should be the <code>all_calculus_graph.json</code> file
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }}
            onChange={e => handleFileUpload(e.target.files[0])} />

          {graphError && (
            <div style={{ marginTop: 12, padding: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 13, color: "#fca5a5" }}>
              {graphError}
            </div>
          )}

          <div style={{ marginTop: 24, fontSize: 12, color: "#64748b", textAlign: "center" }}>
            The graph is stored locally so you only need to upload once.
          </div>
        </div>
      </div>
    );
  }

  const conceptCount = Object.keys(graph.concepts).length;
  const edgeCount = graph.edges.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", color: "#e2e8f0", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(15,20,35,1), rgba(10,14,23,1))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #7c3aed, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>∇</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>Calculus Navigator</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{conceptCount} concepts · {edgeCount} edges</div>
            </div>
          </div>
          <button onClick={clearGraph} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>Reset</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 120px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>∫</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>What are you stuck on?</div>
            <div style={{ fontSize: 13, color: "#64748b", maxWidth: 380, margin: "0 auto 20px" }}>
              I won't solve it — but I'll show you what to think about and ask the right questions.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
              {sampleQuestions.map((q, i) => (
                <button key={i} onClick={() => { setQuery(q); setTimeout(handleSubmit, 50); }}
                  style={{ padding: "7px 13px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#94a3b8", fontSize: 12.5, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(124,58,237,0.15)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; e.currentTarget.style.color = "#c4b5fd"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#94a3b8"; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "14px 14px 4px 14px", padding: "9px 14px", maxWidth: "78%", fontSize: 13.5, lineHeight: 1.5 }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.text) {
            return (
              <div key={i} style={{ maxWidth: "85%" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px 14px 14px 4px", padding: "11px 15px", fontSize: 13.5, lineHeight: 1.6 }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          const c = msg.conceptData;
          const desc = c?.description || c?.d || "";
          const hint = c?.hint || c?.h || "";
          const vol = c?.volume || c?.v || "";
          const chap = c?.chapter || c?.c || "";

          return (
            <div key={i} style={{ maxWidth: "100%" }}>
              {/* Socratic guidance from Claude */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px 14px 14px 4px", padding: "13px 16px", fontSize: 13.5, lineHeight: 1.6, marginBottom: 10 }}>
                {msg.guidance}
              </div>

              {/* Concept card */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginBottom: 8, borderLeft: "3px solid #7c3aed" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  V{vol} · {chap}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>{msg.concept}</div>
                {desc && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 10 }}>{desc}</div>}
                {hint && (
                  <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 9, padding: "9px 12px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>💡 Hint</div>
                    <div style={{ fontSize: 13, color: "#c4b5fd", lineHeight: 1.5 }}>{hint}</div>
                  </div>
                )}
              </div>

              {/* Prereqs */}
              {msg.prereqs?.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 11, padding: 14, marginBottom: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#f59e0b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>← Review these first</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {msg.prereqs.slice(0, 5).map((p, j) => (
                      <button key={j} onClick={() => handleConceptClick(p.name)} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 7, padding: "7px 11px", cursor: "pointer", textAlign: "left", color: "#e2e8f0", transition: "all 0.15s", width: "100%" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.06)"; }}
                      >
                        <span style={{ fontSize: 13, color: "#f59e0b", flexShrink: 0, marginTop: 1 }}>←</span>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.name}</div>
                          {p.hint && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{p.hint}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Related */}
              {msg.related?.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 11, padding: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8b5cf6", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>↔ Related</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {msg.related.slice(0, 5).map((r, j) => (
                      <button key={j} onClick={() => handleConceptClick(r.name)} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 7, padding: "7px 11px", cursor: "pointer", textAlign: "left", color: "#e2e8f0", transition: "all 0.15s", width: "100%" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.06)"; }}
                      >
                        <span style={{ fontSize: 13, color: "#8b5cf6", flexShrink: 0, marginTop: 1 }}>↔</span>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                          {r.hint && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>{r.hint}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "8px 0", alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
            <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "10px 16px 14px", background: "linear-gradient(180deg, transparent, #0a0e17 30%)" }}>
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 13, padding: "4px 4px 4px 15px", alignItems: "center" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
            placeholder="What are you stuck on?"
            disabled={loading}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13.5, fontFamily: "'DM Sans', system-ui, sans-serif" }}
          />
          <button onClick={handleSubmit} disabled={!query.trim() || loading} style={{
            padding: "7px 15px", borderRadius: 9,
            background: query.trim() && !loading ? "linear-gradient(135deg, #7c3aed, #0891b2)" : "rgba(255,255,255,0.05)",
            border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: query.trim() && !loading ? "pointer" : "default",
            opacity: query.trim() && !loading ? 1 : 0.4,
          }}>Ask</button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-7px); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}
