import { useEffect, useId, useRef } from "react";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { ItemContent, ItemTitle } from "../../components/ui/item";
import { Separator } from "../../components/ui/separator";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Named = { id: string; label: string };
type Props = { items: Named[]; recent: Named[]; projects: Named[]; quota: string; onHome?: () => void; onNewChat?: () => void; onSearch?: () => void; onSelect?: (itemId: string) => void; onSelectProject?: (projectId: string) => void; onSelectRecent?: (itemId: string) => void };
export function ConversationNavigation({ items, recent, projects, quota, onHome, onNewChat, onSearch, onSelect, onSelectProject, onSelectRecent }: Props) {
  const headingId = useId();
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const seenRef = useSeen({ component: "ConversationNavigation", defaultState: items.length ? "populated" : "empty" });
  useEffect(() => { emitRef.current("component_shown", { component: "ConversationNavigation", default_state: items.length ? "populated" : "empty" }); }, []);
  return <nav ref={seenRef} aria-label="Conversations" className="flex min-w-0 flex-col gap-space-2 p-space-2">
    <div className="flex flex-wrap gap-space-2"><Button type="button" variant="ghost" onClick={onHome}>Home</Button><Button type="button" onClick={onNewChat}>New chat</Button><Button type="button" variant="outline" onClick={onSearch}>Search</Button></div>
    <Separator />
    <section aria-labelledby={`${headingId}-chats`}><h2 id={`${headingId}-chats`} className="px-space-2 py-space-1 text-sm font-semibold">Chats</h2><ul className="m-0 flex min-w-0 list-none flex-col gap-space-1 p-0">{items.length === 0 && <li className="list-none"><Empty className="gap-space-2 p-space-2"><EmptyTitle>No conversations yet</EmptyTitle><EmptyDescription>Start a new chat to see it here.</EmptyDescription></Empty></li>}{items.map(({ id, label }) => <li key={id} className="min-w-0"><Button type="button" variant="ghost" className="box-border min-h-control h-auto w-full justify-start whitespace-normal break-words text-left" onClick={() => onSelect?.(id)}><Avatar><AvatarFallback>{label.slice(0, 1)}</AvatarFallback></Avatar><span className="min-w-0 break-words">{label}</span></Button></li>)}</ul></section>
    {projects.length > 0 && <section aria-labelledby={`${headingId}-projects`}><h2 id={`${headingId}-projects`} className="px-space-2 py-space-1 text-sm font-semibold">Projects</h2>{projects.map(({ id, label }) => <Button key={id} type="button" variant="ghost" className="box-border min-h-control h-auto w-full justify-start whitespace-normal break-words text-left" onClick={() => onSelectProject?.(id)}>{label}</Button>)}</section>}
    {recent.length > 0 && <section aria-labelledby={`${headingId}-recent`}><h2 id={`${headingId}-recent`} className="px-space-2 py-space-1 text-sm font-semibold">Recent work</h2>{recent.map(({ id, label }) => <Button key={id} type="button" variant="ghost" className="box-border min-h-control h-auto w-full justify-start whitespace-normal break-words text-left" onClick={() => onSelectRecent?.(id)}><ItemContent><ItemTitle className="break-words">{label}</ItemTitle></ItemContent></Button>)}</section>}
    <footer className="mt-auto rounded-md bg-muted p-space-2 text-sm">Quota: {quota}</footer>
  </nav>;
}
