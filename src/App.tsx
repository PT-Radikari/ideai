import { useEffect, useMemo, useState } from "react";
import { buildCode, formatRelativeTime, sanitizeAssignee, SEED_TICKETS, STORAGE_KEY } from "./lib";
import {
  ASSIGNEES,
  CLUSTERS,
  PRIORITIES,
  STAGES,
  type ActivityItem,
  type Cluster,
  type Priority,
  type Stage,
  type StageCounts,
  type Ticket,
  type View,
} from "./types";

const STAGE_CLUSTER: Record<Stage, Exclude<Cluster, "all">> = {
  "Issue Request": "request",
  Review: "request",
  Revision: "build",
  Production: "build",
  Testing: "release",
  Deployment: "release",
};

const INTAKE_TEMPLATE = {
  division: "MPO Finance",
  service: "Invoice Reconciliation",
  priority: "High" as Priority,
  title: "Automate invoice validation before MPO month-end close",
  currentProcess:
    "Analysts compare vendor spreadsheets against ERP exports by hand and flag mismatches over email.",
  requestDetail:
    "Introduce a validation workflow that checks duplicate invoice numbers, missing PO references, and amount mismatches before month-end review.",
  businessImpact:
    "Reduce late close risk and prevent repeat rework across the finance operations team.",
  successMetric:
    "Shrink validation time from 5 hours per batch to under 1 hour while reducing mismatch escapes by 80%.",
  attachments: "vendor_export.xlsx, erp_export.csv, screenshot_mismatch.png",
};

type IntakeFormState = {
  division: string;
  service: string;
  priority: Priority | "";
  title: string;
  currentProcess: string;
  requestDetail: string;
  businessImpact: string;
  successMetric: string;
  attachments: string;
};

type DrawerDraft = {
  assignee: (typeof ASSIGNEES)[number];
  note: string;
  stage: Stage;
};

function createEmptyForm(): IntakeFormState {
  return {
    division: "",
    service: "",
    priority: "",
    title: "",
    currentProcess: "",
    requestDetail: "",
    businessImpact: "",
    successMetric: "",
    attachments: "",
  };
}

function buildStageCounts(tickets: Ticket[]): StageCounts {
  return STAGES.reduce((counts, stage) => {
    counts[stage] = tickets.filter((ticket) => ticket.stage === stage).length;
    return counts;
  }, {} as StageCounts);
}

function createActivity(title: string, detail: string): ActivityItem {
  return { title, detail, createdAt: new Date().toISOString() };
}

