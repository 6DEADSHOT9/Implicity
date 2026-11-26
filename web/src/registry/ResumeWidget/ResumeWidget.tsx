import { useEffect, useRef } from "react";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "../../components/ui/item";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  slots?: { content?: React.ReactNode[] };
};

export function ResumeWidget({slots}: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "ResumeWidget", defaultState: "resume" });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component: "ResumeWidget", default_state: "resume" });
  }, []);

  return (
    <div ref={seenRef} className="min-w-0 break-words">
      {slots?.content?.length ? (
        <ItemGroup>
          {slots.content.map((item, index) => (
            <Item role="listitem" key={index} className="min-w-0 break-words">
              <ItemContent className="min-w-0 break-words">
                <ItemTitle className="block w-full min-w-0 break-words">{item}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty>
          <EmptyTitle>No recent work</EmptyTitle>
          <EmptyDescription>Continue a conversation or project to see it here.</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
