import { useEffect, useRef } from "react";
import { Suggestion } from "../../components/ai-elements/suggestion";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Command = { id: string; label: string };
export function ShortcutChips({ commands, onCommand }: { commands: readonly Command[]; onCommand?: (command: string) => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "ShortcutChips", defaultState: "suggested" });
  useEffect(() => { emitRef.current("component_shown", { component: "ShortcutChips", default_state: "suggested" }); }, []);
  return <div ref={seenRef} role="group" aria-label="Suggested commands" className="flex min-w-0 max-w-full flex-wrap gap-space-2">{commands.map(({ id, label }) => <Suggestion key={id} suggestion={label} onClick={() => onCommand?.(id)} className="min-h-control min-w-0 max-w-full shrink whitespace-normal break-all">{label}</Suggestion>)}</div>;
}
