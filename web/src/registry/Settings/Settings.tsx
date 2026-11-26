import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

const views = [{ id: "preferences", label: "Preferences" }, { id: "locks", label: "Locks" }, { id: "notices", label: "What Implicity notices" }, { id: "history", label: "Change history" }, { id: "quota", label: "Quota" }] as const;
type View = typeof views[number]["id"];
type Props = { tab: View; onTabChange?: (tab: View) => void; onClose?: () => void; slots?: Partial<Record<View, ReactNode[]>> };
export function Settings({ tab, onTabChange, onClose, slots = {} }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId(); const seenRef = useSeen({ component: "Settings", defaultState: tab });
  useEffect(() => { emitRef.current("component_shown", { component: "Settings", default_state: tab }); }, []);
  return <section ref={seenRef} aria-labelledby={titleId} className="flex min-w-0 flex-col gap-space-3 rounded-lg border-token border-border p-space-3">
    <header className="flex min-w-0 items-center justify-between gap-space-2"><h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">Settings</h2><Button type="button" variant="ghost" onClick={onClose}>Close settings</Button></header>
    <Tabs value={tab} onValueChange={(value) => onTabChange?.(value as View)} className="min-w-0"><TabsList className="h-auto w-full flex-wrap">{views.map(({ id, label }) => <TabsTrigger key={id} value={id} className="min-w-0 whitespace-normal break-words">{label}</TabsTrigger>)}</TabsList>
      {views.map(({ id, label }) => <TabsContent key={id} value={id} className="min-w-0 break-words rounded-md border-token border-border p-space-3"><h3 className="mb-space-2 font-semibold">{label}</h3>{slots[id]}</TabsContent>)}
    </Tabs>
  </section>;
}
