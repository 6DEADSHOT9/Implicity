import { useEffect, useId, useRef } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  title: string;
  lastUpdate: string;
  source: string;
  onDismiss?: () => void;
  slots?: { content?: React.ReactNode[] };
};

export function WidgetFrame({ title, lastUpdate, source, onDismiss, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const seenRef = useSeen({ component: "WidgetFrame", defaultState: "frame" });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component: "WidgetFrame", default_state: "frame" });
  }, []);

  return (
    <Card ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden">
      <CardHeader className="flex min-w-0 items-start gap-space-2">
        <div className="min-w-0 flex-1">
          <CardTitle>
            <h2 id={titleId} style={{ fontSize: "var(--heading-4)" }} className="min-w-0 break-words">{title}</h2>
          </CardTitle>
          <CardDescription className="break-words">{lastUpdate} · {source}</CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`Widget options for ${title}`}>
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="min-h-control" onSelect={onDismiss}>Dismiss</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="min-w-0">
        {slots?.content?.length ? slots.content.map((content, index) => (
          <div className="min-w-0 break-words" key={index}>{content}</div>
        )) : (
          <Empty>
            <EmptyTitle>No content yet</EmptyTitle>
            <EmptyDescription>This widget has nothing to show right now.</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
