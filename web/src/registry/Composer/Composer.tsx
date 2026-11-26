import { useEffect, useId, useRef } from "react";
import { PromptInput, PromptInputActionAddAttachments, PromptInputActionMenu, PromptInputActionMenuContent, PromptInputActionMenuTrigger, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "../../components/ai-elements/prompt-input";
import { Button } from "../../components/ui/button";
import { Item } from "../../components/ui/item";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { attachments: string[]; shortcuts: string[]; onSubmit?: (message: { text: string; files: unknown[] }) => void; onShortcut?: (shortcut: string) => void };
export function Composer({ attachments, shortcuts, onSubmit, onShortcut }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const inputId = useId(); const seenRef = useSeen({ component: "Composer", defaultState: attachments.length ? "with-attachments" : "empty" });
  useEffect(() => { emitRef.current("component_shown", { component: "Composer", default_state: attachments.length ? "with-attachments" : "empty" }); }, []);
  return <section ref={seenRef} aria-label="Message composer" className="flex min-w-0 flex-col gap-space-2">
    {attachments.length > 0 && <ul aria-label="Attachments" className="m-0 flex flex-wrap gap-space-2 p-0">{attachments.map((item, index) => <li className="list-none" key={`${item}-${index}`}><Item size="sm" className="max-w-full break-all">{item}</Item></li>)}</ul>}
    <PromptInput onSubmit={(message) => onSubmit?.(message)} className="min-w-0">
      <PromptInputTextarea id={inputId} aria-label="Message" placeholder="Write a message" />
      <PromptInputFooter><PromptInputTools className="flex-wrap"><PromptInputActionMenu><PromptInputActionMenuTrigger aria-label="Add attachment" /><PromptInputActionMenuContent><PromptInputActionAddAttachments /></PromptInputActionMenuContent></PromptInputActionMenu>{shortcuts.map((shortcut, index) => <Button type="button" key={`${shortcut}-${index}`} size="sm" variant="outline" className="max-w-full whitespace-normal break-words" onClick={() => onShortcut?.(shortcut)}>{shortcut}</Button>)}</PromptInputTools><PromptInputSubmit /></PromptInputFooter>
    </PromptInput>
  </section>;
}
