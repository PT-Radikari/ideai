// OpsFlow — App root

const STORAGE_KEY = "opsflow_uikit_tickets";

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#0d8a7c",
  "showRunway": true,
  "sidebarWidth": 300,
  "compactCards": false,
  "backgroundTone": "warm"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tickets, setTickets] = React.useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return SEED_TICKETS;
  });

  const [activeView, setActiveView] = React.useState("board");
  const [selectedId, setSelectedId] = React.useState(SEED_TICKETS[0]?.id ?? null);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = tickets.filter(t => t.stage === s).length;
    return acc;
  }, {});

  const total = tickets.length;
  const inFlight = tickets.filter(t => t.stage !== "Deployment").length;
  const highPri = tickets.filter(t => t.priority === "High").length;
  const deployed = tickets.filter(t => t.stage === "Deployment").length;

  function handleCreateTicket(ticket) {
    setTickets(prev => [ticket, ...prev]);
    setSelectedId(ticket.id);
    setActiveView("board");
  }

  function handleStageChange(id, stage) {
    setTickets(prev => prev.map(t => t.id !== id ? t : {
      ...t, stage,
      activity: [
        { title: "Stage updated", detail: `Moved to ${stage}.`, createdAt: new Date().toISOString() },
        ...t.activity,
      ],
    }));
    setSelectedId(id);
  }

  function handleAddNote(id, note) {
    setTickets(prev => prev.map(t => t.id !== id ? t : {
      ...t,
      activity: [
        { title: "Manual update added", detail: note, createdAt: new Date().toISOString() },
        ...t.activity,
      ],
    }));
  }

  // Apply tweaks as CSS variables on :root
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", tweaks.accentColor);
    // Derive accent-strong as a slightly darker shade via opacity trick
    root.style.setProperty("--accent-strong", tweaks.accentColor);
    root.style.setProperty("--accent-soft", tweaks.accentColor + "1f");
  }, [tweaks.accentColor]);

  const bgTones = {
    warm: "radial-gradient(circle at top left,rgba(13,138,124,0.24),transparent 24%),radial-gradient(circle at 85% 15%,rgba(223,111,45,0.18),transparent 18%),radial-gradient(circle at bottom right,rgba(10,92,85,0.16),transparent 24%),linear-gradient(135deg,#f7efdf 0%,#ece3d2 48%,#f6efe6 100%)",
    cool: "radial-gradient(circle at top left,rgba(31,99,216,0.18),transparent 24%),radial-gradient(circle at 85% 15%,rgba(13,138,124,0.14),transparent 18%),linear-gradient(135deg,#edf2f7 0%,#e2eaf4 48%,#eef3fb 100%)",
    neutral: "linear-gradient(135deg,#f5f4f2 0%,#eeece8 48%,#f5f3f0 100%)",
  };

  const S = {
    shell: { display: "flex", minHeight: "100vh" },
    main: { flex: 1, padding: tweaks.compactCards ? "1.25rem" : "2rem", minWidth: 0 },
    topbar: { display: "flex", justifyContent: "space-between", gap: "1.25rem", alignItems: "flex-start", marginBottom: "1.15rem", flexWrap: "wrap" },
    eyebrow: { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.6, margin: "0 0 4px" },
    h2: { fontFamily: "var(--serif)", fontSize: "clamp(2rem,3vw,3rem)", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 0.4rem" },
    topbarSummary: { color: "var(--muted)", fontSize: "1rem", lineHeight: 1.6, maxWidth: "48rem", margin: 0 },
    stamp: {
      display: "grid", gap: "0.18rem", minWidth: 230, padding: "1rem 1.1rem",
      border: "1px solid rgba(20,33,44,0.12)", borderRadius: 20,
      background: "linear-gradient(180deg,rgba(255,252,247,0.82),rgba(255,248,239,0.72))",
      boxShadow: "var(--shadow-soft)", marginBottom: "0.9rem",
    },
    stampLabel: { fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-strong)" },
    statGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(130px,1fr))", gap: "0.8rem" },
    statCard: {
      padding: "1rem 1.1rem", border: "1px solid rgba(20,33,44,0.08)", borderRadius: 18,
      background: "linear-gradient(180deg,rgba(255,252,247,0.88),rgba(249,243,233,0.78))",
      backdropFilter: "blur(10px)", boxShadow: "var(--shadow-soft)",
    },
    runway: {
      display: "grid", gridTemplateColumns: "minmax(200px,260px) 1fr",
      gap: "1rem", alignItems: "center", padding: "1.1rem 1.2rem",
      marginBottom: "1rem", border: "1px solid var(--line)", borderRadius: 30,
      background: "linear-gradient(135deg,rgba(255,252,247,0.88),rgba(245,237,225,0.72))",
      backdropFilter: "blur(12px)", boxShadow: "var(--shadow)",
    },
    runwayTrack: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "0.75rem" },
    runwayStage: (populated) => ({
      position: "relative", display: "grid", gap: "0.28rem", padding: "0.95rem 1rem",
      border: "1px solid rgba(20,33,44,0.08)", borderRadius: 18,
      background: "rgba(255,255,255,0.52)", overflow: "hidden",
      borderLeft: populated ? "4px solid" : "4px solid transparent",
      borderImage: populated ? "linear-gradient(180deg,#df6f2d,#0d8a7c) 1" : "none",
    }),
    noise: {
      position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.35, zIndex: 0,
      backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)",
      backgroundSize: "96px 96px",
      maskImage: "radial-gradient(circle at center,black,transparent 82%)",
    },
  };

  const now = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  // Apply background tone to body
  React.useEffect(() => {
    document.body.style.background = bgTones[tweaks.backgroundTone] || bgTones.warm;
  }, [tweaks.backgroundTone]);

  return (
    <>
      <div style={S.noise} aria-hidden="true" />
      <div style={{ ...S.shell, position: "relative", zIndex: 1 }}>
        <Sidebar activeView={activeView} setActiveView={setActiveView} tickets={tickets} width={tweaks.sidebarWidth} />

        <main style={S.main}>
          <header style={S.topbar}>
            <div>
              <p style={S.eyebrow}>Automation Pipeline Tech</p>
              <h2 style={S.h2}>Optimization Intake and Delivery Board</h2>
              <p style={S.topbarSummary}>One shared control surface for request capture, review gates, delivery movement, and deployment readiness.</p>
            </div>
            <div style={{ display: "grid", gap: "0.9rem", justifyItems: "end" }}>
              <div style={S.stamp}>
                <span style={S.stampLabel}>Live status</span>
                <strong>Command Center Prototype</strong>
                <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{now}</span>
              </div>
              <div style={S.statGrid}>
                {[
                  { label: "Tickets", value: total, meta: "Total requests logged" },
                  { label: "Active", value: inFlight, meta: "Across live delivery lanes" },
                  { label: "Critical", value: highPri, meta: "High-priority requests" },
                  { label: "Deployed", value: deployed, meta: "Completed releases" },
                ].map(({ label, value, meta }) => (
                  <article key={label} style={S.statCard}>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{label}</span>
                    <strong style={{ display: "block", fontFamily: "var(--serif)", fontSize: "1.8rem", margin: "4px 0" }}>{value}</strong>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", lineHeight: 1.45 }}>{meta}</span>
                  </article>
                ))}
              </div>
            </div>
          </header>

          {tweaks.showRunway && (
          <section style={S.runway} aria-label="Workflow overview">
            <div>
              <p style={S.eyebrow}>Workflow Signal</p>
              <h3 style={{ fontFamily: "var(--serif)", fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Delivery runway</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.55 }}>Live distribution across intake, review, build, and release stages.</p>
            </div>
            <div style={S.runwayTrack}>
              {STAGES.map((stage, i) => (
                <article key={stage} style={S.runwayStage(stageCounts[stage] > 0)}>
                  <span style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <strong style={{ fontSize: "0.88rem" }}>{stage}</strong>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{stageCounts[stage]} ticket{stageCounts[stage] !== 1 ? "s" : ""}</span>
                </article>
              ))}
            </div>
          </section>
          )}

          {activeView === "intake" && (
            <IntakeView onCreateTicket={handleCreateTicket} />
          )}
          {activeView === "board" && (
            <BoardView
              tickets={tickets}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              onStageChange={handleStageChange}
              onAddNote={handleAddNote}
              compactCards={tweaks.compactCards}
            />
          )}
        </main>
      </div>
      <TweaksPanel>
        <TweakColor  label="Accent color"      id="accentColor"     value={tweaks.accentColor}     onChange={v => setTweak("accentColor", v)} />
        <TweakToggle label="Show runway panel" id="showRunway"      value={tweaks.showRunway}      onChange={v => setTweak("showRunway", v)} />
        <TweakToggle label="Compact cards"     id="compactCards"    value={tweaks.compactCards}    onChange={v => setTweak("compactCards", v)} />
        <TweakSlider label="Sidebar width"     id="sidebarWidth"    value={tweaks.sidebarWidth}    onChange={v => setTweak("sidebarWidth", v)} min={220} max={420} step={10} />
        <TweakRadio  label="Background tone"   id="backgroundTone"  value={tweaks.backgroundTone}  onChange={v => setTweak("backgroundTone", v)}
          options={[{ value: "warm", label: "Warm" }, { value: "cool", label: "Cool" }, { value: "neutral", label: "Neutral" }]} />
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
