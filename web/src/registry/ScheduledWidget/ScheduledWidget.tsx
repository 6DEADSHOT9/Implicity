import { BuiltinWidget } from "../BuiltinWidget";

type Props = { slots?: { content?: React.ReactNode[] } };

export function ScheduledWidget({ slots }: Props) {
  return <BuiltinWidget component="ScheduledWidget" defaultState="scheduled" emptyTitle="Nothing scheduled" emptyDescription="Scheduled work will appear here." slots={slots} />;
}
