import { Progress } from "../../components/ui/progress";
import { BuiltinWidget } from "../BuiltinWidget";

type Props = {
  progress: number;
  slots?: { content?: React.ReactNode[] };
};

export function NowPlayingWidget({ progress, slots }: Props) {
  const leadingContent = slots?.content?.length ? <Progress aria-label="Playback progress" value={progress} max={100} /> : undefined;
  return <BuiltinWidget component="NowPlayingWidget" defaultState="now-playing" emptyTitle="Nothing is playing" emptyDescription="Start audio or video to see it here." leadingContent={leadingContent} slots={slots} />;
}
