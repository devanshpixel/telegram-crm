"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { importTelegramContacts, importTelegramMessages } from "@/lib/api";
import type { DashboardStats } from "@/types";
import { BarChart3, Download, Loader2, MessageCircle, Radio, RefreshCw, Send, Sparkles, Wallet } from "lucide-react";

interface TopStatsBarProps {
  stats: DashboardStats;
  authenticated: boolean;
  onConnectTelegram: () => void;
  onOpenAnalytics?: () => void;
  onOpenBroadcast?: () => void;
  onOpenReengagement?: () => void;
}

export function TopStatsBar({
  stats,
  authenticated,
  onConnectTelegram,
  onOpenAnalytics,
  onOpenBroadcast,
  onOpenReengagement,
}: TopStatsBarProps) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setImportStatus("");
    try {
      const result = await importTelegramContacts();
      setImportStatus(`Imported ${result.imported} of ${result.total}`);
      window.location.reload();
    } catch (e) {
      setImportStatus(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus("");
    try {
      const result = await importTelegramMessages();
      setSyncStatus(`Synced ${result.messagesImported} new messages`);
      window.location.reload();
    } catch (e) {
      setSyncStatus(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-black px-4 py-3 sm:px-5 lg:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-muted shadow-glow">
          <span className="text-sm font-bold text-white">L</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight sm:text-base">
            Lustify CRM
          </h1>
          <p className="hidden text-[11px] text-text-muted xs:block">
            Telegram inbox
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <StatPill
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Chats"
          value={String(stats.totalChats)}
        />
        <StatPill
          icon={<Radio className="h-3.5 w-3.5 text-emerald-400" />}
          label="Online"
          value={String(stats.onlineCount)}
          highlight
        />
        <StatPill
          icon={<Wallet className="h-3.5 w-3.5 text-revenue" />}
          label="Revenue"
          value={formatCurrency(stats.totalRevenue, true)}
          highlight
          className="hidden sm:flex"
        />
        {!authenticated ? (
          <button
            type="button"
            onClick={onConnectTelegram}
            className="flex items-center gap-1.5 rounded-xl border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-accent hover:bg-accent/20 sm:px-3 sm:py-2"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden text-xs font-medium sm:inline">Connect Telegram</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              aria-label="Import contacts from Telegram"
              title={importStatus || "Import contacts from Telegram"}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 text-text-secondary hover:bg-surface-hover disabled:opacity-50 sm:px-3 sm:py-2"
            >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="hidden text-xs font-medium sm:inline">
            {importing ? "Importing..." : "Import"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          aria-label="Sync messages from Telegram"
          title={syncStatus || "Sync messages from Telegram"}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 text-text-secondary hover:bg-surface-hover disabled:opacity-50 sm:px-3 sm:py-2"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="hidden text-xs font-medium sm:inline">
            {syncing ? "Syncing..." : "Sync"}
          </span>
        </button>
        {onOpenBroadcast && (
          <button
            type="button"
            onClick={onOpenBroadcast}
            aria-label="Open broadcast"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 text-text-secondary hover:bg-surface-hover sm:px-3 sm:py-2"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden text-xs font-medium sm:inline">Broadcast</span>
          </button>
        )}
          </>
        )}
      </div>
    </header>
  );
}

function StatPill({
  icon,
  label,
  value,
  highlight,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-border bg-surface-card px-2.5 py-1.5 sm:px-3 sm:py-2 ${className ?? ""}`}
    >
      {icon}
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-wider text-text-muted sm:text-[10px]">
          {label}
        </p>
        <p
          className={`text-xs font-semibold tabular-nums sm:text-sm ${highlight ? "text-text-primary" : "text-text-secondary"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
