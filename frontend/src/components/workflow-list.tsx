// src/components/workflow-list.tsx
"use client";

import { useState, useMemo, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Workflow = {
  _id: string;
  name: string;
  status: "active" | "inactive" | "draft" | string;
  description?: string;
  createdAt: string;
};

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ["all", "active", "inactive", "draft"];
const SORT_OPTIONS = [
  { value: "newest",       label: "Newest first" },
  { value: "oldest",       label: "Oldest first" },
  { value: "alphabetical", label: "A → Z" },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function WorkflowList({ workflows = [], loading = false }: { workflows?: Workflow[], loading?: boolean }) {
  const [query,  setQuery]  = useState("");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const debouncedQuery = useDebounce(query, 300);

  const filteredWorkflows = useMemo(() => {
   let result = Array.isArray(workflows) ? [...workflows] : [];

    // 1. Search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name?.toLowerCase().includes(q) ||
          w.description?.toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (status !== "all") {
      result = result.filter((w) => w.status === status);
    }

    // 3. Sort (Fixed the Date issue)
    result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (sortBy === "newest") return dateB - dateA;
      if (sortBy === "oldest") return dateA - dateB;
      if (sortBy === "alphabetical") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });

    return result;
  }, [workflows, debouncedQuery, status, sortBy]);

  const hasActiveFilters = query || status !== "all" || sortBy !== "newest";

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setSortBy("newest");
  }

  if (loading) {
    return <div className="p-4 border rounded-xl animate-pulse bg-muted/50 h-32 w-full"></div>;
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search workflows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm capitalize focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Result meta row ── */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {filteredWorkflows.length} of {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
        </span>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-blue-500 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Empty state ── */}
      {filteredWorkflows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 text-center dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No workflows found</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
            {query ? `No results for "${query}". Try a different search.` : "Try adjusting your filters."}
          </p>
        </div>
      )}

      {/* ── Workflow list ── */}
      {filteredWorkflows.length > 0 && (
        <ul className="space-y-2">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard key={workflow._id} workflow={workflow} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Workflow card ─────────────────────────────────────────────────────────────
function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const statusColors: Record<string, string> = {
    active:   "bg-green-100  text-green-700  dark:bg-green-900  dark:text-green-300",
    inactive: "bg-gray-100   text-gray-600   dark:bg-gray-800   dark:text-gray-400",
    draft:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  };

  const badge = statusColors[workflow.status] || statusColors.inactive;

  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {workflow.name}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge}`}>
            {workflow.status}
          </span>
        </div>
        {workflow.description && (
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {workflow.description}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
          Created {new Date(workflow.createdAt).toLocaleDateString()}
        </p>
      </div>
    </li>
  );
}