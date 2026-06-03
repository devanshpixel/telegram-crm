"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addNoteApi,
  addTagApi,
  createMessageApi,
  deleteContactApi,
  deleteTagApi,
  fetchChats,
  fetchContact,
  fetchMessages,
  fetchStats,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Chat, ContactProfile, DashboardStats, Message } from "@/types";
import { SidebarLeft } from "@/components/sidebar-left/SidebarLeft";
import { ConversationView } from "@/components/conversation/ConversationView";
import { SidebarRight } from "@/components/sidebar-right/SidebarRight";
import { TopStatsBar } from "./TopStatsBar";
import { CreateContactModal } from "@/components/forms/CreateContactModal";

type MobilePanel = "list" | "chat" | "crm";

interface DashboardProps {
  initialChats: Chat[];
  initialStats: DashboardStats;
}

function reviveChats(chats: Chat[]): Chat[] {
  return chats.map((c) => ({
    ...c,
    lastMessageTime: new Date(c.lastMessageTime),
  }));
}

export function Dashboard({ initialChats, initialStats }: DashboardProps) {
  const [chats, setChats] = useState<Chat[]>(() => reviveChats(initialChats));
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [activeChatId, setActiveChatId] = useState<string>(
    initialChats[0]?.id ?? "",
  );
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [profiles, setProfiles] = useState<Record<string, ContactProfile>>({});
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeProfile = profiles[activeChatId];
  const activeMessages = messages[activeChatId] ?? [];

  const refreshAll = useCallback(async () => {
    const [nextChats, nextStats] = await Promise.all([fetchChats(), fetchStats()]);
    setChats(nextChats);
    setStats(nextStats);
    return nextChats;
  }, []);

  const loadProfile = useCallback(async (contactId: string) => {
    const profile = await fetchContact(contactId);
    setProfiles((prev) => ({ ...prev, [contactId]: profile }));
    return profile;
  }, []);

  const loadMessages = useCallback(async (contactId: string) => {
    setLoadingMessages(true);
    try {
      const msgs = await fetchMessages(contactId);
      setMessages((prev) => ({ ...prev, [contactId]: msgs }));
      return msgs;
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    void loadProfile(activeChatId);
    void loadMessages(activeChatId);
  }, [activeChatId, loadProfile, loadMessages]);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setMobilePanel("chat");
  }, []);

  const handleBackToList = useCallback(() => {
    setMobilePanel("list");
  }, []);

  const handleOpenCrm = useCallback(() => {
    setMobilePanel("crm");
  }, []);

  const handleCloseCrm = useCallback(() => {
    setMobilePanel("chat");
  }, []);

  const handleContactCreated = useCallback(
    async (profile: ContactProfile) => {
      const nextChats = await refreshAll();
      setActiveChatId(profile.id);
      setProfiles((prev) => ({ ...prev, [profile.id]: profile }));
      setMobilePanel(nextChats.length > 1 ? "chat" : "chat");
    },
    [refreshAll],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeChatId) return;
      const message = await createMessageApi(activeChatId, text);
      setMessages((prev) => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] ?? []), message],
      }));
      await refreshAll();
    },
    [activeChatId, refreshAll],
  );

  const handleAddNote = useCallback(
    async (content: string) => {
      if (!activeChatId) return;
      const profile = await addNoteApi(activeChatId, content);
      setProfiles((prev) => ({ ...prev, [activeChatId]: profile }));
    },
    [activeChatId],
  );

  const handleAddTag = useCallback(
    async (name: string) => {
      if (!activeChatId) return;
      const profile = await addTagApi(activeChatId, name);
      setProfiles((prev) => ({ ...prev, [activeChatId]: profile }));
      await refreshAll();
    },
    [activeChatId, refreshAll],
  );

  const handleDeleteTag = useCallback(
    async (name: string) => {
      if (!activeChatId) return;
      const profile = await deleteTagApi(activeChatId, name);
      setProfiles((prev) => ({ ...prev, [activeChatId]: profile }));
      await refreshAll();
    },
    [activeChatId, refreshAll],
  );

  const handleDeleteContact = useCallback(async () => {
    if (!activeChatId) return;
    if (!confirm("Delete this contact and all related data?")) return;
    await deleteContactApi(activeChatId);
    const nextChats = await refreshAll();
    setProfiles((prev) => {
      const next = { ...prev };
      delete next[activeChatId];
      return next;
    });
    setMessages((prev) => {
      const next = { ...prev };
      delete next[activeChatId];
      return next;
    });
    setActiveChatId(nextChats[0]?.id ?? "");
    setMobilePanel("list");
  }, [activeChatId, refreshAll]);

  if (chats.length === 0) {
    return (
      <div className="flex h-dvh flex-col bg-black">
        <TopStatsBar stats={stats} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-secondary">No contacts yet.</p>
          <p className="text-sm text-text-muted">
            Run <code className="rounded bg-surface-card px-1.5 py-0.5">npm run db:seed</code>{" "}
            or create your first contact.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Create contact
          </button>
        </div>
        <CreateContactModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleContactCreated}
        />
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-black">
      <TopStatsBar stats={stats} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "h-full shrink-0 transition-transform duration-200",
            "w-full md:w-[min(100%,340px)] lg:w-[360px]",
            mobilePanel === "list" ? "flex translate-x-0" : "hidden md:flex",
          )}
        >
          <SidebarLeft
            chats={chats}
            stats={stats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onNewContact={() => setShowCreateModal(true)}
            className="w-full"
          />
        </div>

        <div
          className={cn(
            "h-full min-w-0 flex-1",
            mobilePanel === "chat" || mobilePanel === "crm"
              ? "flex"
              : "hidden md:flex",
          )}
        >
          <ConversationView
            chat={activeChat}
            messages={activeMessages}
            loading={loadingMessages}
            onBack={handleBackToList}
            onOpenCrm={handleOpenCrm}
            showBackButton={mobilePanel !== "list"}
            onSendMessage={handleSendMessage}
          />
        </div>

        <div
          className={cn(
            "h-full shrink-0",
            "fixed inset-y-0 right-0 z-40 w-full max-w-[340px] shadow-panel transition-transform duration-200 lg:static lg:z-0 lg:max-w-none lg:w-[320px] lg:shadow-none",
            mobilePanel === "crm"
              ? "translate-x-0 flex"
              : "translate-x-full hidden lg:flex",
            "lg:translate-x-0",
          )}
        >
          {activeProfile ? (
            <SidebarRight
              profile={activeProfile}
              onClose={handleCloseCrm}
              onAddNote={handleAddNote}
              onAddTag={handleAddTag}
              onDeleteTag={handleDeleteTag}
              onDeleteContact={handleDeleteContact}
            />
          ) : (
            <aside className="flex h-full w-full items-center justify-center border-l border-border bg-surface-raised text-sm text-text-muted">
              Loading fan details...
            </aside>
          )}
        </div>

        {mobilePanel === "crm" && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={handleCloseCrm}
            aria-label="Close CRM panel"
          />
        )}
      </div>

      <CreateContactModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleContactCreated}
      />
    </div>
  );
}
