import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Button } from "./components/ui/button";
import { Message, MessageContent } from "./components/ai-elements/message";
import { AppShell } from "./registry/AppShell/AppShell";
import { ChatHeader } from "./registry/ChatHeader/ChatHeader";
import { Composer } from "./registry/Composer/Composer";
import { ConversationNavigation } from "./registry/ConversationNavigation/ConversationNavigation";
import { MessageBody } from "./registry/MessageBody/MessageBody";
import { getCurrentSessionId } from "./current-session-id";

type ConversationSummary = { id: string; title: string };
type StoredMessage = { id: string; role: "user" | "assistant"; content: string };
type Conversation = ConversationSummary & { messages: StoredMessage[] };
type Quota = { state: "ok" | "near_limit" | "limited" | "unknown"; windows: { label: string; used_percent: number }[]; resets_at: string | null };

function quotaLabel(quota: Quota) {
  if (quota.state === "unknown") return "Unknown";
  const windows = quota.windows.map(({ label, used_percent }) => `${label}: ${Math.round(100 - used_percent)}% remaining`).join(" · ");
  if (quota.state === "limited") return `Limit reached${quota.resets_at ? ` · resets ${new Date(quota.resets_at).toLocaleString()}` : ""}${windows ? ` · ${windows}` : ""}`;
  if (!windows) return quota.state === "near_limit" ? "Near limit" : "Available";
  return quota.state === "near_limit" ? `Near limit · ${windows}` : windows;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Chat request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function toUIMessage(message: StoredMessage): UIMessage {
  return { id: message.id, role: message.role, parts: [{ type: "text", text: message.content }] };
}

function ConversationChat({ conversation, onQuotaRefresh }: { conversation: Conversation; onQuotaRefresh: () => Promise<Quota | undefined> }) {
  const storedMessageCount = useRef(conversation.messages.length).current;
  const listRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const previousStatus = useRef("ready");
  const [sendError, setSendError] = useState<string>();
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversation.id,
    messages: conversation.messages.map(toUIMessage),
    transport: new DefaultChatTransport({ api: "/api/chat", body: { session_id: getCurrentSessionId() } }),
  });
  const contentKey = messages.map((message) => message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")).join("\n\n");
  useLayoutEffect(() => {
    if (followLatest.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [contentKey]);
  useEffect(() => {
    if ((previousStatus.current === "streaming" || previousStatus.current === "submitted") && status === "ready") onQuotaRefresh();
    previousStatus.current = status;
  }, [status, onQuotaRefresh]);
  useEffect(() => {
    if (!error) return;
    let current = true;
    void onQuotaRefresh().then((value) => {
      if (!current) return;
      if (!value) {
        setSendError(error.message || "The answer could not be loaded. Try again.");
        return;
      }
      setSendError(value.state === "limited"
        ? `The usage limit is reached${value.resets_at ? ` and resets ${new Date(value.resets_at).toLocaleString()}` : ""}.`
        : error.message || "The answer could not be loaded. Try again.");
    });
    return () => { current = false; };
  }, [error, onQuotaRefresh]);
  return <div data-chat-shell className="flex h-full min-h-0 min-w-0 flex-col">
    <ChatHeader title={conversation.title} onOpenSettings={() => {}} />
    <div ref={listRef} onScroll={(event) => { const target = event.currentTarget; followLatest.current = target.scrollHeight - target.scrollTop - target.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto p-space-4">
      <ol aria-label="Conversation messages" className="mx-auto flex w-full max-w-content flex-col gap-space-4">
        {messages.map((message, index) => {
          const content = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("\n\n");
          return <li key={message.id}>
            {message.role === "assistant" ? <MessageBody content={content || " "} streaming={index === messages.length - 1 && (status === "submitted" || status === "streaming")} initiallyOpen={index >= storedMessageCount} /> : <Message role="user" from="user"><MessageContent>{content}</MessageContent></Message>}
          </li>;
        })}
      </ol>
      {(sendError || error) && <p role="alert" className="mx-auto mt-space-3 max-w-content text-destructive">{sendError || "The answer could not be loaded. Try again."}</p>}
    </div>
    <div className="mx-auto flex w-full max-w-content min-w-0 items-end gap-space-2 p-space-4">
      <Composer attachments={[]} shortcuts={[]} disabled={status === "submitted" || status === "streaming"} attachmentsEnabled={false} onSubmit={(message) => {
        if (message.files.length) {
          setSendError("Attachments are not supported yet. Remove the file before sending.");
          return;
        }
        setSendError(undefined);
        if (message.text.trim() && status !== "submitted" && status !== "streaming") void sendMessage({ text: message.text });
      }} />
      {(status === "submitted" || status === "streaming") && <Button type="button" variant="outline" onClick={() => void stop()}>Stop</Button>}
    </div>
  </div>;
}

export function ChatApp() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation>();
  const [conversationRevision, setConversationRevision] = useState(0);
  const [quota, setQuota] = useState("Unknown");
  const [error, setError] = useState(false);
  const refreshQuota = useCallback(async () => {
    try {
      const value = await request<Quota>("/api/quota");
      setQuota(quotaLabel(value));
      return value;
    } catch {
      setQuota("Unknown");
      return undefined;
    }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    try {
      setConversation(await request<Conversation>(`/api/conversations/${id}`));
      setConversationRevision((revision) => revision + 1);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  const newChat = useCallback(async () => {
    try {
      const created = await request<ConversationSummary>("/api/conversations", { method: "POST" });
      setConversations((current) => [created, ...current.filter(({ id }) => id !== created.id)]);
      setConversation({ ...created, messages: [] });
      setConversationRevision((revision) => revision + 1);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let current = true;
    void request<ConversationSummary[]>("/api/conversations").then(async (items) => {
      if (!current) return;
      setConversations(items);
      if (items[0]) await openConversation(items[0].id);
    }).catch(() => { if (current) setError(true); });
    void request<Quota>("/api/quota").then((value) => {
      if (current) setQuota(quotaLabel(value));
    }).catch(() => { if (current) setQuota("Unknown"); });
    return () => { current = false; };
  }, [openConversation]);

  return <AppShell panelOpen={false} slots={{
    navigation: [<ConversationNavigation key="navigation" items={conversations.map(({ id, title }) => ({ id, label: title }))} recent={[]} projects={[]} quota={quota} onNewChat={() => void newChat()} onSelect={(id) => void openConversation(id)} />],
    main: [conversation
      ? <ConversationChat key={`${conversation.id}-${conversationRevision}`} conversation={conversation} onQuotaRefresh={refreshQuota} />
      : <main key="empty" className="flex min-h-svh flex-col items-center justify-center gap-space-3 p-space-4"><h1 className="text-heading-2 font-semibold">Implicity</h1><p>Start a conversation.</p><Button onClick={() => void newChat()}>New chat</Button>{error && <p role="alert">The chat service could not be reached.</p>}</main>],
  }} />;
}
