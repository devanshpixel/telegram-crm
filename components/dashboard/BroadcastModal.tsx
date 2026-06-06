"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import {
  fetchBroadcasts,
  previewBroadcastAudience,
  sendBroadcast,
} from "@/lib/api";
import type { Broadcast, BroadcastFilters } from "@/types";

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  onSent?: () => Promise<unknown> | unknown;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-1 focus:ring-accent/20";

export function BroadcastModal({ open, onClose, onSent }: BroadcastModalProps) {
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState("");
  const [vipLevel, setVipLevel] = useState<BroadcastFilters["vipLevel"]>("");
  const [fanStatus, setFanStatus] = useState<BroadcastFilters["fanStatus"]>("");
  const [minTotalSpent, setMinTotalSpent] = useState("");
  const [minFanScore, setMinFanScore] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    fetchBroadcasts()
      .then(setHistory)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [open]);

  if (!open) return null;

  const filters = buildFilters({
    tags,
    vipLevel,
    fanStatus,
    minTotalSpent,
    minFanScore,
  });

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const preview = await previewBroadcastAudience(filters);
      setAudienceCount(preview.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to preview audience");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!name.trim() || !message.trim() || !audienceCount || sending) return;
    if (!confirm(`Send this broadcast to ${audienceCount} Telegram contacts?`)) {
      return;
    }
    setSending(true);
    setError("");
    setResult("");
    try {
      const response = await sendBroadcast({
        name: name.trim(),
        message: message.trim(),
        filters,
      });
      setResult(
        `Sent ${response.sentCount} of ${response.broadcast.recipientCount} contacts.`,
      );
      setName("");
      setMessage("");
      setAudienceCount(null);
      setHistory(await fetchBroadcasts());
      await onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-panel">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-telegram" />
            <h2 className="text-base font-semibold">Broadcast</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          <div className="space-y-6">
            <Section title="Audience builder">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tags (any match)">
                  <input
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      setAudienceCount(null);
                    }}
                    className={inputClass}
                    placeholder="vip, whale, ppv"
                  />
                </Field>
                <Field label="VIP level">
                  <select
                    value={vipLevel}
                    onChange={(e) => {
                      setVipLevel(e.target.value as BroadcastFilters["vipLevel"]);
                      setAudienceCount(null);
                    }}
                    className={inputClass}
                  >
                    <option value="">Any</option>
                    <option value="none">None</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                  </select>
                </Field>
                <Field label="Fan status">
                  <select
                    value={fanStatus}
                    onChange={(e) => {
                      setFanStatus(e.target.value as BroadcastFilters["fanStatus"]);
                      setAudienceCount(null);
                    }}
                    className={inputClass}
                  >
                    <option value="">Any</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="churned">Churned</option>
                    <option value="new">New</option>
                  </select>
                </Field>
                <Field label="Minimum total spent">
                  <input
                    type="number"
                    min={0}
                    value={minTotalSpent}
                    onChange={(e) => {
                      setMinTotalSpent(e.target.value);
                      setAudienceCount(null);
                    }}
                    className={inputClass}
                    placeholder="200"
                  />
                </Field>
                <Field label="Minimum fan score">
                  <input
                    type="number"
                    min={0}
                    value={minFanScore}
                    onChange={(e) => {
                      setMinFanScore(e.target.value);
                      setAudienceCount(null);
                    }}
                    className={inputClass}
                    placeholder="70"
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
                  >
                    {loading ? "Checking..." : "Preview audience"}
                  </button>
                  <div className="min-w-24 rounded-xl bg-surface-card px-3 py-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      Matches
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-revenue">
                      {audienceCount ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Composer">
              <div className="space-y-3">
                <Field label="Broadcast name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Weekend PPV push"
                  />
                </Field>
                <Field label="Message">
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Write the Telegram message..."
                  />
                </Field>

                {error && <p className="text-xs text-rose-400">{error}</p>}
                {result && <p className="text-xs text-emerald-400">{result}</p>}

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={
                    sending || !name.trim() || !message.trim() || !audienceCount
                  }
                  className="w-full rounded-xl bg-telegram px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {sending
                    ? "Sending..."
                    : audienceCount
                      ? `Send to ${audienceCount} contacts`
                      : "Preview audience before sending"}
                </button>
              </div>
            </Section>

            <Section title="Broadcast history">
              {history.length === 0 ? (
                <p className="text-xs text-text-muted">No broadcasts yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((broadcast) => (
                    <li
                      key={broadcast.id}
                      className="rounded-lg bg-surface-card px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{broadcast.name}</span>
                        <span className="shrink-0 text-xs text-telegram">
                          {broadcast.sentCount}/{broadcast.recipientCount} sent
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {new Date(broadcast.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildFilters(input: {
  tags: string;
  vipLevel: BroadcastFilters["vipLevel"];
  fanStatus: BroadcastFilters["fanStatus"];
  minTotalSpent: string;
  minFanScore: string;
}): BroadcastFilters {
  return {
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    vipLevel: input.vipLevel,
    fanStatus: input.fanStatus,
    minTotalSpent: input.minTotalSpent ? Number(input.minTotalSpent) : undefined,
    minFanScore: input.minFanScore ? Number(input.minFanScore) : undefined,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
