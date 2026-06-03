import { cn, formatTime } from "@/lib/utils";
import type { Message } from "@/types";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
}

export function MessageBubble({ message, isGrouped }: MessageBubbleProps) {
  const isOutgoing = message.direction === "outgoing";

  return (
    <div
      className={cn(
        "flex w-full px-1",
        isOutgoing ? "justify-end" : "justify-start",
        isGrouped ? "mt-0.5" : "mt-3",
      )}
    >
      <div
        className={cn(
          "relative max-w-[min(85%,420px)] px-3 py-2 shadow-card",
          isOutgoing
            ? cn(
                "rounded-[18px] rounded-br-[4px] bg-bubble-outgoing",
                isGrouped && "rounded-br-[18px]",
              )
            : cn(
                "rounded-[18px] rounded-bl-[4px] bg-bubble-incoming ring-1 ring-border",
                isGrouped && "rounded-bl-[18px]",
              ),
        )}
      >
        <p className="whitespace-pre-wrap text-[15px] leading-[1.35] text-text-primary">
          {message.text}
        </p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 select-none",
            isOutgoing ? "text-telegram/70" : "text-text-muted",
          )}
        >
          <span className="text-[11px] leading-none">
            {formatTime(message.timestamp)}
          </span>
          {isOutgoing &&
            (message.read ? (
              <CheckCheck className="h-4 w-4 text-telegram" />
            ) : (
              <Check className="h-4 w-4" />
            ))}
        </div>
      </div>
    </div>
  );
}
