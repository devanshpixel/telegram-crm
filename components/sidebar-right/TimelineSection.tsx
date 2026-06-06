"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  StickyNote,
  Tag,
  X,
  Activity,
} from "lucide-react";
import { fetchTimeline } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { TimelineEvent } from "@/types";

interface TimelineSectionProps {
  contactId: string;
}

export function TimelineSection({ contactId }: TimelineSectionProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchTimeline(contactId, 50)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <section className="border-b border-border px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" />
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Activity timeline
        </h3>
      </div>

      {loading && <p className="text-xs text-text-muted">Loading...</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="text-xs text-text-muted">No activity yet.</p>
      )}
      {!loading && !error && events.length > 0 && (
        <ol className="space-y-2.5">
          {events.map((event) => (
            <TimelineItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const config = getEventConfig(event);
  return (
    <li className="flex gap-2.5">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
        <config.icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-text-primary">
          <span className="font-medium">{config.label}</span>
          {event.text && (
            <span className="text-text-secondary"> · {truncate(event.text, 60)}</span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          {formatTimestamp(event.timestamp)}
        </p>
      </div>
    </li>
  );
}

function getEventConfig(event: TimelineEvent) {
  switch (event.type) {
    case "message_in":
      return {
        icon: ArrowDownLeft,
        label: "Message received",
        bg: "bg-sky-500/10",
        iconColor: "text-sky-400",
      };
    case "message_out":
      return {
        icon: ArrowUpRight,
        label: "Message sent",
        bg: "bg-emerald-500/10",
        iconColor: "text-emerald-400",
      };
    case "purchase":
      return {
        icon: ShoppingCart,
        label: event.amount ? `Purchase · ${formatCurrency(event.amount, true)}` : "Purchase",
        bg: "bg-revenue-glow",
        iconColor: "text-revenue",
      };
    case "note":
      return {
        icon: StickyNote,
        label: "Note added",
        bg: "bg-amber-500/10",
        iconColor: "text-amber-400",
      };
    case "tag_added":
      return {
        icon: Tag,
        label: "Tag added",
        bg: "bg-violet-500/10",
        iconColor: "text-violet-400",
      };
    case "tag_removed":
      return {
        icon: X,
        label: "Tag removed",
        bg: "bg-rose-500/10",
        iconColor: "text-rose-400",
      };
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
