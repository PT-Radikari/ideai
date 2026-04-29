// OpsFlow — Intake View

function IntakeView({ onCreateTicket }) {
  const [form, setForm] = React.useState({
    title: "", division: "", service: "", requester: "",
    priority: "Medium", currentProcess: "", requestDetail: "",
    businessImpact: "", successMetric: "", notes: "",
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onCreateTicket({
      id: crypto.randomUUID(), code: buildCode(),
      stage: STAGES[0], ...form, attachments: 0,
      createdAt: new Date().toISOString(),
      activity: [{ title: "Ticket created", detail: "Request entered through the guided intake channel.", createdAt: new Date().toISOString() }],
    });
  }

  const S = {
    root: { display: "flex", flexDirection: "column", gap: "1rem" },
    heroGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "1rem" },
    heroCard: {
      padding: "1.5rem", border: "1px solid var(--line)", borderRadius: 30,
      background: "var(--panel)", backdropFilter: "blur(12px)", boxShadow: "var(--shadow)",
    },
    heroCardAccent: {
      padding: "1.5rem", border: "1px solid var(--line)", borderRadius: 30,
      boxShadow: "var(--shadow)", color: "#f7fffd",
      background: "radial-gradient(circle at top right,rgba(244,191,102,0.3),transparent 30%), linear-gradient(135deg,rgba(12,60,56,0.98),rgba(14,110,97,0.88))",
    },
    eyebrow: { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.72, marginBottom: "0.35rem" },
    h3: { fontFamily: "var(--serif)", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 0.6rem" },
    chipRow: { display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "1.15rem" },
    chip: { padding: "0.42rem 0.75rem", fontSize: "0.82rem", fontWeight: 700, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#f7fffd" },
    heroNote: { marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: 18, color: "var(--ink)", background: "linear-gradient(180deg,rgba(13,138,124,0.08),rgba(255,255,255,0.58))", border: "1px solid rgba(13,138,124,0.12)" },
    formPanel: { padding: "1.5rem", border: "1px solid var(--line)", borderRadius: 30, background: "var(--panel)", backdropFilter: "blur(12px)", boxShadow: "var(--shadow)" },
    panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
    label: { display: "grid", gap: "0.45rem", fontWeight: 600, fontSize: "0.92rem" },
    input: { width: "100%", padding: "0.9rem 1rem", color: "var(--ink)", border: "1px solid rgba(20,33,44,0.14)", borderRadius: 16, background: "rgba(255,255,255,0.9)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)", outline: "none" },
    fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
    primaryBtn: { padding: "0.95rem 1.4rem", color: "#f8fffd", background: "linear-gradient(135deg,var(--accent-strong),var(--accent))", border: "none", borderRadius: 999, fontWeight: 600, boxShadow: "0 12px 22px rgba(10,92,85,0.22)", cursor: "pointer" },
    ghostBtn: { padding: "0.8rem 1.1rem", color: "var(--ink)", background: "rgba(255,255,255,0.75)", border: "1px solid rgba(24,34,47,0.12)", borderRadius: 999, cursor: "pointer" },
    formNote: { color: "var(--muted)", fontSize: "0.9rem" },
  };

  return (
    <div style={S.root}>
      <div style={S.heroGrid}>
        <article style={S.heroCardAccent}>
          <p style={S.eyebrow}>Main Menu A</p>
          <h3 style={S.h3}>Issue a request through one guided channel</h3>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>The form forces requesters to explain the problem, expected outcome, urgency, and business impact before the work enters the board.</p>
          <div style={S.chipRow}>
            <span style={S.chip}>Structured intake</span>
            <span style={S.chip}>Better scoping</span>
            <span style={S.chip}>Cleaner handoff</span>
          </div>
        </article>
        <article style={S.heroCard}>
          <p style={{ ...S.eyebrow, opacity: 0.6 }}>Main Menu B</p>
          <h3 style={S.h3}>Track active work on one kanban board</h3>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--muted)" }}>Operations, reviewers, builders, testers, and deployers all share the same status model and ticket history.</p>
          <div style={S.heroNote}>Every card keeps the same request narrative, attachments, and activity timeline from intake to deployment.</div>
        </article>
      </div>

      <section style={S.formPanel}>
        <div style={S.panelHead}>
          <div>
            <p style={{ ...S.eyebrow, opacity: 0.6 }}>New Ticket</p>
            <h3 style={{ fontFamily: "var(--serif)", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Create an optimization request</h3>
          </div>
          <button style={S.ghostBtn} type="button">Add Sample Request</button>
        </div>

        <form style={{ display: "grid", gap: "1rem" }} onSubmit={handleSubmit}>
          <label style={S.label}>Ticket title<input style={S.input} value={form.title} onChange={set("title")} placeholder="Reduce manual reconciliation for BPO payroll" required /></label>
          <div style={S.fieldRow}>
            <label style={S.label}>Requesting division<input style={S.input} value={form.division} onChange={set("division")} placeholder="BPO Operations" required /></label>
            <label style={S.label}>Service line<input style={S.input} value={form.service} onChange={set("service")} placeholder="Payroll, MPO, Finance Ops" required /></label>
          </div>
          <div style={S.fieldRow}>
            <label style={S.label}>Requested by<input style={S.input} value={form.requester} onChange={set("requester")} placeholder="Division lead or PIC" required /></label>
            <label style={S.label}>Priority
              <select style={S.input} value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label style={S.label}>Current manual process<textarea style={{ ...S.input, resize: "vertical" }} value={form.currentProcess} onChange={set("currentProcess")} placeholder="Describe the current workflow, handoffs, spreadsheets, approvals, and bottlenecks." rows={4} required /></label>
          <label style={S.label}>Optimization request detail<textarea style={{ ...S.input, resize: "vertical" }} value={form.requestDetail} onChange={set("requestDetail")} placeholder="What should be improved, automated, or simplified?" rows={4} required /></label>
          <div style={S.fieldRow}>
            <label style={S.label}>Business impact<textarea style={{ ...S.input, resize: "vertical" }} value={form.businessImpact} onChange={set("businessImpact")} placeholder="Hours saved, reduced errors, SLA improvement, cost reduction." rows={3} required /></label>
            <label style={S.label}>Success metric<textarea style={{ ...S.input, resize: "vertical" }} value={form.successMetric} onChange={set("successMetric")} placeholder="Example: cut manual processing time from 6 hours to 45 minutes." rows={3} required /></label>
          </div>
          <label style={S.label}>Additional notes<textarea style={{ ...S.input, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Dependencies, affected tools, deadlines, or known risks." rows={3} /></label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button style={S.primaryBtn} type="submit">Create Ticket</button>
            <p style={S.formNote}>New tickets start in <strong>Issue Optimization Request</strong>.</p>
          </div>
        </form>
      </section>
    </div>
  );
}

Object.assign(window, { IntakeView });
