import { useEffect, useRef } from "react";
import { FileText, File, Image, Music, Video } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Attachment = { id: string; name: string; type: "image" | "document" | "audio" | "video" | "other" };
const icons = { image: Image, document: FileText, audio: Music, video: Video, other: File };
export function AttachmentTray({ attachments }: { attachments: readonly Attachment[] }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "AttachmentTray", defaultState: attachments.length ? "attached" : "empty" });
  useEffect(() => { emitRef.current("component_shown", { component: "AttachmentTray", default_state: attachments.length ? "attached" : "empty" }); }, []);
  return <div ref={seenRef} role="group" aria-label="Attachments" className="flex min-w-0 flex-wrap gap-space-2">{attachments.length ? attachments.map(({ id, name, type }) => { const Icon = icons[type]; return <Badge key={id} variant="secondary" className="flex h-auto min-h-control min-w-0 max-w-full items-center gap-space-2 px-space-3 py-space-2"><Icon aria-hidden="true" className="size-icon shrink-0" /><span className="min-w-0 break-all">{name}</span></Badge>; }) : <span className="visually-hidden">No attachments</span>}</div>;
}
