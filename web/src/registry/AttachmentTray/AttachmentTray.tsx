import { useEffect, useRef } from "react";
import { FileText, File, Image, Music, Video } from "lucide-react";
import { Attachment, AttachmentPreview, Attachments } from "../../components/ai-elements/attachments";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type AttachmentItem = { id: string; name: string; type: "image" | "document" | "audio" | "video" | "other" };
const icons = { image: Image, document: FileText, audio: Music, video: Video, other: File };
const mediaTypes = { image: "image/unknown", document: "application/octet-stream", audio: "audio/unknown", video: "video/unknown", other: "application/octet-stream" };

export function AttachmentTray({ attachments }: { attachments: readonly AttachmentItem[] }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const initialState = useRef(attachments.length ? "attached" : "empty").current;
  const seenRef = useSeen({ component: "AttachmentTray", defaultState: initialState });

  useEffect(() => {
    emitRef.current("component_shown", { component: "AttachmentTray", default_state: initialState });
  }, []);

  return <div ref={seenRef} className="min-w-0 max-w-full">
    <Attachments role="group" aria-label="Attachments" variant="list" className="min-w-0 max-w-full">
      {attachments.length ? attachments.map(({ id, name, type }) => {
        const Icon = icons[type];
        return <Attachment key={id} data={{ id, type: "source-document", sourceId: id, mediaType: mediaTypes[type], title: name, filename: name }} className="box-border flex min-w-0 max-w-full flex-1 items-start gap-space-3 whitespace-normal break-all">
          <AttachmentPreview fallbackIcon={<Icon aria-hidden="true" className="size-icon" />} />
          <div className="min-w-0 flex-1 whitespace-normal break-all">
            <span className="block min-w-0 whitespace-normal break-all">{name}</span>
            <span className="block text-muted-foreground text-xs">{type}</span>
          </div>
        </Attachment>;
      }) : <span className="visually-hidden">No attachments</span>}
    </Attachments>
  </div>;
}
