import { useEffect, useRef } from "react";
import { Suggestions, Suggestion } from "../../components/ai-elements/suggestion";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Command = { id: string; label: string };
export function ShortcutChips({ commands, onCommand }: { commands: readonly Command[]; onCommand?: (command: string) => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "ShortcutChips", defaultState: "suggested" });
  useEffect(() => { emitRef.current("component_shown", { component: "ShortcutChips", default_state: "suggested" }); }, []);
  return <div ref={seenRef} role="group" aria-label="Suggested commands"><Suggestions>{commands.map(({ id, label }) => <Suggestion key={id} suggestion={label} onClick={() => onCommand?.(id)} className="min-h-control max-w-full whitespace-normal">{label}</Suggestion>)}</Suggestions></div>;
}
