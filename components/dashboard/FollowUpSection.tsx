"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { fetchFollowUps } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import type { FollowUpData, FollowUpList } from "@/types";

interface FollowUpSectionProps {
  onSelectContact?: (contactId: string) => void;
}

export function FollowUpSection({ onSelectContact }: FollowUpSectionProps) {
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    fetchFollowUps(20)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const totalCount = data?.lists.reduce((sum, l) => sum + l.count, 0) ?? 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-text-muted" />
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Follow-up smart lists
          </h3>
          {data && totalCount > 0 && (
            <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
              {totalCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md p-1 text-text-muted hover:bg-surface-hover disabled:opacity-50"
          aria-label="Refresh follow-up lists"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!data && !error && (
        <p className="text-xs text-text-muted">Loading…</p>
      )}
      {data && (
        <div className="space-y-1.5">
          {data.lists.map((list) => (
            <SmartListRow
              key={list.key}
              list={list}
              expanded={expandedKey === list.key}
              onToggle={() =>
                setExpandedKey(expandedKey === list.key ? null : list.key)
              }
              onSelectContact={onSelectContact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SmartListRow({
  list,
  expanded,
  onToggle,
  onSelectContact,
}: {
  list: FollowUpList;
  expanded: boolean;
  onToggle: () => void;
  onSelectContact?: (contactId: string) => void;
}) {
  const accent =
    list.count === 0
      ? "text-text-muted"
      : list.key === "high_spender_inactive" || list.key === "vip_inactive_14d"
        ? "text-amber-400"
        : list.key === "never_purchased"
          ? "text-violet-400"
          : "text-rose-400";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-hover"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              {list.title}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${accent}`}>
              {list.count}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">{list.description}</p>
        </div>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="border-t border-border">
          {list.items.length === 0 ? (
            <p className="px-3 py-3 text-xs text-text-muted">
              No fans match this list.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectContact?.(item.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover"
                  >
                    <Avatar
                      initials={item.avatar}
                      colorClass={item.avatarColor}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">
                        {item.name}
                      </p>
                      <p className="truncate text-[11px] text-text-muted">
                        @{item.username}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                      {item.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
