import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { XIcon } from "lucide-react";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

const views = [{ id: "preferences", label: "Preferences" }, { id: "locks", label: "Locks" }, { id: "notices", label: "What Implicity notices" }, { id: "history", label: "Change history" }, { id: "quota", label: "Quota" }] as const;
type View = typeof views[number]["id"];
type Props = { open: boolean; tab: View; onTabChange?: (tab: View) => void; onClose?: () => void; slots?: Partial<Record<View, ReactNode[]>> };
export function Settings({ open, tab, onTabChange, onClose, slots = {} }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const openerRef = useRef<HTMLElement | null>(null);
  const seenRef = useSeen({ component: "Settings", defaultState: tab });
  useEffect(() => { emitRef.current("component_shown", { component: "Settings", default_state: tab }); }, []);
  const focusSettings = (event: Event) => {
    if (document.body.classList.contains("gallery-preview-root")) {
      event.preventDefault();
      if (window.parent.document.activeElement === window.frameElement) {
        (window.frameElement as HTMLElement | null)?.blur();
        window.parent.scrollTo(0, 0);
      }
      return;
    }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restoreFocus = (event: Event) => {
    if (openerRef.current?.isConnected) {
      event.preventDefault();
      openerRef.current.focus();
    }
  };
  return <div className="w-full min-w-0">
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose?.(); }}>
      <DialogContent data-shell-dialog ref={seenRef} showCloseButton={false} className="flex max-h-dvh min-w-0 max-w-full flex-col overflow-hidden" onOpenAutoFocus={focusSettings} onCloseAutoFocus={restoreFocus}>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" aria-label="Close settings" className="absolute right-space-2 top-space-2"><XIcon /></Button></DialogClose>
        <DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Manage workspace settings.</DialogDescription></DialogHeader>
        <Tabs value={tab} onValueChange={(value) => onTabChange?.(value as View)} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TabsList className="h-auto w-full flex-wrap">{views.map(({ id, label }) => <TabsTrigger key={id} value={id} className="min-h-control min-w-0 whitespace-normal break-words">{label}</TabsTrigger>)}</TabsList>
          {views.map(({ id, label }) => <TabsContent key={id} value={id} className="min-h-0 min-w-0 flex-1 overflow-y-auto break-words rounded-md token-border border-border p-space-3"><h3 className="mb-space-2 font-semibold">{label}</h3>{slots[id]}</TabsContent>)}
        </Tabs>
      </DialogContent>
    </Dialog>
  </div>;
}
