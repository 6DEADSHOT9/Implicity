import { useEffect, useId, useRef } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { title: string; kind: string; settingsOpen?: boolean; onSettingsOpenChange?: (open: boolean) => void };
export function ChatHeader({ title, kind, settingsOpen = false, onSettingsOpenChange }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId(); const seenRef = useSeen({ component: "ChatHeader", defaultState: settingsOpen ? "with-settings" : "standard" });
  useEffect(() => { emitRef.current("component_shown", { component: "ChatHeader", default_state: settingsOpen ? "with-settings" : "standard" }); }, []);
  return <header ref={seenRef} aria-labelledby={titleId} className="flex min-w-0 flex-wrap items-center justify-between gap-space-2 border-b-token border-border p-space-3">
    <h1 id={titleId} className="min-w-0 flex-1 break-words text-xl font-semibold">{title}</h1><Badge variant="secondary" className="max-w-full break-words">{kind}</Badge>
    <DropdownMenu open={settingsOpen} onOpenChange={(open) => { onSettingsOpenChange?.(open); }}><DropdownMenuTrigger asChild><Button type="button" variant="outline" aria-label="Conversation settings">Settings</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onSettingsOpenChange?.(false)}>Conversation settings</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </header>;
}
