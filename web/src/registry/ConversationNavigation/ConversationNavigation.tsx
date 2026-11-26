import { useEffect, useId, useRef } from "react";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { Item, ItemContent, ItemTitle } from "../../components/ui/item";
import { Kbd } from "../../components/ui/kbd";
import { Separator } from "../../components/ui/separator";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { items: string[]; recent: string[]; projects: string[]; quota: string; onHome?: () => void; onNewChat?: () => void; onSearch?: () => void; onSelect?: (item: string) => void; onSelectProject?: (project: string) => void };
export function ConversationNavigation({ items, recent, projects, quota, onHome, onNewChat, onSearch, onSelect, onSelectProject }: Props) {
  const headingId = useId();
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "ConversationNavigation", defaultState: items.length ? "populated" : "empty" });
  useEffect(() => { emitRef.current("component_shown", { component: "ConversationNavigation", default_state: items.length ? "populated" : "empty" }); }, []);
  return <nav ref={seenRef} aria-label="Conversations" className="flex min-w-0 flex-col gap-space-2 p-space-2">
    <div className="flex flex-wrap gap-space-2"><Button type="button" variant="ghost" onClick={onHome}>Home</Button><Button type="button" onClick={onNewChat}>New chat</Button><Button type="button" variant="outline" onClick={onSearch}>Search <Kbd>⌘K</Kbd></Button></div>
    <Separator />
    <section aria-labelledby={`${headingId}-chats`}><h2 id={`${headingId}-chats`} className="px-space-2 py-space-1 text-sm font-semibold">Chats</h2><ul className="m-0 flex min-w-0 list-none flex-col gap-space-1 p-0">{items.length === 0 && <li className="list-none"><Empty className="gap-space-2 p-space-2"><EmptyTitle>No conversations yet</EmptyTitle><EmptyDescription>Start a new chat to see it here.</EmptyDescription></Empty></li>}{items.map((item, index) => <li key={`${item}-${index}`} className="min-w-0"><Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal break-words text-left" onClick={() => onSelect?.(item)}><Avatar><AvatarFallback>{item.slice(0, 1)}</AvatarFallback></Avatar><span className="min-w-0 break-words">{item}</span></Button></li>)}</ul></section>
    {projects.length > 0 && <section aria-labelledby={`${headingId}-projects`}><h2 id={`${headingId}-projects`} className="px-space-2 py-space-1 text-sm font-semibold">Projects</h2>{projects.map((project, index) => <Button key={`${project}-${index}`} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal break-words text-left" onClick={() => onSelectProject?.(project)}>{project}</Button>)}</section>}
    {recent.length > 0 && <section aria-labelledby={`${headingId}-recent`}><h2 id={`${headingId}-recent`} className="px-space-2 py-space-1 text-sm font-semibold">Recent work</h2>{recent.map((item, index) => <Item key={`${item}-${index}`} size="sm"><ItemContent><ItemTitle className="break-words">{item}</ItemTitle></ItemContent></Item>)}</section>}
    <footer className="mt-auto rounded-md bg-muted p-space-2 text-sm">Quota: {quota}</footer>
  </nav>;
}
