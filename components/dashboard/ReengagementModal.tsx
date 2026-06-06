"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import {
  fetchReengagementAudiences,
  sendReengagementCampaign,
} from "@/lib/api";
import type {
  BroadcastTrigger,
  ReengagementAudiences,
} from "@/types";

interface ReengagementModalProps {
  open: boolean;
  onClose: () => void;
  onSent?: () => Promise<unknown> | unknown;
}

interface SegmentMeta {
  key: BroadcastTrigger;
  title: string;
  description: string;
}

const SEGMENT_META: SegmentMeta[] = [
  {
    key: "no_message_7d",
    title: "No message in 7 days",
    description: "Fans you haven't replied to in a week",
  },
  {
    key: "no_purchase_30d",
    title: "No purchase in 30 days",
    description: "Previous buyers at risk of churning",
  },
  {
    key: "vip_inactive_14d",
    title: "VIP inactive for 14 days",
    description: "VIP-tier fans who went quiet",
  },
  {
    key: "high_spender_inactive",
    title: "High spender inactive",
    description: "Top spenders (≥$200) silent for 30+ days",
  },
  {
    key: "no_ppv_30d",
    title: "No PPV purchase in 30 days",
    description: "Past PPV buyers who stopped unlocking",
  },
  {
    key: "never_purchased",
    title: "Never purchased",
    description: "Engaged fans who never bought",
  },
];

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-1 focus:ring-accent/20";

export function ReengagementModal({
  open,
  onClose,
  onSent,
}: ReengagementModalProps) {
  const [counts, setCounts] = useState<ReengagementAudiences | null>(null);
  const [selectedKey, setSelectedKey] = useState<BroadcastTrigger | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setResult("");
    fetchReengagementAudiences()
      .then((res) => setCounts(res.counts))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, [open]);

  if (!open) return null;

  const selectedCount =
    selectedKey && counts ? counts[selectedKey] : null;

  const insertToken = (token: string) => {
    setMessage((prev) => `${prev}${prev ? " " : ""}{${token}}`);
  };

  const handleSend = async () => {
    if (!selectedKey || !name.trim() || !message.trim() || sending) return;
    const audienceSize = selectedCount ?? 0;
    if (
      !confirm(
        `Send this re-engagement campaign to ${audienceSize} fans?`,
      )
    ) {
      return;
    }
    setSending(true);
    setError("");
    setResult("");
    try {
      const response = await sendReengagementCampaign({
        name: name.trim(),
        message: message.trim(),
        segmentKey: selectedKey,
      });
      setResult(
        `Sent ${response.sentCount} of ${response.count} fans.`,
      );
      setName("");
      setMessage("");
      setSelectedKey(null);
      const refreshed = await fetchReengagementAudiences();
      setCounts(refreshed.counts);
      await onSent?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to send campaign",
      );
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
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold">Re-engagement campaigns</h2>
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
            <Section title="Pick a segment">
              {!counts && !error && (
                <p className="text-xs text-text-muted">Loading…</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {SEGMENT_META.map((segment) => {
                  const count = counts ? counts[segment.key] : null;
                  const isSelected = selectedKey === segment.key;
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      onClick={() => setSelectedKey(segment.key)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "border-border-focus bg-surface-active"
                          : "border-border bg-surface-card hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {segment.title}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-revenue">
                          {count ?? "—"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {segment.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Composer">
              <div className="space-y-3">
                <Field label="Campaign name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Win back inactive buyers"
                  />
                </Field>
                <Field label="Message">
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Hey {name}, we miss you..."
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    Tokens
                  </span>
                  <button
                    type="button"
                    onClick={() => insertToken("name")}
                    className="rounded-md bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:bg-surface-active"
                  >
                    {`{name}`}
                  </button>
                </div>

                {error && <p className="text-xs text-rose-400">{error}</p>}
                {result && <p className="text-xs text-emerald-400">{result}</p>}

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={
                    sending ||
                    !selectedKey ||
                    !name.trim() ||
                    !message.trim() ||
                    (selectedCount ?? 0) === 0
                  }
                  className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {sending
                    ? "Sending..."
                    : selectedKey && selectedCount
                      ? `Send to ${selectedCount} fans`
                      : "Pick a segment to send"}
                </button>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
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
