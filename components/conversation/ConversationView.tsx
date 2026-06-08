"use client";

import { useEffect, useRef } from "react";
import type { Chat, Message } from "@/types";
import { ConversationHeader } from "./ConversationHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

interface ConversationViewProps {
  chat: Chat;
  messages: Message[];
  loading?: boolean;
  onBack?: () => void;
  onOpenCrm?: () => void;
  showBackButton?: boolean;
  onSendMessage: (text: string) => Promise<void>;
}

export function ConversationView({
  chat,
  messages,
  loading,
  onBack,
  onOpenCrm,
  showBackButton,
  onSendMessage,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.id, messages.length]);

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-black">
      <ConversationHeader
        chat={chat}
        onBack={onBack}
        onOpenCrm={onOpenCrm}
        showBackButton={showBackButton}
      />

      <div ref={scrollRef} className="chat-wallpaper flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 flex justify-center">
            <span className="rounded-full bg-surface-card px-4 py-1.5 text-xs font-medium text-text-muted ring-1 ring-border">
              Today
            </span>
          </div>
          {loading && messages.length === 0 ? (
            <p className="text-center text-sm text-text-muted">Loading messages...</p>
          ) : (
            <div className="flex flex-col">
              {messages.map((message, i) => {
                const prev = messages[i - 1];
                const isGrouped =
                  !!prev &&
                  prev.direction === message.direction &&
                  message.timestamp.getTime() - prev.timestamp.getTime() <
                    5 * 60 * 1000;
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isGrouped={isGrouped}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MessageInput
        contactName={chat.name.split(" ")[0]}
        contactId={chat.id}
        onSend={onSendMessage}
      />
    </main>
  );
}
