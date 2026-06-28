"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { create } from "zustand";

import type { Stage } from "@/constants/stages";
import type { Priority } from "@/constants/priorities";

export type IssueSort = "newest" | "oldest" | "most-commented";

export type UiState = {
  search: string;
  divisionFilter: string;
  priorityFilter: "" | Priority;
  labelFilter: string[];
  assigneeFilter: string[];
  issueTab: "open" | "closed";
  issueSort: IssueSort;
  selectedTicketId: string | null;
  dragStage: Stage | null;
  setSearch: (value: string) => void;
  setDivisionFilter: (value: string) => void;
  setPriorityFilter: (value: "" | Priority) => void;
  toggleLabelFilter: (id: string) => void;
  clearLabelFilter: () => void;
  toggleAssigneeFilter: (id: string) => void;
  clearAssigneeFilter: () => void;
  setIssueTab: (tab: "open" | "closed") => void;
  setIssueSort: (sort: IssueSort) => void;
  setSelectedTicketId: (id: string | null) => void;
  setDragStage: (stage: Stage | null) => void;
};

function makeStore() {
  return create<UiState>((set) => ({
    search: "",
    divisionFilter: "",
    priorityFilter: "",
    labelFilter: [],
    assigneeFilter: [],
    issueTab: "open",
    issueSort: "newest",
    selectedTicketId: null,
    dragStage: null,
    setSearch: (value) => set({ search: value }),
    setDivisionFilter: (value) => set({ divisionFilter: value }),
    setPriorityFilter: (value) => set({ priorityFilter: value }),
    toggleLabelFilter: (id) =>
      set((state) => ({
        labelFilter: state.labelFilter.includes(id)
          ? state.labelFilter.filter((x) => x !== id)
          : [...state.labelFilter, id],
      })),
    clearLabelFilter: () => set({ labelFilter: [] }),
    toggleAssigneeFilter: (id) =>
      set((state) => ({
        assigneeFilter: state.assigneeFilter.includes(id)
          ? state.assigneeFilter.filter((x) => x !== id)
          : [...state.assigneeFilter, id],
      })),
    clearAssigneeFilter: () => set({ assigneeFilter: [] }),
    setIssueTab: (tab) => set({ issueTab: tab }),
    setIssueSort: (sort) => set({ issueSort: sort }),
    setSelectedTicketId: (id) => set({ selectedTicketId: id }),
    setDragStage: (stage) => set({ dragStage: stage }),
  }));
}

type UiStore = ReturnType<typeof makeStore>;

const UiStoreContext = createContext<UiStore | null>(null);

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<UiStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();
  return (
    <UiStoreContext.Provider value={storeRef.current}>
      {children}
    </UiStoreContext.Provider>
  );
}

export function useUiStore<T>(selector: (state: UiState) => T): T {
  const store = useContext(UiStoreContext);
  if (!store) throw new Error("useUiStore must be used within UiStoreProvider");
  return store(selector);
}
