"use client";

import { Pin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RevenueBadge } from "@/components/ui/RevenueBadge";
import { cn, formatTime } from "@/lib/utils";
import type { Chat } from "@/types";

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group mx-2 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl px-3 py-3.5 text-left transition",
        isActive
          ? "bg-surface-active ring-1 ring-border-focus"
          : "hover:bg-surface-hover",
      )}
    >
      <Avatar
        initials={chat.avatar}
        colorClass={chat.avatarColor}
        isOnline={chat.isOnline}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate text-[15px] font-medium leading-tight",
                  chat.unreadCount > 0 ? "text-text-primary" : "text-text-primary/90",
                )}
              >
                {chat.name}
              </span>
              {chat.isPinned && (
                <Pin className="h-3 w-3 shrink-0 text-accent/80" aria-label="Pinned" />
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-text-muted">{chat.username}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] text-text-muted">
              {formatTime(chat.lastMessageTime)}
            </span>
            {chat.unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
              </span>
            )}
          </div>
        </div>

        <p
          className={cn(
            "mt-2 line-clamp-1 text-[13px] leading-snug",
            chat.unreadCount > 0 ? "font-medium text-text-secondary" : "text-text-muted",
          )}
        >
          {chat.lastMessage}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <RevenueBadge amount={chat.revenue} />
          {chat.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant={tag === "Whale" || tag === "VIP" ? "revenue" : "default"}
              className="!px-1.5 !py-0 !text-[10px]"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </button>
  );
}
