import { useEffect, useRef, type ReactNode } from "react";
import { Empty, EmptyDescription, EmptyTitle } from "../components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "../components/ui/item";
import { useCapture } from "./capture";
import { useSeen } from "./use-seen";

type BuiltinWidgetId = "ResumeWidget" | "ProjectsWidget" | "ScheduledWidget" | "QuickPromptsWidget" | "NowPlayingWidget";

type Props = {
  component: BuiltinWidgetId;
  defaultState: string;
  emptyTitle: string;
  emptyDescription: string;
  slots?: { content?: ReactNode[] };
  leadingContent?: ReactNode;
};

export function BuiltinWidget({ component, defaultState, emptyTitle, emptyDescription, slots, leadingContent }: Props) {
  const { emit } = useCapture<"component_shown">();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component, defaultState });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component, default_state: defaultState });
  }, [component, defaultState]);

  return (
    <div ref={seenRef} className="min-w-0 break-words">
      {leadingContent}
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
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
