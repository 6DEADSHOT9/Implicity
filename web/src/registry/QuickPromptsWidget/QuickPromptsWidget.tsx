import { BuiltinWidget } from "../BuiltinWidget";

type Props = { slots?: { content?: React.ReactNode[] } };

export function QuickPromptsWidget({ slots }: Props) {
  return <BuiltinWidget component="QuickPromptsWidget" defaultState="quick-prompts" emptyTitle="No prompts yet" emptyDescription="Useful prompts will appear here." slots={slots} />;
}
