import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type DragEventHandler,
  type FormEvent,
} from "react";
import {
  buildActivity,
  buildSeedTickets,
  buildStandaloneSampleTicket,
  buildTicketCode,
  formatDate,
  formatFileSize,
  formatTimestamp,
  normalizeAttachments,
  STORAGE_KEY,
  trimText,
} from "./lib";
import {
  PRIORITIES,
  STAGES,
  type AttachmentRecord,
  type Priority,
  type Stage,
  type Ticket,
  type View,
} from "./types";

export default function App() {
  const initialTickets = useRef(loadInitialTickets());
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets.current);
  const [activeView, setActiveView] = useState<View>("intake");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    initialTickets.current[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [divisionFilter, setDivisionFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"" | Priority>("");
  const [currentTimestamp, setCurrentTimestamp] = useState(() =>
    formatTimestamp(new Date()),
  );
  const [detailNote, setDetailNote] = useState("");
  const [dragStage, setDragStage] = useState<Stage | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    const currentTicketExists = tickets.some((ticket) => ticket.id === selectedTicketId);
    if (!currentTicketExists) {
      setSelectedTicketId(tickets[0]?.id ?? null);
    }
  }, [selectedTicketId, tickets]);

  useEffect(() => {
    setDetailNote("");
  }, [selectedTicketId]);

  useEffect(() => {
    const update = () => setCurrentTimestamp(formatTimestamp(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      !normalizedSearch ||
      [
        ticket.title,
        ticket.division,
        ticket.service,
        ticket.requestDetail,
        ticket.requester,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    const matchesDivision = !divisionFilter || ticket.division === divisionFilter;
    const matchesPriority = !priorityFilter || ticket.priority === priorityFilter;

    return matchesSearch && matchesDivision && matchesPriority;
  });

  const divisions = [...new Set(tickets.map((ticket) => ticket.division))].sort(
    (left, right) => left.localeCompare(right),
  );
  const total = tickets.length;
  const inFlight = tickets.filter((ticket) => ticket.stage !== "Deployment").length;
  const highPriority = tickets.filter((ticket) => ticket.priority === "High").length;
  const deployed = tickets.filter((ticket) => ticket.stage === "Deployment").length;
  const stageCounts = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      tickets.filter((ticket) => ticket.stage === stage).length,
    ]),
  ) as Record<Stage, number>;

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const attachments = await normalizeAttachments(
      formData
        .getAll("attachments")
        .filter((value): value is File => value instanceof File && value.size > 0),
    );

    const ticket: Ticket = {
      id: crypto.randomUUID(),
      code: buildTicketCode(),
      stage: STAGES[0],
      title: getStringField(formData, "title"),
      division: getStringField(formData, "division"),
      service: getStringField(formData, "service"),
      requester: getStringField(formData, "requester"),
      priority: getPriorityField(formData, "priority"),
      currentProcess: getStringField(formData, "currentProcess"),
      requestDetail: getStringField(formData, "requestDetail"),
      businessImpact: getStringField(formData, "businessImpact"),
      successMetric: getStringField(formData, "successMetric"),
      notes: getStringField(formData, "notes"),
      attachments,
      createdAt: new Date().toISOString(),
      activity: [
        buildActivity(
          "Ticket created",
          "Request entered through the guided intake channel.",
        ),
      ],
    };

    setTickets((current) => [ticket, ...current]);
    setSelectedTicketId(ticket.id);
    setActiveView("board");
    form.reset();
  }

  function handleSeedExample() {
    const sample = buildStandaloneSampleTicket();
    setTickets((current) => [sample, ...current]);
    setSelectedTicketId(sample.id);
    setActiveView("board");
  }

  function updateTicketStage(ticketId: string, nextStage: Stage, detail: string) {
    setTickets((current) =>
      current.map((ticket) => {
        if (ticket.id !== ticketId || ticket.stage === nextStage) {
          return ticket;
        }

        return {
          ...ticket,
          stage: nextStage,
          activity: [
            buildActivity("Stage updated", `${detail} ${ticket.stage} -> ${nextStage}`),
            ...ticket.activity,
          ],
        };
      }),
    );
    setSelectedTicketId(ticketId);
  }

  function addDetailNote() {
    if (!selectedTicket || !detailNote.trim()) {
      return;
    }

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === selectedTicket.id
          ? {
              ...ticket,
              activity: [
                buildActivity("Manual update added", detailNote.trim()),
                ...ticket.activity,
              ],
            }
          : ticket,
      ),
    );
    setDetailNote("");
  }

  return (
    <>
      <div className="page-noise" aria-hidden="true"></div>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <p className="eyebrow">Internal Workflow Hub</p>
            <div className="brand-sigil" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <h1>OpsFlow</h1>
            <p className="brand-copy">
              Intake and delivery tracking for optimization requests across BPO,
              MPO, and supporting divisions.
            </p>
          </div>

          <nav className="primary-nav" aria-label="Primary">
            <button
              className={`nav-button${activeView === "intake" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveView("intake")}
            >
              Issue Channel
            </button>
            <button
              className={`nav-button${activeView === "board" ? " is-active" : ""}`}
              type="button"
              onClick={() => setActiveView("board")}
            >
              Kanban Board
            </button>
          </nav>

          <section className="sidebar-panel">
            <p className="panel-label">Workflow</p>
            <ol className="stage-list">
              {STAGES.map((stage, index) => (
                <li className="stage-list__item" key={stage}>
                  <span className="stage-list__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="stage-list__name">{stage}</span>
                  <span className="stage-list__count">{stageCounts[stage]}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="sidebar-panel">
            <p className="panel-label">Intake Rules</p>
            <ul className="rule-list">
              <li>Every request needs a division and service line.</li>
              <li>Requesters must explain the current manual process.</li>
              <li>Images and spreadsheets can be attached to support analysis.</li>
              <li>Tickets start in the intake column and move through review.</li>
            </ul>
          </section>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="topbar-copy">
              <p className="eyebrow">Automation Pipeline Tech</p>
              <h2>Optimization Intake and Delivery Board</h2>
              <p className="topbar-summary">
                One shared control surface for request capture, review gates,
                delivery movement, and deployment readiness.
              </p>
            </div>
            <div className="topbar-meta">
              <div className="topbar-stamp">
                <span className="stamp-label">Live status</span>
                <strong>Command Center Prototype</strong>
                <span>{currentTimestamp}</span>
              </div>
              <div className="stat-grid">
                <StatCard
                  label="Tickets"
                  meta="Total requests logged"
                  value={total}
                />
                <StatCard
                  label="Active"
                  meta="Across live delivery lanes"
                  value={inFlight}
                />
                <StatCard
                  label="Critical"
                  meta="High-priority requests"
                  value={highPriority}
                />
                <StatCard
                  label="Deployed"
                  meta="Completed releases"
                  value={deployed}
                />
              </div>
            </div>
          </header>

          <section className="runway-panel" aria-label="Workflow overview">
            <div className="runway-copy">
              <p className="eyebrow">Workflow Signal</p>
              <h3>Delivery runway</h3>
              <p>
                Live distribution across intake, review, build, and release stages.
              </p>
            </div>
            <div className="runway-track">
              {STAGES.map((stage, index) => (
                <article
                  className={`runway-stage${stageCounts[stage] > 0 ? " is-populated" : ""}`}
                  key={stage}
                >
                  <span className="runway-stage__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{stage}</strong>
                  <span>
                    {stageCounts[stage]} ticket{stageCounts[stage] === 1 ? "" : "s"}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section
            className={`view${activeView === "intake" ? " is-active" : ""}`}
            aria-labelledby="intake-title"
          >
            <div className="hero-grid">
              <article className="hero-card hero-card--accent">
                <p className="eyebrow">Main Menu A</p>
                <h3 id="intake-title">Issue a request through one guided channel</h3>
                <p>
                  The form forces requesters to explain the problem, expected
                  outcome, urgency, and business impact before the work enters the
                  board.
                </p>
                <div className="hero-chip-row">
                  <span className="hero-chip">Structured intake</span>
                  <span className="hero-chip">Better scoping</span>
                  <span className="hero-chip">Cleaner handoff</span>
                </div>
              </article>

              <article className="hero-card">
                <p className="eyebrow">Main Menu B</p>
                <h3>Track active work on one kanban board</h3>
                <p>
                  Operations, reviewers, builders, testers, and deployers all
                  share the same status model and ticket history.
                </p>
                <div className="hero-note">
                  Every card keeps the same request narrative, attachments, and
                  activity timeline from intake to deployment.
                </div>
              </article>
            </div>

            <section className="form-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">New Ticket</p>
                  <h3>Create an optimization request</h3>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleSeedExample}
                >
                  Add Sample Request
                </button>
              </div>

              <form className="ticket-form" onSubmit={handleCreateTicket}>
                <label>
                  Ticket title
                  <input
                    name="title"
                    type="text"
                    placeholder="Reduce manual reconciliation for BPO payroll"
                    required
                  />
                </label>

                <div className="field-row">
                  <label>
                    Requesting division
                    <input
                      name="division"
                      type="text"
                      placeholder="BPO Operations"
                      required
                    />
                  </label>
                  <label>
                    Service line
                    <input
                      name="service"
                      type="text"
                      placeholder="Payroll, MPO, Finance Ops"
                      required
                    />
                  </label>
                </div>

                <div className="field-row">
                  <label>
                    Requested by
                    <input
                      name="requester"
                      type="text"
                      placeholder="Division lead or PIC"
                      required
                    />
                  </label>
                  <label>
                    Priority
                    <select defaultValue="Medium" name="priority" required>
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  Current manual process
                  <textarea
                    name="currentProcess"
                    placeholder="Describe the current workflow, handoffs, spreadsheets, approvals, and bottlenecks."
                    required
                    rows={4}
                  ></textarea>
                </label>

                <label>
                  Optimization request detail
                  <textarea
                    name="requestDetail"
                    placeholder="What should be improved, automated, or simplified?"
                    required
                    rows={4}
                  ></textarea>
                </label>

                <div className="field-row">
                  <label>
                    Business impact
                    <textarea
                      name="businessImpact"
                      placeholder="Hours saved, reduced errors, SLA improvement, cost reduction."
                      required
                      rows={3}
                    ></textarea>
                  </label>
                  <label>
                    Success metric
                    <textarea
                      name="successMetric"
                      placeholder="Example: cut manual processing time from 6 hours to 45 minutes."
                      required
                      rows={3}
                    ></textarea>
                  </label>
                </div>

                <label>
                  Attach spreadsheets and images
                  <input
                    accept=".csv,.xlsx,.xls,.ods,image/*"
                    multiple
                    name="attachments"
                    type="file"
                  />
                </label>

                <label>
                  Additional notes
                  <textarea
                    name="notes"
                    placeholder="Dependencies, affected tools, deadlines, or known risks."
                    rows={3}
                  ></textarea>
                </label>

                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    Create Ticket
                  </button>
                  <p className="form-note">
                    New tickets start in <strong>Issue Optimization Request</strong>.
                  </p>
                </div>
              </form>
            </section>
          </section>

          <section
            className={`view${activeView === "board" ? " is-active" : ""}`}
            aria-labelledby="board-title"
          >
            <div className="board-toolbar">
              <div>
                <p className="eyebrow">Shared Board</p>
                <h3 id="board-title">Optimization request kanban</h3>
              </div>
              <div className="filter-row">
                <input
                  placeholder="Search title, division, service..."
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  value={divisionFilter}
                  onChange={(event) => setDivisionFilter(event.target.value)}
                >
                  <option value="">All divisions</option>
                  {divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(event.target.value as "" | Priority)
                  }
                >
                  <option value="">All priorities</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="board-layout">
              <section className="board" aria-label="Kanban board">
                {STAGES.map((stage) => {
                  const stageTickets = filteredTickets.filter(
                    (ticket) => ticket.stage === stage,
                  );

                  return (
                    <section
                      className={`column${dragStage === stage ? " is-drop-target" : ""}`}
                      data-stage={stage}
                      key={stage}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragStage(stage);
                      }}
                      onDragLeave={() => {
                        setDragStage((current) => (current === stage ? null : current));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragStage(null);
                        const ticketId = event.dataTransfer.getData("text/plain");
                        if (ticketId) {
                          updateTicketStage(ticketId, stage, `Dragged to ${stage}.`);
                        }
                      }}
                    >
                      <div className="column-header">
                        <h4>{stage}</h4>
                        <span className="column-count">{stageTickets.length}</span>
                      </div>

                      <div className="column-body">
                        {stageTickets.length === 0 ? (
                          <div className="empty-state">No tickets in this stage.</div>
                        ) : (
                          stageTickets.map((ticket) => (
                            <TicketCard
                              key={ticket.id}
                              onClick={() => setSelectedTicketId(ticket.id)}
                              onDragEnd={() => setDragStage(null)}
                              onDragStart={(event) => {
                                event.dataTransfer.setData("text/plain", ticket.id);
                                setDragStage(stage);
                              }}
                              selected={ticket.id === selectedTicketId}
                              ticket={ticket}
                            />
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </section>

              <aside className="detail-panel">
                {selectedTicket ? (
                  <div className="detail-body">
                    <div>
                      <div className="detail-meta">
                        <span className="ticket-code">{selectedTicket.code}</span>
                        <span
                          className="priority-badge"
                          data-priority={selectedTicket.priority}
                        >
                          {selectedTicket.priority}
                        </span>
                      </div>
                      <h4>{selectedTicket.title}</h4>
                      <p>
                        {selectedTicket.division} • {selectedTicket.service}
                      </p>
                    </div>

                    <div className="detail-actions">
                      <button
                        className="stage-action"
                        disabled={selectedTicket.stage === STAGES[0]}
                        type="button"
                        onClick={() => {
                          const previousStage =
                            STAGES[STAGES.indexOf(selectedTicket.stage) - 1];
                          if (previousStage) {
                            updateTicketStage(
                              selectedTicket.id,
                              previousStage,
                              "Moved backward through the workflow.",
                            );
                          }
                        }}
                      >
                        Move Back
                      </button>

                      <select
                        className="detail-select"
                        value={selectedTicket.stage}
                        onChange={(event) =>
                          updateTicketStage(
                            selectedTicket.id,
                            event.target.value as Stage,
                            "Stage changed from detail panel.",
                          )
                        }
                      >
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>

                      <button
                        className="stage-action"
                        disabled={selectedTicket.stage === STAGES[STAGES.length - 1]}
                        type="button"
                        onClick={() => {
                          const nextStage =
                            STAGES[STAGES.indexOf(selectedTicket.stage) + 1];
                          if (nextStage) {
                            updateTicketStage(
                              selectedTicket.id,
                              nextStage,
                              "Moved forward through the workflow.",
                            );
                          }
                        }}
                      >
                        Move Next
                      </button>
                    </div>

                    <section className="detail-grid">
                      <div className="detail-card">
                        <strong>Requester</strong>
                        <span>{selectedTicket.requester}</span>
                      </div>
                      <div className="detail-card">
                        <strong>Created</strong>
                        <span>{formatDate(selectedTicket.createdAt)}</span>
                      </div>
                    </section>

                    <section>
                      <span className="activity-chip">Current process</span>
                      <p>{selectedTicket.currentProcess}</p>
                    </section>

                    <section>
                      <span className="activity-chip">Optimization request</span>
                      <p>{selectedTicket.requestDetail}</p>
                    </section>

                    <section className="detail-grid">
                      <div className="detail-card">
                        <strong>Business impact</strong>
                        <span>{selectedTicket.businessImpact}</span>
                      </div>
                      <div className="detail-card">
                        <strong>Success metric</strong>
                        <span>{selectedTicket.successMetric}</span>
                      </div>
                    </section>

                    {selectedTicket.notes ? (
                      <section>
                        <span className="activity-chip">Additional notes</span>
                        <p>{selectedTicket.notes}</p>
                      </section>
                    ) : null}

                    <section>
                      <span className="activity-chip">Attachments</span>
                      <div className="attachment-grid">
                        {selectedTicket.attachments.length === 0 ? (
                          <div className="empty-state">
                            No attachments were added to this ticket.
                          </div>
                        ) : (
                          selectedTicket.attachments.map((attachment) => (
                            <AttachmentCard
                              attachment={attachment}
                              key={attachment.id}
                            />
                          ))
                        )}
                      </div>
                    </section>

                    <section>
                      <span className="activity-chip">Activity</span>
                      <div className="activity-list">
                        {selectedTicket.activity.map((item) => (
                          <article
                            className="activity-item"
                            key={`${item.createdAt}-${item.title}-${item.detail}`}
                          >
                            <div className="detail-meta">
                              <strong>{item.title}</strong>
                              <span className="muted">{formatDate(item.createdAt)}</span>
                            </div>
                            <p>{item.detail}</p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section>
                      <span className="activity-chip">Add update</span>
                      <form
                        className="detail-note-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          addDetailNote();
                        }}
                      >
                        <textarea
                          name="note"
                          placeholder="Add review notes, testing findings, revision request, or deployment update."
                          value={detailNote}
                          onChange={(event) => setDetailNote(event.target.value)}
                        ></textarea>
                        <button className="primary-button" type="submit">
                          Save Update
                        </button>
                      </form>
                    </section>
                  </div>
                ) : (
                  <div className="detail-empty">
                    <p className="eyebrow">Ticket Detail</p>
                    <h4>Select a card</h4>
                    <p>
                      Open any ticket to review the request detail, attachments,
                      activity, and next-stage actions.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function StatCard(props: { label: string; meta: string; value: number }) {
  return (
    <article className="stat-card">
      <span className="muted">{props.label}</span>
      <strong>{props.value}</strong>
      <span className="stat-meta">{props.meta}</span>
    </article>
  );
}

function TicketCard(props: {
  ticket: Ticket;
  selected: boolean;
  onClick: () => void;
  onDragStart: DragEventHandler<HTMLButtonElement>;
  onDragEnd: DragEventHandler<HTMLButtonElement>;
}) {
  const { ticket } = props;

  return (
    <button
      className={`ticket-card${props.selected ? " is-selected" : ""}`}
      draggable
      type="button"
      onClick={props.onClick}
      onDragEnd={props.onDragEnd}
      onDragStart={props.onDragStart}
    >
      <div className="ticket-card__meta">
        <span className="ticket-code">{ticket.code}</span>
        <span className="priority-badge" data-priority={ticket.priority}>
          {ticket.priority}
        </span>
      </div>
      <h4 className="ticket-title">{ticket.title}</h4>
      <p className="ticket-subtitle">
        {ticket.division} • {ticket.service}
      </p>
      <p className="ticket-summary">{trimText(ticket.requestDetail, 110)}</p>
      <div className="ticket-card__footer">
        <span className="ticket-owner">{ticket.requester}</span>
        <span className="ticket-attachments">
          {ticket.attachments.length} attachment
          {ticket.attachments.length === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

function AttachmentCard(props: { attachment: AttachmentRecord }) {
  const { attachment } = props;

  return (
    <article className="attachment-item">
      <div className="detail-meta">
        <span className="attachment-pill">{attachment.kind}</span>
        <span className="muted">{formatFileSize(attachment.size)}</span>
      </div>
      <strong>{attachment.name}</strong>
      {attachment.previewDataUrl ? (
        <img alt={attachment.name} src={attachment.previewDataUrl} />
      ) : null}
    </article>
  );
}

function loadInitialTickets(): Ticket[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return buildSeedTickets();
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed as Ticket[];
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return buildSeedTickets();
}

function getStringField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getPriorityField(formData: FormData, key: string): Priority {
  const value = String(formData.get(key) ?? "");
  if (value === "High" || value === "Medium" || value === "Low") {
    return value;
  }
  return "Medium";
}
