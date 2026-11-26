import { useEffect, useRef } from "react";
import { Empty, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemTitle } from "../../components/ui/item";
import { Progress } from "../../components/ui/progress";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  progress: number;
  slots?: { content?: React.ReactNode[] };
};

export function NowPlayingWidget({ progress, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const seenRef = useSeen({ component: "NowPlayingWidget", defaultState: "now-playing" });
  emitRef.current = emit;

  useEffect(() => {
    emitRef.current("component_shown", { component: "NowPlayingWidget", default_state: "now-playing" });
  }, []);

  return (
    <div ref={seenRef} className="min-w-0 break-words">
      <Progress aria-label="Playback progress" value={progress} max={100} />
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
          <EmptyTitle>Nothing is playing</EmptyTitle>
          <EmptyDescription>Start audio or video to see it here.</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
