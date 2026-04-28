const STORAGE_KEY = "opsflow-kanban-v1";
const STAGES = [
  "Issue Optimization Request",
  "Review",
  "Revision",
  "Production",
  "Testing",
  "Deployment",
];

const state = {
  tickets: [],
  activeView: "intake",
  selectedTicketId: null,
  search: "",
  division: "",
  priority: "",
};

const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheDom();
  hydrateState();
  wireViewSwitching();
  wireForm();
  wireBoardFilters();
  wireSeedButton();
  render();
}

function cacheDom() {
  refs.statGrid = document.getElementById("statGrid");
  refs.boardColumns = document.getElementById("boardColumns");
  refs.detailPanel = document.getElementById("detailPanel");
  refs.ticketForm = document.getElementById("ticketForm");
  refs.searchInput = document.getElementById("searchInput");
  refs.divisionFilter = document.getElementById("divisionFilter");
  refs.priorityFilter = document.getElementById("priorityFilter");
  refs.seedExampleButton = document.getElementById("seedExampleButton");
  refs.cardTemplate = document.getElementById("ticketCardTemplate");
  refs.navButtons = [...document.querySelectorAll("[data-view-target]")];
  refs.views = {
    intake: document.getElementById("view-intake"),
    board: document.getElementById("view-board"),
  };
}

function hydrateState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state.tickets = JSON.parse(saved);
      state.selectedTicketId = state.tickets[0]?.id ?? null;
      return;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  state.tickets = buildSeedTickets();
  state.selectedTicketId = state.tickets[0]?.id ?? null;
  saveState();
}

function wireViewSwitching() {
  refs.navButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
  });
}

function wireForm() {
  refs.ticketForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(refs.ticketForm);
    const attachments = await normalizeAttachments(formData.getAll("attachments"));

    const ticket = {
      id: crypto.randomUUID(),
      code: buildTicketCode(),
      stage: STAGES[0],
      title: formData.get("title").trim(),
      division: formData.get("division").trim(),
      service: formData.get("service").trim(),
      requester: formData.get("requester").trim(),
      priority: formData.get("priority"),
      currentProcess: formData.get("currentProcess").trim(),
      requestDetail: formData.get("requestDetail").trim(),
      businessImpact: formData.get("businessImpact").trim(),
      successMetric: formData.get("successMetric").trim(),
      notes: formData.get("notes").trim(),
      attachments,
      createdAt: new Date().toISOString(),
      activity: [
        buildActivity(
          "Ticket created",
          "Request entered through the guided intake channel."
        ),
      ],
    };

    state.tickets.unshift(ticket);
    state.selectedTicketId = ticket.id;
    refs.ticketForm.reset();
    setActiveView("board");
    saveState();
    render();
  });
}

function wireBoardFilters() {
  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderBoard();
  });

  refs.divisionFilter.addEventListener("change", (event) => {
    state.division = event.target.value;
    renderBoard();
  });

  refs.priorityFilter.addEventListener("change", (event) => {
    state.priority = event.target.value;
    renderBoard();
  });
}

function wireSeedButton() {
  refs.seedExampleButton.addEventListener("click", () => {
    const sample = buildStandaloneSampleTicket();
    state.tickets.unshift(sample);
    state.selectedTicketId = sample.id;
    setActiveView("board");
    saveState();
    render();
  });
}

function setActiveView(view) {
  state.activeView = view;
  refs.navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewTarget === view);
  });
  Object.entries(refs.views).forEach(([key, element]) => {
    element.classList.toggle("is-active", key === view);
  });
}

function render() {
  renderStats();
  renderDivisionFilter();
  renderBoard();
}

function renderStats() {
  const total = state.tickets.length;
  const inFlight = state.tickets.filter(
    (ticket) => ticket.stage !== "Deployment"
  ).length;
  const deployed = state.tickets.filter(
    (ticket) => ticket.stage === "Deployment"
  ).length;

  refs.statGrid.innerHTML = "";
  [
    { label: "Tickets", value: total },
    { label: "Active", value: inFlight },
    { label: "Deployed", value: deployed },
  ].forEach((stat) => {
    const node = document.createElement("article");
    node.className = "stat-card";
    node.innerHTML = `<span class="muted">${stat.label}</span><strong>${stat.value}</strong>`;
    refs.statGrid.appendChild(node);
  });
}

