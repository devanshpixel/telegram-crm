"use client";

import { ChatListItem } from "./ChatListItem";
import type { Chat } from "@/types";

interface ChatListProps {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
}

export function ChatList({ chats, activeChatId, onSelectChat }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-text-muted">No conversations match your search</p>
      </div>
    );
  }

  const pinned = chats.filter((c) => c.isPinned);
  const rest = chats.filter((c) => !c.isPinned);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
      {pinned.length > 0 && (
        <div className="mb-1">
          <p className="px-4 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Pinned
          </p>
          {pinned.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onClick={() => onSelectChat(chat.id)}
            />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <p className="px-4 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              All chats
            </p>
          )}
          {rest.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onClick={() => onSelectChat(chat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
