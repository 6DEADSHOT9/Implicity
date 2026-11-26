import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Switch } from "../../components/ui/switch";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  open: boolean;
  title: string;
  enabled: boolean;
  onOpenChange?: (open: boolean) => void;
  onEnabledChange?: (enabled: boolean) => void;
  onAddWidget?: () => void;
  slots?: { widgets?: React.ReactNode[] };
};

export function WidgetPicker({ open, title, enabled, onOpenChange, onEnabledChange, onAddWidget, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const initialState = useRef(open ? "open" : "closed");
  const previousOpen = useRef(open);
  const switchId = useId();
  const seenRef = useSeen({ component: "WidgetPicker", defaultState: initialState.current });
  emitRef.current = emit;

  useEffect(() => {
    if (previousOpen.current !== open) {
      emitRef.current(open ? "panel_opened" : "panel_closed", { component: "WidgetPicker" });
      previousOpen.current = open;
    }
  }, [open]);

  useEffect(() => {
    emitRef.current("component_shown", { component: "WidgetPicker", default_state: initialState.current });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" ref={!open ? seenRef : undefined}>Customize</Button>
      </DialogTrigger>
      <DialogContent
        ref={open ? seenRef : undefined}
        className="box-border flex max-h-content-height flex-col overflow-hidden"
        style={{ height: "var(--content-max-height)" }}
        showCloseButton={false}
      >
        <DialogHeader className="pr-space-6">
          <DialogTitle style={{ fontSize: "var(--heading-4)" }}>{title}</DialogTitle>
          <DialogDescription>Choose which widgets appear on Home.</DialogDescription>
        </DialogHeader>
        <Card className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-space-2">
            <CardTitle>Widgets</CardTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="min-h-control min-w-control" aria-label="Close widget picker">
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 max-h-content-height flex-1">
              <div className="min-w-0 break-words">
                <label htmlFor={switchId} className="flex min-h-control items-center justify-between gap-space-4">
                  <span>Show widgets</span>
                  <Switch id={switchId} checked={enabled} onCheckedChange={onEnabledChange} />
                </label>
                {slots?.widgets?.map((widget, index) => (
                  <div className="min-w-0 break-words" key={index}>{widget}</div>
                ))}
                <Button type="button" variant="outline" onClick={onAddWidget}>Add widget</Button>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
