import { useEffect, useId, useRef } from "react";
import { Attachment, AttachmentInfo, AttachmentRemove, Attachments, type AttachmentData } from "../../components/ai-elements/attachments";
import { PromptInput, PromptInputActionAddAttachments, PromptInputActionMenu, PromptInputActionMenuContent, PromptInputActionMenuTrigger, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools, usePromptInputAttachments, type PromptInputMessage } from "../../components/ai-elements/prompt-input";
import { Button } from "../../components/ui/button";
import { Item } from "../../components/ui/item";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { attachments: string[]; shortcuts: { id: string; label: string }[]; onSubmit?: (message: PromptInputMessage) => void | Promise<void>; onShortcut?: (commandId: string) => void; onAttachmentsChange?: (files: AttachmentData[]) => void };
function PendingAttachments({ onChange }: { onChange?: Props["onAttachmentsChange"] }) {
  const { files, remove } = usePromptInputAttachments();
  useEffect(() => onChange?.(files), [files, onChange]);
  if (!files.length) return null;
  return <Attachments variant="list" aria-label="Selected files">{files.map((file) => <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}><AttachmentInfo /><AttachmentRemove label={`Remove ${file.filename ?? "attachment"}`} /></Attachment>)}</Attachments>;
}

export function Composer({ attachments, shortcuts, onSubmit, onShortcut, onAttachmentsChange }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const inputId = useId();
  const seenRef = useSeen({ component: "Composer", defaultState: attachments.length ? "with-attachments" : "empty" });
  useEffect(() => { emitRef.current("component_shown", { component: "Composer", default_state: attachments.length ? "with-attachments" : "empty" }); }, []);
  return <section ref={seenRef} aria-label="Message composer" className="flex min-w-0 flex-col gap-space-2 box-border w-full">
    {attachments.length > 0 && <ul aria-label="Example attachments" className="m-0 flex flex-wrap gap-space-2 p-0">{attachments.map((item, index) => <li className="list-none" key={`${item}-${index}`}><Item size="sm" className="max-w-full break-all">{item}</Item></li>)}</ul>}
    <PromptInput onSubmit={(message) => onSubmit?.(message)} className="box-border min-w-0 w-full">
      <PendingAttachments onChange={onAttachmentsChange} />
      <PromptInputTextarea id={inputId} aria-label="Message" placeholder="Write a message" className="box-border min-w-0 w-full" style={{ minHeight: "var(--control-height)" }} />
      <PromptInputFooter><PromptInputTools className="flex-wrap"><PromptInputActionMenu><PromptInputActionMenuTrigger aria-label="Add attachment" /><PromptInputActionMenuContent><PromptInputActionAddAttachments /></PromptInputActionMenuContent></PromptInputActionMenu>{shortcuts.map(({ id, label }) => <Button type="button" key={id} size="sm" variant="outline" className="min-w-0 max-w-full whitespace-normal break-all" onClick={() => { emit("shortcut_used", { command: id }); onShortcut?.(id); }}>{label}</Button>)}</PromptInputTools><PromptInputSubmit /></PromptInputFooter>
    </PromptInput>
  </section>;
}
