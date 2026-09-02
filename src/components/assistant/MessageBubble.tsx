"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ChatMessageData {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt?: string;
  failed?: boolean;
}

export function MessageBubble({ message, onRetry }: { message: ChatMessageData; onRetry?: () => void }) {
  const isUser = message.role === "USER";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[75%] flex flex-col", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
            isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm",
            message.failed && "border border-destructive/50"
          )}
        >
          {message.content}
        </div>
        {message.failed && onRetry && (
          <button onClick={onRetry} className="text-xs text-destructive mt-1 hover:underline">
            Failed to send — retry
          </button>
        )}
      </div>
    </div>
  );
}
