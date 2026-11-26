import { useEffect, useRef } from "react";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "../../components/ui/item";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  slots?: { content?: React.ReactNode[] };
};

export function ScheduledWidget({slots}: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "ScheduledWidget", defaultState: "scheduled" });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component: "ScheduledWidget", default_state: "scheduled" });
  }, []);

  return (
    <div ref={seenRef} className="min-w-0 break-words">
      {slots?.content?.length ? (
        <ItemGroup>
          {slots.content.map((item, index) => (
            <Item role="listitem" key={index} className="min-w-0 break-words">
              <ItemContent className="min-w-0 break-words">
                <ItemTitle className="min-w-0 break-words">{item}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty>
          <EmptyTitle>Nothing scheduled</EmptyTitle>
          <EmptyDescription>Scheduled work will appear here.</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
