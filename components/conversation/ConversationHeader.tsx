import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { RevenueBadge } from "@/components/ui/RevenueBadge";
import type { Chat, ConvState } from "@/types";
import { ArrowLeft, MoreVertical, PanelRight, Search } from "lucide-react";

interface ConversationHeaderProps {
  chat: Chat;
  onBack?: () => void;
  onOpenCrm?: () => void;
  showBackButton?: boolean;
}

const CONV_STATE_CONFIG: Record<ConvState, { label: string; variant: "default" | "success" | "revenue" }> = {
  FREE_CHAT: { label: "New", variant: "default" },
  OFFER_SENT: { label: "Offered", variant: "revenue" },
  PAID: { label: "Paid", variant: "success" },
};

export function ConversationHeader({
  chat,
  onBack,
  onOpenCrm,
  showBackButton,
}: ConversationHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3 py-3 sm:px-4">
      {showBackButton && onBack && (
        <IconButton onClick={onBack} aria-label="Back to chats" className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
      )}

      <button
        type="button"
        onClick={onOpenCrm}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-surface-hover lg:pointer-events-none lg:hover:bg-transparent"
      >
        <Avatar
          initials={chat.avatar}
          colorClass={chat.avatarColor}
          isOnline={chat.isOnline}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold">{chat.name}</h2>
            <Badge
              variant={CONV_STATE_CONFIG[chat.convState].variant}
              className="!px-1.5 !py-0 !text-[10px]"
            >
              {CONV_STATE_CONFIG[chat.convState].label}
            </Badge>
            <RevenueBadge amount={chat.revenue} size="md" />
          </div>
          <p className="truncate text-xs">
            {chat.isOnline ? (
              <span className="text-emerald-400">online</span>
            ) : (
              <span className="text-text-muted">last seen recently</span>
            )}
            <span className="text-text-muted"> · {chat.username}</span>
          </p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton aria-label="Search in chat" className="hidden sm:flex">
          <Search className="h-[18px] w-[18px]" />
        </IconButton>
        {onOpenCrm && (
          <IconButton
            onClick={onOpenCrm}
            aria-label="Open CRM panel"
            className="lg:hidden"
          >
            <PanelRight className="h-[18px] w-[18px]" />
          </IconButton>
        )}
        <IconButton aria-label="More options">
          <MoreVertical className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
    </header>
  );
}
