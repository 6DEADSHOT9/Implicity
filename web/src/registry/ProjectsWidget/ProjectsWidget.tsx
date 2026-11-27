import { BuiltinWidget } from "../BuiltinWidget";

type Props = { slots?: { content?: React.ReactNode[] } };

export function ProjectsWidget({ slots }: Props) {
  return <BuiltinWidget component="ProjectsWidget" defaultState="projects" emptyTitle="No projects yet" emptyDescription="Create a project to keep related work together." slots={slots} />;
}
