import { BuiltinWidget } from "../BuiltinWidget";

type Props = { slots?: { content?: React.ReactNode[] } };

export function ResumeWidget({ slots }: Props) {
  return <BuiltinWidget component="ResumeWidget" defaultState="resume" emptyTitle="No recent work" emptyDescription="Continue a conversation or project to see it here." slots={slots} />;
}
