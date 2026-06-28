"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { nanoid } from "nanoid";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { STAGES, type Stage } from "@/constants/stages";
import {
  buildSeedLabels,
  buildSeedTickets,
  buildSeedUsers,
  buildTicketCode,
} from "@/lib/seed";
import type {
  ActivityItem,
  AttachmentRecord,
  Comment,
  Label,
  Ticket,
  User,
} from "@/types/domain";
import type { Priority } from "@/constants/priorities";

const PERSIST_KEY = "opsflow-data-v1";

export type CreateTicketInput = {
  title: string;
  body: string;
  division: string;
  service: string;
  requester: string;
  priority: Priority;
  currentProcess: string;
  requestDetail: string;
  businessImpact: string;
  successMetric: string;
  notes: string;
  attachments: AttachmentRecord[];
};

export type DataState = {
  tickets: Ticket[];
  labels: Label[];
  users: User[];
  createTicket: (input: CreateTicketInput) => Ticket;
  patchTicket: (id: string, patch: Partial<Omit<Ticket, "id">>) => void;
  moveStage: (id: string, nextStage: Stage, detail?: string) => void;
  closeIssue: (id: string) => void;
  reopenIssue: (id: string) => void;
  setTicketLabels: (id: string, labelIds: string[]) => void;
  setTicketAssignees: (id: string, userIds: string[]) => void;
  addComment: (ticketId: string, authorId: string, body: string) => void;
  createLabel: (input: { name: string; color: string; description?: string }) => Label;
  addAttachments: (ticketId: string, attachments: AttachmentRecord[]) => void;
  addManualNote: (ticketId: string, body: string) => void;
  getTicketByCode: (code: string) => Ticket | undefined;
};

function activity(title: string, detail: string): ActivityItem {
  return {
    id: nanoid(10),
    title,
    detail,
    createdAt: new Date().toISOString(),
  };
}

function withActivity(ticket: Ticket, item: ActivityItem): Ticket {
  return { ...ticket, activity: [item, ...ticket.activity] };
}

function makeStore() {
  return create<DataState>()(
    persist(
      (set, get) => ({
        tickets: buildSeedTickets(),
        labels: buildSeedLabels(),
        users: buildSeedUsers(),

        createTicket(input) {
          const ticket: Ticket = {
            id: nanoid(12),
            code: buildTicketCode(),
            state: "open",
            stage: STAGES[0],
            title: input.title,
            body: input.body || input.requestDetail,
            division: input.division,
            service: input.service,
            requester: input.requester,
            priority: input.priority,
            currentProcess: input.currentProcess,
            requestDetail: input.requestDetail,
            businessImpact: input.businessImpact,
            successMetric: input.successMetric,
            notes: input.notes,
            attachments: input.attachments,
            labels: [],
            assignees: [],
            comments: [],
            createdAt: new Date().toISOString(),
            activity: [
              activity(
                "Ticket created",
                "Request entered through the guided intake channel.",
              ),
            ],
          };
          set((state) => ({ tickets: [ticket, ...state.tickets] }));
          return ticket;
        },

        patchTicket(id, patch) {
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === id ? { ...ticket, ...patch } : ticket,
            ),
          }));
        },

        moveStage(id, nextStage, detail) {
          set((state) => ({
            tickets: state.tickets.map((ticket) => {
              if (ticket.id !== id || ticket.stage === nextStage) {
                return ticket;
              }
              const note = detail ?? "Stage updated.";
              return withActivity(
                { ...ticket, stage: nextStage },
                activity(
                  "Stage updated",
                  `${note} ${ticket.stage} -> ${nextStage}`,
                ),
              );
            }),
          }));
        },

        closeIssue(id) {
          set((state) => ({
            tickets: state.tickets.map((ticket) => {
              if (ticket.id !== id || ticket.state === "closed") return ticket;
              return withActivity(
                { ...ticket, state: "closed", closedAt: new Date().toISOString() },
                activity("Issue closed", "Marked as closed."),
              );
            }),
          }));
        },

        reopenIssue(id) {
          set((state) => ({
            tickets: state.tickets.map((ticket) => {
              if (ticket.id !== id || ticket.state === "open") return ticket;
              return withActivity(
                { ...ticket, state: "open", closedAt: undefined },
                activity("Issue reopened", "Marked as open again."),
              );
            }),
          }));
        },

        setTicketLabels(id, labelIds) {
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === id
                ? withActivity(
                    { ...ticket, labels: labelIds },
                    activity("Labels updated", `${labelIds.length} label(s) applied.`),
                  )
                : ticket,
            ),
          }));
        },

        setTicketAssignees(id, userIds) {
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === id
                ? withActivity(
                    { ...ticket, assignees: userIds },
                    activity(
                      "Assignees updated",
                      `${userIds.length} assignee(s) on the issue.`,
                    ),
                  )
                : ticket,
            ),
          }));
        },

        addComment(ticketId, authorId, body) {
          const comment: Comment = {
            id: nanoid(10),
            authorId,
            body,
            createdAt: new Date().toISOString(),
          };
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === ticketId
                ? withActivity(
                    { ...ticket, comments: [...ticket.comments, comment] },
                    activity("Comment added", `${authorId} commented.`),
                  )
                : ticket,
            ),
          }));
        },

        createLabel(input) {
          const label: Label = {
            id: nanoid(10),
            name: input.name.trim().toLowerCase(),
            color: input.color,
            description: input.description?.trim() || undefined,
          };
          const exists = get().labels.find((l) => l.name === label.name);
          if (exists) return exists;
          set((state) => ({ labels: [...state.labels, label] }));
          return label;
        },

        addAttachments(ticketId, attachments) {
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === ticketId
                ? withActivity(
                    {
                      ...ticket,
                      attachments: [...ticket.attachments, ...attachments],
                    },
                    activity(
                      "Attachments added",
                      `${attachments.length} attachment(s) added.`,
                    ),
                  )
                : ticket,
            ),
          }));
        },

        addManualNote(ticketId, body) {
          set((state) => ({
            tickets: state.tickets.map((ticket) =>
              ticket.id === ticketId
                ? withActivity(ticket, activity("Manual update added", body))
                : ticket,
            ),
          }));
        },

        getTicketByCode(code) {
          return get().tickets.find((ticket) => ticket.code === code);
        },
      }),
      {
        name: PERSIST_KEY,
        storage: createJSONStorage(() => localStorage),
        skipHydration: true,
        version: 1,
      },
    ),
  );
}

type DataStore = ReturnType<typeof makeStore>;

const DataStoreContext = createContext<DataStore | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<DataStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;
    void store.persist.rehydrate()?.then(() => setHydrated(true));
    if (store.persist.hasHydrated()) setHydrated(true);
    const unsub = store.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);

  return (
    <DataStoreContext.Provider value={storeRef.current}>
      {hydrated ? (
        children
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
          Loading…
        </div>
      )}
    </DataStoreContext.Provider>
  );
}

function useStore(): UseBoundStore<StoreApi<DataState>> {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("useDataStore must be used within DataStoreProvider");
  }
  return store;
}

export function useDataStore<T>(selector: (state: DataState) => T): T {
  return useStore()(selector);
}

export function useDataActions(): Pick<
  DataState,
  | "createTicket"
  | "patchTicket"
  | "moveStage"
  | "closeIssue"
  | "reopenIssue"
  | "setTicketLabels"
  | "setTicketAssignees"
  | "addComment"
  | "createLabel"
  | "addAttachments"
  | "addManualNote"
  | "getTicketByCode"
> {
  const store = useStore();
  return store.getState();
}
