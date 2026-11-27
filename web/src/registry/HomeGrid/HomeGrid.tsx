import { useEffect, useId, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { title: string; slots?: { widgets?: React.ReactNode[] } };

export function HomeGrid({ title, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const seenRef = useSeen({ component: "HomeGrid", defaultState: "grid" });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component: "HomeGrid", default_state: "grid" });
  }, []);

  return (
    <Card ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 grid-rows-1">
        <CardTitle className="min-w-0">
          <h2 id={titleId} style={{ fontSize: "var(--heading-2)" }} className="min-w-0 break-words">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        {slots?.widgets?.length ? (
          <div className="grid min-w-0 grid-cols-1 gap-space-4 break-words sm:grid-cols-2 lg:grid-cols-3">
            {slots.widgets.map((widget, index) => (
              <div className="min-w-0 break-words" key={index}>{widget}</div>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyTitle>No widgets yet</EmptyTitle>
            <EmptyDescription>Customize Home to choose what appears here.</EmptyDescription>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
