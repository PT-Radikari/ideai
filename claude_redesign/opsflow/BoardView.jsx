// OpsFlow — Board View (Kanban + Detail Panel)

function priorityColor(p) {
  return p === "High" ? "var(--high)" : p === "Medium" ? "var(--medium)" : "var(--low)";
}

function Chip({ children, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "0.28rem 0.65rem",
      borderRadius: 999, fontSize: "0.78rem", fontWeight: 700,
      background: "var(--accent-soft)", color: "var(--accent-strong)", ...style
    }}>{children}</span>
  );
}

function TicketCard({ ticket, selected, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "1rem", textAlign: "left", cursor: "pointer",
        border: selected ? "1px solid var(--accent)" : "1px solid rgba(20,33,44,0.08)",
        outline: selected ? "2px solid rgba(15,118,110,0.18)" : "none",
        borderRadius: 22,
        background: "linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,242,233,0.88))",
        boxShadow: hovered ? "0 18px 36px rgba(20,33,44,0.1)" : "0 12px 30px rgba(20,33,44,0.08)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "all 160ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Chip>{ticket.code}</Chip>
        <span style={{ padding: "0.28rem 0.65rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, color: "#fff", background: priorityColor(ticket.priority) }}>{ticket.priority}</span>
      </div>
      <h4 style={{ fontFamily: "var(--serif)", fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px", color: "var(--ink)" }}>{ticket.title}</h4>
      <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 6px" }}>{ticket.division} · {ticket.service}</p>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.5, color: "var(--ink)", margin: "0 0 10px" }}>{ticket.requestDetail.slice(0, 100)}{ticket.requestDetail.length > 100 ? "…" : ""}</p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--muted)" }}>
        <span>{ticket.requester}</span>
        <span>{ticket.attachments} attachment{ticket.attachments !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

function DetailPanel({ ticket, tickets, onStageChange, onAddNote }) {
  const [note, setNote] = React.useState("");

  React.useEffect(() => setNote(""), [ticket?.id]);

  const S = {
    panel: {
      position: "sticky", top: "1rem", minHeight: 520, padding: "1.4rem",
      border: "1px solid var(--line)", borderRadius: 30,
      background: "linear-gradient(180deg,rgba(255,252,247,0.94),rgba(245,238,226,0.82))",
      backdropFilter: "blur(12px)", boxShadow: "var(--shadow)",
    },
    section: { display: "grid", gap: "0.55rem", borderBottom: "1px solid var(--line)", paddingBottom: "1rem" },
    detailCard: { padding: "0.9rem", borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(20,33,44,0.08)" },
    actionBtn: { padding: "0.8rem 1.1rem", color: "var(--ink)", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(24,34,47,0.12)", borderRadius: 999, cursor: "pointer", fontSize: "0.9rem" },
    primaryBtn: { padding: "0.95rem 1.4rem", color: "#f8fffd", background: "linear-gradient(135deg,var(--accent-strong),var(--accent))", border: "none", borderRadius: 999, fontWeight: 600, boxShadow: "0 12px 22px rgba(10,92,85,0.22)", cursor: "pointer", width: "100%" },
    select: { padding: "0.8rem 1.1rem", color: "var(--ink)", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(24,34,47,0.12)", borderRadius: 999, fontSize: "0.9rem", flex: 1 },
    textarea: { width: "100%", padding: "0.9rem 1rem", color: "var(--ink)", border: "1px solid rgba(20,33,44,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.9)", resize: "vertical", minHeight: 90, outline: "none", fontFamily: "var(--sans)", fontSize: "0.9rem" },
    activityItem: { padding: "0.85rem", borderLeft: "3px solid var(--accent)", background: "rgba(255,255,255,0.72)", borderRadius: "0 12px 12px 0" },
  };

  if (!ticket) return (
    <aside style={S.panel}>
      <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6, margin: "0 0 6px" }}>Ticket Detail</p>
      <h4 style={{ fontFamily: "var(--serif)", fontSize: "1.25rem", margin: "0 0 8px" }}>Select a card</h4>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Open any ticket to review the request detail, attachments, activity, and next-stage actions.</p>
    </aside>
  );

  const stageIdx = STAGES.indexOf(ticket.stage);

  function submitNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(ticket.id, note.trim());
    setNote("");
  }

  return (
    <aside style={S.panel}>
      <div style={{ display: "grid", gap: "1rem", overflowY: "auto", maxHeight: "calc(100vh - 4rem)" }}>
        <div style={S.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Chip>{ticket.code}</Chip>
            <span style={{ padding: "0.28rem 0.65rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700, color: "#fff", background: priorityColor(ticket.priority) }}>{ticket.priority}</span>
          </div>
          <h4 style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{ticket.title}</h4>
          <p style={{ color: "var(--muted)" }}>{ticket.division} · {ticket.service}</p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button style={{ ...S.actionBtn, opacity: stageIdx === 0 ? 0.4 : 1 }} disabled={stageIdx === 0} onClick={() => onStageChange(ticket.id, STAGES[stageIdx - 1])}>← Back</button>
          <select style={S.select} value={ticket.stage} onChange={e => onStageChange(ticket.id, e.target.value)}>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button style={{ ...S.actionBtn, opacity: stageIdx === STAGES.length - 1 ? 0.4 : 1 }} disabled={stageIdx === STAGES.length - 1} onClick={() => onStageChange(ticket.id, STAGES[stageIdx + 1])}>Next →</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <div style={S.detailCard}><strong style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>Requester</strong><span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{ticket.requester}</span></div>
          <div style={S.detailCard}><strong style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>Created</strong><span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{formatDate(ticket.createdAt)}</span></div>
        </div>

        <div style={S.section}>
          <Chip>Current process</Chip>
          <p style={{ lineHeight: 1.6, fontSize: "0.92rem" }}>{ticket.currentProcess}</p>
        </div>

        <div style={S.section}>
          <Chip>Optimization request</Chip>
          <p style={{ lineHeight: 1.6, fontSize: "0.92rem" }}>{ticket.requestDetail}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
          <div style={S.detailCard}><strong style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>Business impact</strong><span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{ticket.businessImpact}</span></div>
          <div style={S.detailCard}><strong style={{ display: "block", marginBottom: 4, fontSize: "0.85rem" }}>Success metric</strong><span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{ticket.successMetric}</span></div>
        </div>

        <div>
          <Chip style={{ marginBottom: 10 }}>Activity</Chip>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: 10 }}>
            {ticket.activity.map((item, i) => (
              <div key={i} style={S.activityItem}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong style={{ fontSize: "0.9rem" }}>{item.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{formatDate(item.createdAt)}</span>
                </div>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Chip style={{ marginBottom: 10 }}>Add update</Chip>
          <form style={{ display: "grid", gap: "0.75rem", marginTop: 10 }} onSubmit={submitNote}>
            <textarea style={S.textarea} value={note} onChange={e => setNote(e.target.value)} placeholder="Add review notes, testing findings, revision request, or deployment update." />
            <button style={S.primaryBtn} type="submit">Save Update</button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function BoardView({ tickets, selectedId, setSelectedId, onStageChange, onAddNote }) {
  const [search, setSearch] = React.useState("");
  const [divFilter, setDivFilter] = React.useState("");
  const [priFilter, setPriFilter] = React.useState("");

  const divisions = [...new Set(tickets.map(t => t.division))].sort();
  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || [t.title, t.division, t.service, t.requestDetail, t.requester].join(" ").toLowerCase().includes(q);
    return matchQ && (!divFilter || t.division === divFilter) && (!priFilter || t.priority === priFilter);
  });

  const selected = tickets.find(t => t.id === selectedId) || null;

  const S = {
    toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" },
    eyebrow: { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6, margin: "0 0 4px" },
    h3: { fontFamily: "var(--serif)", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em" },
    filterInput: { padding: "0.75rem 1rem", border: "1px solid rgba(20,33,44,0.14)", borderRadius: 999, background: "rgba(255,255,255,0.88)", color: "var(--ink)", outline: "none", fontSize: "0.92rem", minWidth: 200 },
    layout: { display: "grid", gridTemplateColumns: "1fr 360px", gap: "1rem", alignItems: "start" },
    board: { display: "grid", gridTemplateColumns: "repeat(6, minmax(220px,1fr))", gap: "1rem", overflowX: "auto", paddingBottom: "0.5rem" },
    column: {
      minHeight: 520, padding: "1rem",
      border: "1px solid var(--line)", borderRadius: 30,
      background: "linear-gradient(180deg,rgba(255,252,247,0.92),rgba(248,242,232,0.72))",
      backdropFilter: "blur(12px)", boxShadow: "var(--shadow)",
    },
    colHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
    colCount: { display: "inline-flex", minWidth: "2rem", justifyContent: "center", padding: "0.25rem 0.65rem", borderRadius: 999, color: "var(--accent-strong)", background: "var(--accent-soft)", fontSize: "0.8rem", fontWeight: 700 },
    empty: { padding: "1rem", border: "1px dashed rgba(24,34,47,0.18)", borderRadius: 22, color: "var(--muted)", textAlign: "center", fontSize: "0.88rem" },
  };

  return (
    <div>
      <div style={S.toolbar}>
        <div>
          <p style={S.eyebrow}>Shared Board</p>
          <h3 style={S.h3}>Optimization request kanban</h3>
        </div>
        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <input style={S.filterInput} placeholder="Search title, division, service…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={S.filterInput} value={divFilter} onChange={e => setDivFilter(e.target.value)}>
            <option value="">All divisions</option>
            {divisions.map(d => <option key={d}>{d}</option>)}
          </select>
          <select style={S.filterInput} value={priFilter} onChange={e => setPriFilter(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={S.layout}>
        <div style={S.board}>
          {STAGES.map(stage => {
            const cols = filtered.filter(t => t.stage === stage);
            return (
              <section key={stage} style={S.column}>
                <div style={S.colHeader}>
                  <h4 style={{ fontFamily: "var(--serif)", fontSize: "0.95rem", fontWeight: 700 }}>{stage}</h4>
                  <span style={S.colCount}>{cols.length}</span>
                </div>
                <div style={{ display: "grid", gap: "0.8rem" }}>
                  {cols.length === 0
                    ? <div style={S.empty}>No tickets in this stage.</div>
                    : cols.map(t => <TicketCard key={t.id} ticket={t} selected={t.id === selectedId} onClick={() => setSelectedId(t.id)} />)
                  }
                </div>
              </section>
            );
          })}
        </div>
        <DetailPanel ticket={selected} tickets={tickets} onStageChange={onStageChange} onAddNote={onAddNote} />
      </div>
    </div>
  );
}

Object.assign(window, { BoardView });