function renderDivisionFilter() {
  const divisions = [...new Set(state.tickets.map((ticket) => ticket.division))].sort();
  const currentValue = state.division;
  refs.divisionFilter.innerHTML = '<option value="">All divisions</option>';

  divisions.forEach((division) => {
    const option = document.createElement("option");
    option.value = division;
    option.textContent = division;
    if (division === currentValue) {
      option.selected = true;
    }
    refs.divisionFilter.appendChild(option);
  });
}

function renderBoard() {
  const filteredTickets = getFilteredTickets();
  refs.boardColumns.innerHTML = "";

  STAGES.forEach((stage) => {
    const column = document.createElement("section");
    column.className = "column";
    column.dataset.stage = stage;
    column.innerHTML = `
      <div class="column-header">
        <h4>${stage}</h4>
        <span class="column-count">${filteredTickets.filter((ticket) => ticket.stage === stage).length}</span>
      </div>
      <div class="column-body"></div>
    `;

    setupDropTarget(column);

    const body = column.querySelector(".column-body");
    const tickets = filteredTickets.filter((ticket) => ticket.stage === stage);
    if (!tickets.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No tickets in this stage.";
      body.appendChild(empty);
    } else {
      tickets.forEach((ticket) => body.appendChild(renderTicketCard(ticket)));
    }

    refs.boardColumns.appendChild(column);
  });

  renderTicketDetail();
}

function renderTicketCard(ticket) {
  const fragment = refs.cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".ticket-card");
  card.dataset.ticketId = ticket.id;
  card.classList.toggle("is-selected", ticket.id === state.selectedTicketId);
  card.querySelector(".ticket-code").textContent = ticket.code;

  const priority = card.querySelector(".priority-badge");
  priority.dataset.priority = ticket.priority;
  priority.textContent = ticket.priority;

  card.querySelector(".ticket-title").textContent = ticket.title;
  card.querySelector(".ticket-subtitle").textContent = `${ticket.division} • ${ticket.service}`;
  card.querySelector(".ticket-summary").textContent = trimText(ticket.requestDetail, 110);
  card.querySelector(".ticket-owner").textContent = ticket.requester;
  card.querySelector(".ticket-attachments").textContent = `${ticket.attachments.length} attachment${ticket.attachments.length === 1 ? "" : "s"}`;

  card.addEventListener("click", () => {
    state.selectedTicketId = ticket.id;
    renderBoard();
  });

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", ticket.id);
  });

  return fragment;
}

function renderTicketDetail() {
  const ticket = state.tickets.find((item) => item.id === state.selectedTicketId);
  if (!ticket) {
    refs.detailPanel.innerHTML = `
      <div class="detail-empty">
        <p class="eyebrow">Ticket Detail</p>
        <h4>Select a card</h4>
        <p>No matching ticket is selected.</p>
      </div>
    `;
    return;
  }

  refs.detailPanel.innerHTML = `
    <div class="detail-body">
      <div>
        <div class="detail-meta">
          <span class="ticket-code">${ticket.code}</span>
          <span class="priority-badge" data-priority="${ticket.priority}">${ticket.priority}</span>
        </div>
        <h4>${ticket.title}</h4>
        <p>${ticket.division} • ${ticket.service}</p>
      </div>

      <div class="detail-actions">
        <button class="stage-action" data-shift-stage="-1" ${ticket.stage === STAGES[0] ? "disabled" : ""}>
          Move Back
        </button>
        <select class="detail-select" id="detailStageSelect">
          ${STAGES.map(
            (stage) => `<option value="${stage}" ${stage === ticket.stage ? "selected" : ""}>${stage}</option>`
          ).join("")}
        </select>
        <button class="stage-action" data-shift-stage="1" ${ticket.stage === STAGES.at(-1) ? "disabled" : ""}>
          Move Next
        </button>
      </div>

      <section class="detail-grid">
        <div class="detail-card">
          <strong>Requester</strong>
          <span>${ticket.requester}</span>
        </div>
        <div class="detail-card">
          <strong>Created</strong>
          <span>${formatDate(ticket.createdAt)}</span>
        </div>
      </section>

      <section>
        <span class="activity-chip">Current process</span>
        <p>${ticket.currentProcess}</p>
      </section>

      <section>
        <span class="activity-chip">Optimization request</span>
        <p>${ticket.requestDetail}</p>
      </section>

      <section class="detail-grid">
        <div class="detail-card">
          <strong>Business impact</strong>
          <span>${ticket.businessImpact}</span>
        </div>
        <div class="detail-card">
          <strong>Success metric</strong>
          <span>${ticket.successMetric}</span>
        </div>
      </section>

      ${
        ticket.notes
          ? `
      <section>
        <span class="activity-chip">Additional notes</span>
        <p>${ticket.notes}</p>
      </section>
      `
          : ""
      }

      <section>
        <span class="activity-chip">Attachments</span>
        <div class="attachment-grid">
          ${renderAttachments(ticket.attachments)}
        </div>
      </section>

      <section>
        <span class="activity-chip">Activity</span>
        <div class="activity-list">
          ${ticket.activity.map(renderActivityItem).join("")}
        </div>
      </section>

      <section>
        <span class="activity-chip">Add update</span>
        <form class="detail-note-form" id="detailNoteForm">
          <textarea name="note" placeholder="Add review notes, testing findings, revision request, or deployment update."></textarea>
          <button class="primary-button" type="submit">Save Update</button>
        </form>
      </section>
    </div>
  `;

  refs.detailPanel.querySelector("#detailStageSelect").addEventListener("change", (event) => {
    updateTicketStage(ticket.id, event.target.value, "Stage changed from detail panel.");
  });

  refs.detailPanel.querySelectorAll("[data-shift-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const shift = Number(button.dataset.shiftStage);
      const stageIndex = STAGES.indexOf(ticket.stage) + shift;
      const nextStage = STAGES[stageIndex];
      if (nextStage) {
        updateTicketStage(ticket.id, nextStage, `Moved ${shift > 0 ? "forward" : "backward"} through the workflow.`);
      }
    });
  });

  refs.detailPanel.querySelector("#detailNoteForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const textarea = event.currentTarget.elements.note;
    const value = textarea.value.trim();
    if (!value) {
      return;
    }

    const current = getTicketById(ticket.id);
    current.activity.unshift(buildActivity("Manual update added", value));
    saveState();
    renderBoard();
  });
}

