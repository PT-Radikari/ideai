// OpsFlow — Sidebar component

function Sidebar({ activeView, setActiveView, tickets, width = 300 }) {
  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = tickets.filter(t => t.stage === s).length;
    return acc;
  }, {});

  const sidebarStyles = {
    sidebar: {
      display: "flex", flexDirection: "column", gap: "1.25rem",
      padding: "2rem", color: "#f8fcfb", width, minHeight: "100vh",
      background: "radial-gradient(circle at top, rgba(13,138,124,0.28), transparent 26%), linear-gradient(180deg,rgba(10,23,31,0.98),rgba(8,53,57,0.96)), #0b252f",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
    },
    brandBlock: {
      position: "relative", overflow: "hidden",
      padding: "1.45rem",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 30,
      background: "linear-gradient(155deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))",
    },
    eyebrow: {
      margin: "0 0 0.35rem", fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.72,
    },
    sigil: {
      display: "inline-grid", gridTemplateColumns: "repeat(3,10px)",
      gap: "0.35rem", marginBottom: "1.25rem",
    },
    sigilDot: {
      aspectRatio: "1", borderRadius: 999, width: 10,
      background: "linear-gradient(135deg,#f4bf66,#6fe5cb)",
      boxShadow: "0 0 18px rgba(111,229,203,0.38)",
    },
    h1: {
      fontFamily: "var(--serif)", fontSize: "1.6rem", fontWeight: 700,
      letterSpacing: "-0.02em", color: "#f8fcfb", margin: "0 0 0.5rem",
    },
    brandCopy: { fontSize: "0.9rem", lineHeight: 1.55, color: "rgba(248,252,251,0.78)", margin: 0 },
    nav: { display: "grid", gap: "0.7rem" },
    navBtn: (active) => ({
      padding: "0.9rem 1rem", textAlign: "left", color: "#d9f0ee",
      background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
      border: "none", borderRadius: 999, fontSize: "0.95rem",
      transform: active ? "translateX(3px)" : "none",
      transition: "all 160ms ease",
    }),
    panel: {
      padding: "1rem 1.1rem",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 22,
      background: "linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))",
    },
    panelLabel: {
      margin: "0 0 0.8rem", fontSize: "0.82rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
    },
    stageItem: {
      display: "grid", gridTemplateColumns: "auto 1fr auto",
      gap: "0.75rem", alignItems: "center", padding: "0.72rem 0.85rem",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
      background: "rgba(255,255,255,0.04)", marginBottom: 6,
    },
    stageIdx: { fontSize: "0.72rem", letterSpacing: "0.14em", opacity: 0.65 },
    stageName: { fontSize: "0.92rem" },
    stageCount: {
      minWidth: "2rem", padding: "0.2rem 0.55rem", borderRadius: 999,
      textAlign: "center", color: "#d8faf3",
      background: "rgba(111,229,203,0.14)", fontSize: "0.8rem", fontWeight: 700,
    },
    ruleList: { margin: 0, paddingLeft: "1.1rem", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(248,252,251,0.78)" },
  };

  return (
    <aside style={sidebarStyles.sidebar}>
      <div style={sidebarStyles.brandBlock}>
        <p style={sidebarStyles.eyebrow}>Internal Workflow Hub</p>
        <div style={sidebarStyles.sigil} aria-hidden="true">
          <span style={sidebarStyles.sigilDot}></span>
          <span style={sidebarStyles.sigilDot}></span>
          <span style={sidebarStyles.sigilDot}></span>
        </div>
        <h1 style={sidebarStyles.h1}>OpsFlow</h1>
        <p style={sidebarStyles.brandCopy}>
          Intake and delivery tracking for optimization requests across BPO, MPO, and supporting divisions.
        </p>
      </div>

      <nav style={sidebarStyles.nav}>
        <button style={sidebarStyles.navBtn(activeView === "intake")} onClick={() => setActiveView("intake")}>Issue Channel</button>
        <button style={sidebarStyles.navBtn(activeView === "board")} onClick={() => setActiveView("board")}>Kanban Board</button>
      </nav>


    </aside>
  );
}

Object.assign(window, { Sidebar });
