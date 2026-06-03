"use client";

import { MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Chat, DashboardStats } from "@/types";
import { IconButton } from "@/components/ui/IconButton";
import { ChatList } from "./ChatList";
import { SearchBar } from "./SearchBar";

interface SidebarLeftProps {
  chats: Chat[];
  stats: DashboardStats;
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNewContact: () => void;
  className?: string;
}

export function SidebarLeft({
  chats,
  stats,
  activeChatId,
  onSelectChat,
  onNewContact,
  className,
}: SidebarLeftProps) {
  const [query, setQuery] = useState("");

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query, chats]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface-raised",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div>
          <h2 className="text-base font-semibold">Inbox</h2>
          <p className="text-xs text-text-muted">
            {stats.unreadTotal > 0
              ? `${stats.unreadTotal} unread · ${stats.onlineCount} online`
              : `${stats.onlineCount} fans online`}
          </p>
        </div>
        <IconButton aria-label="New conversation" onClick={onNewContact}>
          <MessageSquarePlus className="h-[18px] w-[18px]" />
        </IconButton>
      </div>

      <SearchBar value={query} onChange={setQuery} />

      <ChatList
        chats={filteredChats}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
      />
    </aside>
  );
}
