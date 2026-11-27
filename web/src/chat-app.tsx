import { useCallback, useEffect, useRef, useState } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Button } from "./components/ui/button";
import { Message, MessageContent } from "./components/ai-elements/message";
import { AppShell } from "./registry/AppShell/AppShell";
import { ChatHeader } from "./registry/ChatHeader/ChatHeader";
import { Composer } from "./registry/Composer/Composer";
import { ConversationNavigation } from "./registry/ConversationNavigation/ConversationNavigation";
import { MessageBody } from "./registry/MessageBody/MessageBody";

type ConversationSummary = { id: string; title: string };
type StoredMessage = { id: string; role: "user" | "assistant"; content: string };
type Conversation = ConversationSummary & { messages: StoredMessage[] };
type Quota = { state: "ok" | "near_limit" | "limited" | "unknown"; windows: { label: string; used_percent: number }[] };

function quotaLabel(quota: Quota) {
  if (quota.state === "unknown") return "Unknown";
  const windows = quota.windows.map(({ label, used_percent }) => `${label}: ${Math.round(100 - used_percent)}% remaining`).join(" · ");
  if (quota.state === "limited") return windows ? `Limit reached · ${windows}` : "Limit reached";
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

function ConversationChat({ conversation, onNewChat }: { conversation: Conversation; onNewChat: () => void }) {
  const storedMessageCount = useRef(conversation.messages.length).current;
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversation.id,
    messages: conversation.messages.map(toUIMessage),
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  return <div className="flex h-full min-h-svh min-w-0 flex-col">
    <ChatHeader title={conversation.title} kind="other" onOpenSettings={() => {}} />
    <div className="min-h-0 flex-1 overflow-y-auto p-space-4">
      <ol aria-label="Conversation messages" className="mx-auto flex w-full max-w-content flex-col gap-space-4">
        {messages.map((message, index) => {
          const content = message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
          return <li key={message.id}>
            {message.role === "assistant" ? <MessageBody content={content || " "} streaming={index === messages.length - 1 && (status === "submitted" || status === "streaming")} initiallyOpen={index >= storedMessageCount} /> : <Message role="user" from="user"><MessageContent>{content}</MessageContent></Message>}
          </li>;
        })}
      </ol>
      {error && <p role="alert" className="mx-auto mt-space-3 max-w-content text-destructive">The answer could not be loaded.</p>}
    </div>
    <div className="mx-auto flex w-full max-w-content items-end gap-space-2 p-space-4">
      <Composer attachments={[]} shortcuts={[]} onSubmit={(message) => {
        if (message.text.trim()) void sendMessage({ text: message.text });
      }} />
      {(status === "submitted" || status === "streaming") && <Button type="button" variant="outline" onClick={() => void stop()}>Stop</Button>}
      <Button type="button" variant="ghost" onClick={onNewChat}>New chat</Button>
    </div>
  </div>;
}

export function ChatApp() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<Conversation>();
  const [conversationRevision, setConversationRevision] = useState(0);
  const [quota, setQuota] = useState("Unknown");
  const [error, setError] = useState(false);

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
      ? <ConversationChat key={`${conversation.id}-${conversationRevision}`} conversation={conversation} onNewChat={() => void newChat()} />
      : <main key="empty" className="flex min-h-svh flex-col items-center justify-center gap-space-3 p-space-4"><h1 className="text-heading-2 font-semibold">Implicity</h1><p>Start a conversation.</p><Button onClick={() => void newChat()}>New chat</Button>{error && <p role="alert">The chat service could not be reached.</p>}</main>],
  }} />;
}
