import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { XIcon } from "lucide-react";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { open: boolean; results: { id: string; label: string }[]; onOpenChange?: (open: boolean) => void; onSearch?: (query: string) => void; onSelect?: (resultId: string) => void };
function SearchResultList({ results, onSelect }: Pick<Props, "results" | "onSelect">) {
  return <CommandList className="min-h-0 max-h-full flex-1"><CommandEmpty>No results found.</CommandEmpty><CommandGroup heading="Results">{results.map(({ id, label }) => <CommandItem key={id} value={id} onSelect={() => onSelect?.(id)} className="box-border min-h-control min-w-0 whitespace-normal break-all">{label}</CommandItem>)}</CommandGroup></CommandList>;
}

export function Search({ open, results, onOpenChange, onSearch, onSelect }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const used = useRef(false); const seenRef = useSeen({ component: "Search", defaultState: open ? "open" : "closed" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => { if (!open) used.current = false; }, [open]);
  useEffect(() => {
    if (!open || document.body.classList.contains("gallery-preview-root")) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => { emitRef.current("component_shown", { component: "Search", default_state: open ? "open" : "closed" }); }, []);
  const focusSearch = (event: Event) => {
    event.preventDefault();
    if (document.body.classList.contains("gallery-preview-root")) {
      if (window.parent.document.activeElement === window.frameElement) {
        (window.frameElement as HTMLElement | null)?.blur();
        window.parent.scrollTo(0, 0);
      }
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };
  const searchValueChanged = (query: string) => {
    setQuery(query);
    if (query && !used.current) emit("search_used", {});
    if (query) used.current = true;
    onSearch?.(query);
  };
  return (
    <div className="box-border w-full min-w-0">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild><Button type="button" variant="outline">Search</Button></DialogTrigger>
        <DialogContent ref={seenRef} showCloseButton={false} className="box-border flex max-h-dvh min-w-0 max-w-full flex-col overflow-hidden" onOpenAutoFocus={focusSearch}>
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label="Close search" className="absolute right-space-2 top-space-2"><XIcon /></Button></DialogClose>
          <DialogHeader><DialogTitle>Search</DialogTitle><DialogDescription>Search across conversations and work.</DialogDescription></DialogHeader>
          <Command label="Search conversations" shouldFilter={false} className="min-h-0 min-w-0 flex-1">
            <CommandInput ref={inputRef} aria-label="Search conversations" placeholder="Search chats" value={query} onValueChange={searchValueChanged} />
            <SearchResultList results={results} onSelect={onSelect} />
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