function parseAttachments(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadInitialTickets(): Ticket[] {
  if (typeof window === "undefined") {
    return SEED_TICKETS;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Ticket[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return SEED_TICKETS;
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>(() => loadInitialTickets());
  const [view, setView] = useState<View>("board");
  const [cluster, setCluster] = useState<Cluster>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<IntakeFormState>(() => createEmptyForm());

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets],
  );
  const [drawerDraft, setDrawerDraft] = useState<DrawerDraft | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!selectedTicket) {
      setDrawerDraft(null);
      return;
    }

    setDrawerDraft({
      stage: selectedTicket.stage,
      assignee: selectedTicket.assignee,
      note: "",
    });
  }, [selectedTicket]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const stageCounts = useMemo(() => buildStageCounts(tickets), [tickets]);
  const divisionOptions = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.division))].sort(),
    [tickets],
  );

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (cluster !== "all" && STAGE_CLUSTER[ticket.stage] !== cluster) {
        return false;
      }
      if (priorityFilter && ticket.priority !== priorityFilter) {
        return false;
      }
      if (divisionFilter && ticket.division !== divisionFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        ticket.title,
        ticket.division,
        ticket.service,
        ticket.requestDetail,
        ticket.code,
        ticket.assignee,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [cluster, divisionFilter, priorityFilter, search, tickets]);

  const groupedClusterTickets = useMemo(() => {
    const groups: Record<Exclude<Cluster, "all">, Ticket[]> = {
      request: [],
      build: [],
      release: [],
    };

    filteredTickets.forEach((ticket) => {
      groups[STAGE_CLUSTER[ticket.stage]].push(ticket);
    });

    return groups;
  }, [filteredTickets]);

  const pipelineTotals = useMemo(() => {
    const review = tickets.filter((ticket) => ticket.stage === "Review").length;
    const build = tickets.filter((ticket) => ticket.stage === "Production").length;
    const intake = stageCounts["Issue Request"] + stageCounts.Review;
    const inProgress = tickets.filter((ticket) =>
      ["Revision", "Production", "Testing"].includes(ticket.stage),
    ).length;
    const done = stageCounts.Deployment;

    return {
      total: tickets.length,
      review,
      build,
      intake,
      inProgress,
      done,
    };
  }, [stageCounts, tickets]);

  function openBoardForCluster(nextCluster: Cluster) {
    setCluster(nextCluster);
    setView("board");
  }

  function handleCardClick(ticket: Ticket, advanceStage = false) {
    if (advanceStage) {
      const currentIndex = STAGES.indexOf(ticket.stage);
      if (currentIndex >= STAGES.length - 1) {
        setToast("Already in final stage");
        return;
      }

      const nextStage = STAGES[currentIndex + 1];
      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id
            ? {
                ...item,
                stage: nextStage,
                activity: [
                  createActivity(
                    `Moved: ${ticket.stage} → ${nextStage}`,
                    "Shifted via Shift+click.",
                  ),
                  ...item.activity,
                ],
              }
            : item,
        ),
      );
      setToast(`${ticket.title}: ${ticket.stage} → ${nextStage}`);
      return;
    }

    setSelectedId(ticket.id);
  }

  function handleSaveDrawer() {
    if (!selectedTicket || !drawerDraft) {
      return;
    }

    const changes: string[] = [];

    if (drawerDraft.stage !== selectedTicket.stage) {
      changes.push(`Stage: ${selectedTicket.stage} → ${drawerDraft.stage}`);
    }
    if (drawerDraft.assignee !== selectedTicket.assignee) {
      changes.push(`Assigned to ${drawerDraft.assignee}`);
    }
    if (drawerDraft.note.trim()) {
      changes.push(`Note: ${drawerDraft.note.trim()}`);
    }
    if (changes.length === 0) {
      setToast("Nothing to save");
      return;
    }

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === selectedTicket.id
          ? {
              ...ticket,
              stage: drawerDraft.stage,
              assignee: drawerDraft.assignee,
              activity: [
                createActivity("Manual update", changes.join(" · ")),
                ...ticket.activity,
              ],
            }
          : ticket,
      ),
    );
    setToast("Update saved");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !form.division ||
      !form.service ||
      !form.priority ||
      !form.title ||
      !form.currentProcess ||
      !form.requestDetail
    ) {
      const el = (event.target as HTMLFormElement).querySelector<HTMLElement>(
        !form.division
          ? "#if-division"
          : !form.service
            ? "#if-service"
            : !form.priority
              ? "#if-priority"
              : !form.title
                ? "#if-title"
                : !form.currentProcess
                  ? "#if-process"
                  : "#if-detail",
      );
      el?.focus();
      setToast("Fill in required fields");
      return;
    }

    const nextTicket: Ticket = {
      id: crypto.randomUUID(),
      code: buildCode(),
      title: form.title.length > 72 ? `${form.title.slice(0, 72)}…` : form.title,
      division: form.division,
      service: form.service,
      priority: form.priority,
      stage: "Issue Request",
      currentProcess: form.currentProcess,
      requestDetail: form.requestDetail,
      businessImpact: form.businessImpact || "—",
      successMetric: form.successMetric || "—",
      attachments: parseAttachments(form.attachments),
      assignee: "Unassigned",
      createdAt: new Date().toISOString(),
      activity: [createActivity("Ticket created", "Submitted through guided intake.")],
    };

    setTickets((current) => [nextTicket, ...current]);
    setSelectedId(nextTicket.id);
    setForm(createEmptyForm());
    setView("board");
    setToast("Submitted to Issue Request");
  }

  return (
    <>
      <div className="app">
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar-brand">
            <p className="sidebar-eyebrow">Process Studio</p>
            <p className="sidebar-logo">OpsFlow</p>
            <p className="sidebar-tagline">Optimization request pipeline</p>
          </div>

          <div className="sidebar-nav">
            <p className="nav-section-label">Workspace</p>
            <button
              className={`nav-item ${view === "board" ? "is-active" : ""}`}
              type="button"
              onClick={() => setView("board")}
            >
              <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="3" width="4" height="14" rx="1.5" />
                <rect x="8" y="3" width="4" height="10" rx="1.5" />
                <rect x="14" y="3" width="4" height="12" rx="1.5" />
              </svg>
              Pipeline Board
            </button>
            <button
              className={`nav-item ${view === "intake" ? "is-active" : ""}`}
              type="button"
              onClick={() => setView("intake")}
            >
              <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6.5v7M6.5 10h7" />
              </svg>
              New Request
            </button>

            <p className="nav-section-label nav-section-label-spaced">Quick filters</p>
            {CLUSTERS.filter((item) => item !== "all").map((item) => (
              <button
                key={item}
                className={`nav-item ${cluster === item ? "is-active" : ""}`}
                type="button"
                onClick={() => openBoardForCluster(item)}
              >
                {item === "request" ? (
                  <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 5h14M6 10h8M9 15h2" />
                  </svg>
                ) : item === "build" ? (
                  <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 16l4-8 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 3v10M6 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 17h12" />
                  </svg>
                )}
                {item === "request" ? "Intake & Review" : item === "build" ? "Build" : "Release"}
              </button>
            ))}
          </div>

          <div className="sidebar-stats">
            <div className="stat-row">
              <div className="stat-tile">
                <strong>{pipelineTotals.total}</strong>
                <span>Total</span>
              </div>
              <div className="stat-tile">
                <strong>{pipelineTotals.review}</strong>
                <span>Review</span>
              </div>
              <div className="stat-tile">
                <strong>{pipelineTotals.build}</strong>
                <span>Build</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="main">
          <header className="topbar">
            <div className="topbar-row1">
              <h2 className="topbar-title">{view === "board" ? "Pipeline Board" : "New Request"}</h2>
              <div className="topbar-actions">
                {view === "board" ? (
                  <button className="btn-ghost" type="button" onClick={() => setView("intake")}>
                    New Request
                  </button>
                ) : (
                  <button className="btn-primary" type="button" onClick={() => setView("board")}>
                    ← Board
                  </button>
                )}
              </div>
            </div>

            {view === "board" && (
              <div className="topbar-row2">
                <div className="stage-chips">
                  <button
                    className={`stage-chip ${cluster === "all" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setCluster("all")}
                  >
                    All stages
                  </button>
                  <button
                    className={`stage-chip ${cluster === "request" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setCluster("request")}
                  >
                    Intake & Review
                  </button>
                  <button
                    className={`stage-chip ${cluster === "build" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setCluster("build")}
                  >
                    Build
                  </button>
                  <button
                    className={`stage-chip ${cluster === "release" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setCluster("release")}
                  >
                    Release
                  </button>
                </div>
                <div className="topbar-sep"></div>
                <div className="filter-group">
                  <input
                    className="filter-input filter-input--search"
                    type="search"
                    placeholder="Search requests…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="filter-input filter-input--select"
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as Priority | "")}
                  >
                    <option value="">Priority — all</option>
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-input filter-input--select"
                    value={divisionFilter}
                    onChange={(event) => setDivisionFilter(event.target.value)}
                  >
                    <option value="">Division — all</option>
                    {divisionOptions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </header>

          {view === "board" ? (
            <div className="content">
              <div className="board-outer sk sk--strong">
                <div className="board-inner">
                  <div className="board">
                    {STAGES.map((stage) => {
                      const stageTickets = filteredTickets.filter((ticket) => ticket.stage === stage);
                      return (
                        <section key={stage} className="col sk sk--col" aria-label={stage}>
                          <div className="col-header">
                            <span className="col-name">{stage}</span>
                            <span className="col-count sk sk--count">{stageTickets.length}</span>
                          </div>
                          <div className="col-cards">
                            {stageTickets.map((ticket) => (
                              <button
                                key={ticket.id}
                                type="button"
                                className={`card sk sk--card ${selectedId === ticket.id ? "is-active" : ""}`}
                                title="Click to inspect • Shift+click to advance stage"
                                onClick={(event) => handleCardClick(ticket, event.shiftKey)}
                              >
                                <p className="card-code">{ticket.code}</p>
                                <p className="card-title">{ticket.title}</p>
                                <div className="card-footer">
                                  <span className="card-division">{ticket.division}</span>
                                  <span className="priority-badge" data-p={ticket.priority}>
                                    {ticket.priority}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>

                <aside className={`drawer ${selectedTicket ? "is-open" : ""}`} aria-label="Request detail">
                  <div className="drawer-head">
                    <div>
                      <p className="drawer-code">{selectedTicket?.code ?? ""}</p>
                      <h3 className="drawer-title-text">
                        {selectedTicket?.title ?? "Select a card"}
                      </h3>
                    </div>
                    <button
                      className="drawer-close"
                      type="button"
                      aria-label="Close drawer"
                      onClick={() => setSelectedId(null)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="drawer-body">
                    {selectedTicket && drawerDraft ? (
                      <>
                        <div className="dsec">
                          <div className="dsec-meta">
                            <span className="meta-chip" data-p={selectedTicket.priority}>
                              {selectedTicket.priority}
                            </span>
                            <span className="meta-chip">{selectedTicket.stage}</span>
                            <span className="meta-chip">{selectedTicket.division}</span>
                            <span className="meta-chip">{selectedTicket.service}</span>
                          </div>
                        </div>

                        <div className="dsec">
                          <p className="dsec-label">Current manual process</p>
                          <p>{selectedTicket.currentProcess || "—"}</p>
                        </div>
                        <div className="dsec">
                          <p className="dsec-label">Optimization request</p>
                          <p>{selectedTicket.requestDetail || "—"}</p>
                        </div>
                        {selectedTicket.businessImpact && selectedTicket.businessImpact !== "—" && (
                          <div className="dsec">
                            <p className="dsec-label">Business impact</p>
                            <p>{selectedTicket.businessImpact}</p>
                          </div>
                        )}
                        {selectedTicket.successMetric && selectedTicket.successMetric !== "—" && (
                          <div className="dsec">
                            <p className="dsec-label">Success metric</p>
                            <p>{selectedTicket.successMetric}</p>
                          </div>
                        )}
                        {selectedTicket.attachments.length > 0 && (
                          <div className="dsec">
                            <p className="dsec-label">Attachments</p>
                            <p className="attachment-list">{selectedTicket.attachments.join(", ")}</p>
                          </div>
                        )}

                        <div className="dsec dsec-actions">
                          <p className="dsec-label dsec-label-wide">Actions</p>
                          <div className="drawer-form-row">
                            <label className="dlabel">
                              Stage
                              <select
                                value={drawerDraft.stage}
                                onChange={(event) =>
                                  setDrawerDraft((current) =>
                                    current
                                      ? { ...current, stage: event.target.value as Stage }
                                      : current,
                                  )
                                }
                              >
                                {STAGES.map((stage) => (
                                  <option key={stage} value={stage}>
                                    {stage}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="dlabel">
                              Assign to
                              <select
                                value={drawerDraft.assignee}
                                onChange={(event) =>
                                  setDrawerDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          assignee: sanitizeAssignee(event.target.value),
                                        }
                                      : current,
                                  )
                                }
                              >
                                {ASSIGNEES.map((assignee) => (
                                  <option key={assignee} value={assignee}>
                                    {assignee}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="dlabel dlabel-spaced">
                            Add note
                            <textarea
                              rows={3}
                              placeholder="Review finding, blocker, revision note, or deployment detail."
                              value={drawerDraft.note}
                              onChange={(event) =>
                                setDrawerDraft((current) =>
                                  current ? { ...current, note: event.target.value } : current,
                                )
                              }
                            />
                          </label>
                          <div className="drawer-save-row">
                            <button className="btn-primary" type="button" onClick={handleSaveDrawer}>
                              Save update
                            </button>
                          </div>
                        </div>

                        <div className="dsec dsec-actions">
                          <p className="dsec-label dsec-label-wide">Pipeline snapshot</p>
                          <div className="snapshot-grid">
                            <div className="snap-tile">
                              <strong>{pipelineTotals.total}</strong>
                              <span>Total</span>
                            </div>
                            <div className="snap-tile">
                              <strong>{pipelineTotals.intake}</strong>
                              <span>Intake</span>
                            </div>
                            <div className="snap-tile">
                              <strong>{pipelineTotals.inProgress}</strong>
                              <span>Build</span>
                            </div>
                            <div className="snap-tile">
                              <strong>{pipelineTotals.done}</strong>
                              <span>Done</span>
                            </div>
                          </div>
                        </div>

                        <div className="dsec dsec-actions">
                          <p className="dsec-label dsec-label-wide">Activity</p>
                          <div className="activity-feed">
                            {selectedTicket.activity.map((item, index) => (
                              <div key={`${item.createdAt}-${index}`} className="act-item">
                                <strong>
                                  {item.title} · {formatRelativeTime(item.createdAt)}
                                </strong>
                                {item.detail}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="dsec">
                        <p className="dsec-label">Pipeline snapshot</p>
                        <div className="snapshot-grid">
                          <div className="snap-tile">
                            <strong>{pipelineTotals.total}</strong>
                            <span>Total</span>
                          </div>
                          <div className="snap-tile">
                            <strong>{pipelineTotals.intake}</strong>
                            <span>Intake</span>
                          </div>
                          <div className="snap-tile">
                            <strong>{pipelineTotals.inProgress}</strong>
                            <span>Build</span>
                          </div>
                          <div className="snap-tile">
                            <strong>{pipelineTotals.done}</strong>
                            <span>Done</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              <div className="clusters-wrap sk">
                <p className="clusters-label">Cluster view</p>
                <div className="clusters-grid">
                  <article className="cluster sk sk--cluster cluster--req">
                    <div className="cluster-head">
                      <span className="cluster-name">Request</span>
                      <div className="cluster-stages">
                        <span className="cluster-stage-pill">Issue Request</span>
                        <span className="cluster-stage-pill">Review</span>
                      </div>
                    </div>
                    <div className="cluster-cards">
                      {groupedClusterTickets.request.length > 0 ? (
                        groupedClusterTickets.request.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            className={`card sk sk--card ${selectedId === ticket.id ? "is-active" : ""}`}
                            onClick={() => setSelectedId(ticket.id)}
                          >
                            <p className="card-code cluster-card-code">
                              {ticket.code} · {ticket.stage}
                            </p>
                            <p className="card-title cluster-card-title">{ticket.title}</p>
                          </button>
                        ))
                      ) : (
                        <p className="cluster-empty">No tickets in this cluster.</p>
                      )}
                    </div>
                  </article>

                  <article className="cluster sk sk--cluster cluster--build">
                    <div className="cluster-head">
                      <span className="cluster-name">Build</span>
                      <div className="cluster-stages">
                        <span className="cluster-stage-pill">Revision</span>
                        <span className="cluster-stage-pill">Production</span>
                      </div>
                    </div>
                    <div className="cluster-cards">
                      {groupedClusterTickets.build.length > 0 ? (
                        groupedClusterTickets.build.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            className={`card sk sk--card ${selectedId === ticket.id ? "is-active" : ""}`}
                            onClick={() => setSelectedId(ticket.id)}
                          >
                            <p className="card-code cluster-card-code">
                              {ticket.code} · {ticket.stage}
                            </p>
                            <p className="card-title cluster-card-title">{ticket.title}</p>
                          </button>
                        ))
                      ) : (
                        <p className="cluster-empty">No tickets in this cluster.</p>
                      )}
                    </div>
                  </article>

                  <article className="cluster sk sk--cluster cluster--rel">
                    <div className="cluster-head">
                      <span className="cluster-name">Release</span>
                      <div className="cluster-stages">
                        <span className="cluster-stage-pill">Testing</span>
                        <span className="cluster-stage-pill">Deployment</span>
                      </div>
                    </div>
                    <div className="cluster-cards">
                      {groupedClusterTickets.release.length > 0 ? (
                        groupedClusterTickets.release.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            className={`card sk sk--card ${selectedId === ticket.id ? "is-active" : ""}`}
                            onClick={() => setSelectedId(ticket.id)}
                          >
                            <p className="card-code cluster-card-code">
                              {ticket.code} · {ticket.stage}
                            </p>
                            <p className="card-title cluster-card-title">{ticket.title}</p>
                          </button>
                        ))
                      ) : (
                        <p className="cluster-empty">No tickets in this cluster.</p>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </div>
          ) : (
            <div className="content">
              <div className="intake-wrap">
                <aside className="start-here sk">
                  <h3>Start Here</h3>
                  <ol className="start-steps">
                    <li>Choose your division and service line</li>
                    <li>Describe today&apos;s manual process</li>
                    <li>Specify what needs to be improved</li>
                    <li>Attach files and evidence</li>
                    <li>Set priority and submit for review</li>
                  </ol>
                  <div className="start-sticky">
                    Use the &quot;Use template&quot; button to pre-fill a worked example and see what a good request looks like.
                  </div>
                </aside>

                <div>
                  <div className="intake-form-wrap sk">
                    <h3>Request template</h3>
                    <form autoComplete="off" onSubmit={handleSubmit}>
                      <div className="field-row-3">
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-division">
                            Division
                          </label>
                          <div className="ifield-wrap sk sk--field">
                            <input
                              id="if-division"
                              type="text"
                              placeholder="BPO / MPO / QA / Shared Services"
                              value={form.division}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, division: event.target.value }))
                              }
                              required
                            />
                          </div>
                        </div>
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-service">
                            Service line
                          </label>
                          <div className="ifield-wrap sk sk--field">
                            <input
                              id="if-service"
                              type="text"
                              placeholder="Payroll / Finance / Ops"
                              value={form.service}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, service: event.target.value }))
                              }
                              required
                            />
                          </div>
                        </div>
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-priority">
                            Priority
                          </label>
                          <div className="ifield-wrap sk sk--field">
                            <select
                              id="if-priority"
                              value={form.priority}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  priority: event.target.value as Priority | "",
                                }))
                              }
                              required
                            >
                              <option value="" disabled>
                                Select priority
                              </option>
                              {PRIORITIES.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="field-row-1 title-rel">
                        <label className="ifield-label" htmlFor="if-title">
                          Request title
                        </label>
                        <div className="ifield-wrap sk sk--field ifield-wrap--med">
                          <textarea
                            id="if-title"
                            rows={3}
                            placeholder="Short, clear label for the optimization request"
                            value={form.title}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, title: event.target.value }))
                            }
                            required
                          />
                        </div>
                        <button
                          className="use-tmpl-btn"
                          type="button"
                          onClick={() => setForm(INTAKE_TEMPLATE)}
                        >
                          Use template
                        </button>
                      </div>

                      <div className="field-row-2">
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-process">
                            Current manual process
                          </label>
                          <div className="ifield-wrap sk sk--field ifield-wrap--tall">
                            <textarea
                              id="if-process"
                              rows={5}
                              placeholder="Describe how the team works today - handoffs, spreadsheets, pain points."
                              value={form.currentProcess}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  currentProcess: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </div>
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-detail">
                            Optimization request
                          </label>
                          <div className="ifield-wrap sk sk--field ifield-wrap--tall">
                            <textarea
                              id="if-detail"
                              rows={5}
                              placeholder="What should be improved, automated, or simplified?"
                              value={form.requestDetail}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  requestDetail: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="field-row-3">
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-impact">
                            Business impact
                          </label>
                          <div className="ifield-wrap sk sk--field ifield-wrap--med">
                            <textarea
                              id="if-impact"
                              rows={3}
                              placeholder="Hours saved, SLA improvement, error reduction."
                              value={form.businessImpact}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  businessImpact: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-metric">
                            Success metric
                          </label>
                          <div className="ifield-wrap sk sk--field ifield-wrap--med">
                            <textarea
                              id="if-metric"
                              rows={3}
                              placeholder="Measurable outcome when done."
                              value={form.successMetric}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  successMetric: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="ifield">
                          <label className="ifield-label" htmlFor="if-attach">
                            Attachments
                          </label>
                          <div className="ifield-wrap sk sk--field ifield-wrap--med">
                            <textarea
                              id="if-attach"
                              rows={3}
                              placeholder="Spreadsheet and image file names."
                              value={form.attachments}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  attachments: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="intake-submit-row">
                        <button className="btn-ghost" type="button" onClick={() => setView("board")}>
                          Cancel
                        </button>
                        <button className="btn-primary-lg sk sk--pill" type="submit">
                          Submit to Review
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="tracking-wrap sk">
                    <h4>Pipeline snapshot</h4>
                    <div className="tracking-grid">
                      {STAGES.map((stage) => (
                        <div key={stage} className="tracking-tile">
                          <p className="tracking-stage">{stage}</p>
                          <p className="tracking-count">{stageCounts[stage]}</p>
                          <p className="tracking-sub">
                            ticket{stageCounts[stage] === 1 ? "" : "s"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`toast ${toast ? "is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