function renderAttachments(attachments) {
  if (!attachments.length) {
    return '<div class="empty-state">No attachments were added to this ticket.</div>';
  }

  return attachments
    .map((attachment) => {
      const preview = attachment.previewDataUrl
        ? `<img src="${attachment.previewDataUrl}" alt="${attachment.name}" />`
        : "";

      return `
        <article class="attachment-item">
          <div class="detail-meta">
            <span class="attachment-pill">${attachment.kind}</span>
            <span class="muted">${formatFileSize(attachment.size)}</span>
          </div>
          <strong>${attachment.name}</strong>
          ${preview}
        </article>
      `;
    })
    .join("");
}

function renderActivityItem(item) {
  return `
    <article class="activity-item">
      <div class="detail-meta">
        <strong>${item.title}</strong>
        <span class="muted">${formatDate(item.createdAt)}</span>
      </div>
      <p>${item.detail}</p>
    </article>
  `;
}

function setupDropTarget(column) {
  column.addEventListener("dragover", (event) => {
    event.preventDefault();
    column.classList.add("is-drop-target");
  });

  column.addEventListener("dragleave", () => {
    column.classList.remove("is-drop-target");
  });

  column.addEventListener("drop", (event) => {
    event.preventDefault();
    column.classList.remove("is-drop-target");
    const ticketId = event.dataTransfer.getData("text/plain");
    const nextStage = column.dataset.stage;
    if (ticketId && nextStage) {
      updateTicketStage(ticketId, nextStage, `Dragged to ${nextStage}.`);
    }
  });
}

function updateTicketStage(ticketId, nextStage, detail) {
  const ticket = getTicketById(ticketId);
  if (!ticket || ticket.stage === nextStage) {
    return;
  }

  const previousStage = ticket.stage;
  ticket.stage = nextStage;
  ticket.activity.unshift(
    buildActivity("Stage updated", `${detail} ${previousStage} -> ${nextStage}`)
  );
  state.selectedTicketId = ticketId;
  saveState();
  render();
}

function getFilteredTickets() {
  return state.tickets.filter((ticket) => {
    const matchesSearch =
      !state.search ||
      [ticket.title, ticket.division, ticket.service, ticket.requestDetail]
        .join(" ")
        .toLowerCase()
        .includes(state.search);
    const matchesDivision = !state.division || ticket.division === state.division;
    const matchesPriority = !state.priority || ticket.priority === state.priority;

    return matchesSearch && matchesDivision && matchesPriority;
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tickets));
}

function getTicketById(ticketId) {
  return state.tickets.find((ticket) => ticket.id === ticketId);
}

