"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addNoteApi,
  addTagApi,
  deleteContactApi,
  deleteTagApi,
  fetchChats,
  fetchContact,
  fetchMessages,
  fetchStats,
  sendTelegramMessageApi,
  telegramStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Chat, ContactProfile, DashboardStats, Message } from "@/types";
import { SidebarLeft } from "@/components/sidebar-left/SidebarLeft";
import { ConversationView } from "@/components/conversation/ConversationView";
import { SidebarRight } from "@/components/sidebar-right/SidebarRight";
import { TopStatsBar } from "./TopStatsBar";
import { BroadcastModal } from "./BroadcastModal";
import { CreateContactModal } from "@/components/forms/CreateContactModal";
import { TelegramLoginModal } from "@/components/forms/TelegramLoginModal";

type MobilePanel = "list" | "chat" | "crm";

interface DashboardProps {
  initialChats: Chat[];
  initialStats: DashboardStats;
  requestedContactId?: string;
}

export function Dashboard({
  initialChats,
  initialStats,
  requestedContactId,
}: DashboardProps) {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (requestedContactId) {
      const match = initialChats.find((c) => c.id === requestedContactId);
      if (match) return match.id;
    }
    return initialChats[0]?.id ?? "";
  });

  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("list");
  const [profiles, setProfiles] = useState<Record<string, ContactProfile>>({});
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

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
    if (chats.length > 0 && activeChatId && !chats.find(c => c.id === activeChatId)) {
      setActiveChatId(chats[0].id);
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    void loadProfile(activeChatId);
    void loadMessages(activeChatId);
  }, [activeChatId, loadProfile, loadMessages]);

  useEffect(() => {
    if (!activeChatId) return;
    const id = setInterval(() => { void loadMessages(activeChatId); }, 5000);
    return () => clearInterval(id);
  }, [activeChatId, loadMessages]);

  useEffect(() => {
    telegramStatus()
      .then((result) => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

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
      await refreshAll();
      setActiveChatId(profile.id);
      setProfiles((prev) => ({ ...prev, [profile.id]: profile }));
      setMobilePanel("chat");
    },
    [refreshAll],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeChatId) return;
      await sendTelegramMessageApi(Number(activeChatId), text);
      const msgs = await fetchMessages(activeChatId);
      setMessages((prev) => ({ ...prev, [activeChatId]: msgs }));
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
        <TopStatsBar
          stats={stats}
          authenticated={authenticated}
          onConnectTelegram={() => setShowLoginModal(true)}
          onOpenBroadcast={() => setShowBroadcast(true)}
        />

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
        <TelegramLoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onAuthenticated={() => {
            setAuthenticated(true);
            setShowLoginModal(false);
          }}
        />
        <BroadcastModal
          open={showBroadcast}
          onClose={() => setShowBroadcast(false)}
          onSent={refreshAll}
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
        <TopStatsBar
          stats={stats}
          authenticated={authenticated}
          onConnectTelegram={() => setShowLoginModal(true)}
          onOpenBroadcast={() => setShowBroadcast(true)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "h-full shrink-0 transition-transform duration-200",
            "w-full md:w-[20%]",
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
            "h-full min-w-0 flex-1 md:max-w-[60%]",
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
            "fixed inset-y-0 right-0 z-40 w-full max-w-[340px] shadow-panel transition-transform duration-200 lg:static lg:z-0 lg:max-w-none lg:w-[20%] lg:shadow-none",
            mobilePanel === "crm"
              ? "translate-x-0 flex"
              : "translate-x-full hidden lg:flex",
            "lg:translate-x-0",
          )}
        >

          {activeProfile ? (
            <SidebarRight
              profile={activeProfile}
              totalMessages={activeMessages.length}
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
      <TelegramLoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthenticated={() => {
          setAuthenticated(true);
          setShowLoginModal(false);
        }}
      />
      <BroadcastModal
        open={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        onSent={refreshAll}
      />
    </div>
  );
}
