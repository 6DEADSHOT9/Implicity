import { useEffect, useRef } from "react";
import { cn } from "cn";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Switch } from "../../components/ui/switch";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Widget = { id: string; label: string; enabled: boolean };
type Props = {
  open: boolean;
  title: string;
  widgets: readonly Widget[];
  availableWidgets: readonly { id: string; label: string }[];
  onOpenChange?: (open: boolean) => void;
  onWidgetChange?: (id: string, enabled: boolean) => void;
  onAdd?: (id: string) => void;
};

export function WidgetPicker({ open, title, widgets, availableWidgets, onOpenChange, onWidgetChange, onAdd }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const initialState = useRef(open ? "open" : "closed");
  const previousOpen = useRef(open);
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
    <Dialog open={open} onOpenChange={onOpenChange} modal={Boolean(onOpenChange)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" ref={!open ? seenRef : undefined}>Customize</Button>
      </DialogTrigger>
      <DialogContent
        ref={open ? seenRef : undefined}
        className={cn("box-border flex max-h-viewport-content max-w-full flex-col overflow-hidden", widgets.length > 2 && "h-full top-0 translate-y-0")}
        showCloseButton={false}
        onOpenAutoFocus={(event) => { if (!onOpenChange) event.preventDefault(); }}
      >
        <DialogHeader className="min-w-0 pr-space-6">
          <DialogTitle className="min-w-0 break-words" style={{ fontSize: "var(--heading-4)" }}>{title}</DialogTitle>
          <DialogDescription>Choose which widgets appear on Home. Dismiss removes a widget.</DialogDescription>
        </DialogHeader>
        <Card className="min-h-0 min-w-0 max-h-content-height flex-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-space-2">
            <CardTitle className="min-w-0">Widgets</CardTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="min-h-control min-w-control" aria-label="Close widget picker">
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 max-h-content-height flex-1">
              <div className="min-w-0 break-words">
                <div className="flex flex-col">
                  {widgets.map((widget, index) => (
                    <label key={`${widget.id}-${index}`} className="flex min-h-control items-center justify-between gap-space-4">
                      <span>{widget.label}</span>
                      <Switch checked={widget.enabled} onCheckedChange={(enabled) => {
                        if (enabled === widget.enabled) return;
                        emit("setting_changed", { dimension: "home_widgets", value: enabled ? "on" : "off", component: widget.id });
                        onWidgetChange?.(widget.id, enabled);
                      }} />
                    </label>
                  ))}
                </div>
                <div className="flex flex-col">
                  {availableWidgets.map((widget, index) => (
                    <Button key={`${widget.id}-${index}`} type="button" variant="outline" onClick={() => onAdd?.(widget.id)}>
                      Add {widget.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
