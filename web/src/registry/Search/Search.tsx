import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { open: boolean; results: string[]; onOpenChange?: (open: boolean) => void; onSearch?: (query: string) => void; onSelect?: (result: string) => void };
export function Search({ open, results, onOpenChange, onSearch, onSelect }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const used = useRef(false); const seenRef = useSeen({ component: "Search", defaultState: open ? "open" : "closed" });
  useEffect(() => { emitRef.current("component_shown", { component: "Search", default_state: open ? "open" : "closed" }); }, []);
  return <div ref={seenRef} className="min-w-0"><Button type="button" variant="outline" onClick={() => onOpenChange?.(true)}>Search</Button><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="min-w-0"><DialogHeader><DialogTitle>Search</DialogTitle><DialogDescription>Search across conversations and work.</DialogDescription></DialogHeader><Command label="Search conversations" shouldFilter={false} className="min-w-0"><CommandInput aria-label="Search conversations" placeholder="Search chats" onValueChange={(query) => { if (query) { if (!used.current) emit("search_used", {}); used.current = true; onSearch?.(query); } else used.current = false; }} /><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup heading="Results">{results.map((result, index) => <CommandItem key={`${result}-${index}`} value={`${index}`} onSelect={() => onSelect?.(result)} className="min-w-0 whitespace-normal break-all">{result}</CommandItem>)}</CommandGroup></CommandList></Command></DialogContent></Dialog></div>;
}