function buildActivity(title, detail) {
  return {
    title,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function buildTicketCode() {
  return `OPT-${String(Date.now()).slice(-6)}`;
}

async function normalizeAttachments(rawFiles) {
  const files = rawFiles.filter((value) => value instanceof File && value.size > 0);
  const normalized = await Promise.all(files.map(normalizeAttachment));
  return normalized;
}

async function normalizeAttachment(file) {
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.name.match(/\.(csv|xlsx|xls|ods)$/i)
      ? "spreadsheet"
      : "file";

  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    kind,
    previewDataUrl:
      kind === "image" && file.size < 900_000 ? await readFileAsDataUrl(file) : "",
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function trimText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSeedTickets() {
  return [
    {
      id: crypto.randomUUID(),
      code: "OPT-420381",
      stage: "Review",
      title: "Automate invoice validation before MPO month-end close",
      division: "MPO Finance",
      service: "Invoice Reconciliation",
      requester: "Nadia Putri",
      priority: "High",
      currentProcess:
        "Analysts compare vendor spreadsheets against ERP exports by hand and flag mismatches over email.",
      requestDetail:
        "Introduce a validation workflow that checks duplicate invoice numbers, missing PO references, and amount mismatches before month-end review.",
      businessImpact:
        "Reduce late close risk and prevent repeat rework across the finance operations team.",
      successMetric:
        "Shrink validation time from 5 hours per batch to under 1 hour while reducing mismatch escapes by 80%.",
      notes: "ERP export format is stable. Vendor submission formats vary.",
      attachments: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
      activity: [
        {
          title: "Review started",
          detail: "Business analyst is validating scope and source files.",
          createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        },
        {
          title: "Ticket created",
          detail: "Request entered through the guided intake channel.",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      code: "OPT-420117",
      stage: "Production",
      title: "Consolidate BPO attendance cleanup into one exception queue",
      division: "BPO Operations",
      service: "Attendance Management",
      requester: "Rizal Hidayat",
      priority: "Medium",
      currentProcess:
        "Supervisors update three different attendance sheets and a final summary file before payroll cutoff.",
      requestDetail:
        "Create a single intake and exception handling flow that groups missing logs, suspicious overtime, and unresolved leave entries.",
      businessImpact:
        "Reduce duplicate checks across team leads and payroll administrators.",
      successMetric:
        "Cut pre-payroll attendance cleanup from 7 touchpoints to 2 and reduce missed exception follow-ups.",
      notes: "Attendance logs come from biometric export plus HRIS leave records.",
      attachments: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      activity: [
        {
          title: "Build approved",
          detail: "Workflow logic accepted after revision.",
          createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      code: "OPT-419552",
      stage: "Testing",
      title: "Standardize client onboarding handoff for shared services",
      division: "Shared Services",
      service: "Client Onboarding",
      requester: "Melissa Tan",
      priority: "Low",
      currentProcess:
        "Each team uses its own checklist and sends screenshots through chat during onboarding approval.",
      requestDetail:
        "Standardize the checklist, collect approvals in one place, and make missing documents visible before production handoff.",
      businessImpact:
        "Reduce onboarding delays and improve audit readiness.",
      successMetric:
        "Cut average onboarding coordination delay from 2 business days to same-day completion.",
      notes: "Need to align legal, finance, and delivery onboarding checkpoints.",
      attachments: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
      activity: [
        {
          title: "Testing started",
          detail: "UAT team is validating the checklist flow.",
          createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        },
      ],
    },
  ];
}

function buildStandaloneSampleTicket() {
  return {
    id: crypto.randomUUID(),
    code: buildTicketCode(),
    stage: "Issue Optimization Request",
    title: "Reduce manual QA evidence collection",
    division: "Quality Assurance",
    service: "Audit and Compliance",
    requester: "Sample PIC",
    priority: "Medium",
    currentProcess:
      "Team members capture screenshots manually, rename files by hand, then compile evidence in spreadsheets before review.",
    requestDetail:
      "Create a structured evidence submission flow with required fields and a cleaner approval handoff.",
    businessImpact:
      "Reduce turnaround time for recurring audits and prevent missing evidence.",
    successMetric:
      "Shorten evidence preparation from 3 hours to 45 minutes per audit cycle.",
    notes: "Sample ticket injected from the intake screen.",
    attachments: [],
    createdAt: new Date().toISOString(),
    activity: [buildActivity("Ticket created", "Sample ticket added from the intake screen.")],
  };
}
