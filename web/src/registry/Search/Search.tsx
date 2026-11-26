import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { XIcon } from "lucide-react";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { open: boolean; results: { id: string; label: string }[]; onOpenChange?: (open: boolean) => void; onSearch?: (query: string) => void; onSelect?: (resultId: string) => void };
export function Search({ open, results, onOpenChange, onSearch, onSelect }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const used = useRef(false); const seenRef = useSeen({ component: "Search", defaultState: open ? "open" : "closed" });
  useEffect(() => { if (!open) used.current = false; }, [open]);
  useEffect(() => { emitRef.current("component_shown", { component: "Search", default_state: open ? "open" : "closed" }); }, []);
  return <div ref={seenRef} className="min-w-0 box-border w-full"><Button type="button" variant="outline" onClick={() => onOpenChange?.(true)}>Search</Button><Dialog open={open} onOpenChange={onOpenChange}><DialogContent showCloseButton={false} className="box-border min-w-0 max-w-full" onOpenAutoFocus={(event) => { if (document.body.classList.contains("gallery-preview-root")) { event.preventDefault(); if (window.parent.document.activeElement === window.frameElement) { (window.frameElement as HTMLElement | null)?.blur(); window.parent.scrollTo(0, 0); } } }}><DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label="Close search" className="absolute right-space-2 top-space-2"><XIcon /></Button></DialogClose><DialogHeader><DialogTitle>Search</DialogTitle><DialogDescription>Search across conversations and work.</DialogDescription></DialogHeader><Command label="Search conversations" shouldFilter={false} className="min-w-0"><CommandInput aria-label="Search conversations" placeholder="Search chats" onValueChange={(query) => { if (query) { if (!used.current) emit("search_used", {}); used.current = true; onSearch?.(query); } }} /><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup heading="Results">{results.map(({ id, label }) => <CommandItem key={id} value={id} onSelect={() => onSelect?.(id)} className="box-border min-w-0 min-h-control whitespace-normal break-all">{label}</CommandItem>)}</CommandGroup></CommandList></Command></DialogContent></Dialog></div>;
}
