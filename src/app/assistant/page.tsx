"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, Sparkles, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/components/layout/SessionProvider";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { MessageBubble, type ChatMessageData } from "@/components/assistant/MessageBubble";
import { ConversationList, type ConversationSummary } from "@/components/assistant/ConversationList";

const SUGGESTIONS = [
  "What do I have today?",
  "Remind me to call Mom tomorrow at 6 PM",
  "Schedule a meeting with Rahul tomorrow from 3 to 4",
  "Show me my pending tasks",
];

export default function AssistantPage() {
  const { user, aiConfigured, loading: sessionLoading } = useSession();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } catch {
      // Non-fatal - chat still works without history.
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
    } catch {
      showToast("Unable to load conversation.", "error");
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) startNewChat();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch {
      loadConversations();
    }
  }

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setLastFailedMessage(null);
    const userMsg: ChatMessageData = { id: `local-${Date.now()}`, role: "USER", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
        setLastFailedMessage(text);
        showToast(data.error || "The assistant couldn't respond. Please try again.", "error");
        return;
      }
      if (!activeId) {
        setActiveId(data.conversationId);
        loadConversations();
      }
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: "ASSISTANT", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)));
      setLastFailedMessage(text);
      showToast("AI is temporarily unavailable.", "error");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const showConfigNotice = !sessionLoading && !aiConfigured;

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] -mx-4 md:-mx-8 -my-6 border-t border-border">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={openConversation}
          onNew={startNewChat}
          onDelete={deleteConversation}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-16 border-b border-border flex items-center px-4 md:px-6 gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">AI Assistant</h1>
          </div>

          {showConfigNotice && (
            <div className="mx-4 md:mx-6 mt-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm px-4 py-2.5">
              AI features are not configured. Add an <code className="font-mono">OPENAI_API_KEY</code> to your <code className="font-mono">.env</code> file to enable the assistant. The rest of the app works fine without it.
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="h-12 w-12 rounded-full bg-accent text-primary flex items-center justify-center mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="font-medium">Ask me anything about your schedule</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  I can create events, tasks, and reminders, and tell you what's coming up — or what already happened.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onRetry={m.failed ? () => send(lastFailedMessage ?? m.content) : undefined}
                  />
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent text-primary flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border p-4 md:p-6 flex items-end gap-2">
            {messages.length > 0 && (
              <Button type="button" variant="ghost" size="icon" onClick={startNewChat} title="Clear conversation">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Message your assistant..."
              rows={1}
              className="flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
