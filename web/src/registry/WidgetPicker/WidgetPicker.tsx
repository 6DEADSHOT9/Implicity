import { useCallback, useEffect, useRef } from "react";
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

type Widget = { widgetId: string; componentId: string; label: string; enabled: boolean };
type AvailableWidget = Pick<Widget, "widgetId" | "componentId" | "label">;
type Props = {
  open: boolean;
  title: string;
  widgets: readonly Widget[];
  availableWidgets: readonly AvailableWidget[];
  onOpenChange?: (open: boolean) => void;
  onWidgetChange?: (id: string, enabled: boolean) => boolean | Promise<boolean>;
  onAdd?: (id: string) => void;
  suppressInitialFocus?: boolean;
};
type WidgetChange = { componentId: string; enabled: boolean; accepted: boolean; pending: number; shown: boolean; settled: boolean };

function WidgetChoices({ widgets, availableWidgets, onWidgetChange, onAdd }: Pick<Props, "widgets" | "availableWidgets" | "onAdd"> & { onWidgetChange?: (id: string, enabled: boolean) => void }) {
  return (
    <ScrollArea className="min-h-0 max-h-content-height min-w-0 w-full flex-1">
      <div className="min-w-0 w-full">
        <div className="flex min-w-0 flex-col">
          {widgets.map((widget) => (
            <label key={widget.widgetId} className="flex min-h-control min-w-0 w-full items-center gap-space-4">
              <span className="min-w-0 flex-1 break-words wrap-anywhere">{widget.label}</span>
              <Switch className="shrink-0" checked={widget.enabled} onCheckedChange={(enabled) => {
                if (enabled !== widget.enabled) onWidgetChange?.(widget.widgetId, enabled);
              }} />
            </label>
          ))}
        </div>
        <div className="flex min-w-0 flex-col">
          {availableWidgets.map((widget) => (
            <Button key={widget.widgetId} type="button" variant="outline" className="h-auto min-h-control w-full min-w-0 justify-start whitespace-normal text-left" onClick={() => onAdd?.(widget.widgetId)}>
              <span className="min-w-0 break-words wrap-anywhere">Add {widget.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

export function WidgetPicker({ open, title, widgets, availableWidgets, onOpenChange, onWidgetChange, onAdd, suppressInitialFocus = false }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const initialState = useRef(open ? "open" : "closed");
  const previousOpen = useRef(open);
  const previousWidgets = useRef(new Map(widgets.map(({ widgetId, enabled }) => [widgetId, enabled])));
  const requestedChanges = useRef(new Map<string, WidgetChange[]>());
  const suppressInitialFocusRef = useRef(suppressInitialFocus && open);
  const seenRef = useSeen({ component: "WidgetPicker", defaultState: initialState.current });
  emitRef.current = emit;
  const finishRequest = useCallback((widgetId: string, request: WidgetChange, record: boolean) => {
    if (request.settled) return;
    request.settled = true;
    const changes = requestedChanges.current.get(widgetId)?.filter((change) => change !== request) ?? [];
    if (changes.length) requestedChanges.current.set(widgetId, changes);
    else requestedChanges.current.delete(widgetId);
    if (record) emitRef.current("setting_changed", { dimension: "home_widgets", value: request.enabled ? "on" : "off", component: request.componentId });
  }, []);
  const settleIfReady = useCallback((widgetId: string, request: WidgetChange) => {
    if (request.shown && request.accepted) finishRequest(widgetId, request, true);
    else if (request.pending === 0 && (request.shown || !request.accepted)) finishRequest(widgetId, request, false);
  }, [finishRequest]);

  useEffect(() => {
    if (previousOpen.current !== open) {
      emitRef.current(open ? "panel_opened" : "panel_closed", { component: "WidgetPicker" });
      previousOpen.current = open;
    }
  }, [open]);

  useEffect(() => {
    const previous = previousWidgets.current;
    for (const widget of widgets) {
      const wasEnabled = previous.get(widget.widgetId);
      if (wasEnabled === undefined || wasEnabled === widget.enabled) continue;
      const request = requestedChanges.current.get(widget.widgetId)?.find((change) => change.enabled === widget.enabled && !change.shown && !change.settled);
      if (request) {
        request.shown = true;
        settleIfReady(widget.widgetId, request);
      }
    }
    for (const widgetId of requestedChanges.current.keys()) {
      if (!widgets.some((widget) => widget.widgetId === widgetId)) {
        for (const request of requestedChanges.current.get(widgetId) ?? []) request.settled = true;
        requestedChanges.current.delete(widgetId);
      }
    }
    previousWidgets.current = new Map(widgets.map(({ widgetId, enabled }) => [widgetId, enabled]));
  }, [settleIfReady, widgets]);

  const handleWidgetChange = (widgetId: string, enabled: boolean) => {
    const current = widgets.find((widget) => widget.widgetId === widgetId);
    if (!current || current.enabled === enabled) return;
    const changes = requestedChanges.current.get(widgetId) ?? [];
    const request = changes.find((change) => change.enabled === enabled && !change.settled) ?? {
      componentId: current.componentId, enabled, accepted: false, pending: 0, shown: false, settled: false,
    };
    if (!changes.includes(request)) requestedChanges.current.set(widgetId, [...changes, request]);
    request.pending += 1;
    const settle = (accepted: boolean) => {
      if (request.settled) return;
      request.pending -= 1;
      request.accepted ||= accepted;
      settleIfReady(widgetId, request);
    };
    let result: ReturnType<NonNullable<Props["onWidgetChange"]>> | undefined;
    try {
      result = onWidgetChange?.(widgetId, enabled);
    } catch {
      settle(false);
      return;
    }
    if (typeof result === "boolean") settle(result);
    else if (result) void result.then(settle, () => settle(false));
    else settle(false);
  };

  useEffect(() => {
    emitRef.current("component_shown", { component: "WidgetPicker", default_state: initialState.current });
  }, []);

  if (!onOpenChange) {
    if (!open) return <span ref={seenRef}>Customize</span>;
    return (
      <section ref={seenRef} data-widget-picker-preview role="region" aria-label={title} className="min-w-0 max-w-full">
        <Card className="min-w-0 max-w-full overflow-hidden">
          <CardHeader className="min-w-0">
            <CardTitle data-widget-picker-title className="min-w-0 break-words wrap-anywhere" style={{ fontSize: "var(--heading-4)" }}>{title}</CardTitle>
            <CardDescription>Choose which widgets appear on Home. Dismiss removes a widget.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <CardTitle className="mb-space-2">Widgets</CardTitle>
            <WidgetChoices widgets={widgets} availableWidgets={availableWidgets} onWidgetChange={handleWidgetChange} onAdd={onAdd} />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" ref={!open ? seenRef : undefined}>Customize</Button>
      </DialogTrigger>
      <DialogContent
        ref={open ? seenRef : undefined}
        onOpenAutoFocus={(event) => {
          if (suppressInitialFocusRef.current) {
            event.preventDefault();
            suppressInitialFocusRef.current = false;
          }
        }}
        data-widget-picker-dialog
        className={cn("box-border flex max-h-viewport-content max-w-full flex-col overflow-hidden", widgets.length > 2 && "h-full top-0 translate-y-0")}
        showCloseButton={false}
      >
        <DialogHeader className="min-w-0 pr-space-6">
          <DialogTitle data-widget-picker-title className="min-w-0 break-words wrap-anywhere" style={{ fontSize: "var(--heading-4)" }}>{title}</DialogTitle>
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
            <WidgetChoices widgets={widgets} availableWidgets={availableWidgets} onWidgetChange={handleWidgetChange} onAdd={onAdd} />
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
