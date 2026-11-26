import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { Message, MessageContent } from "../../components/ai-elements/message";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

export function MessageBody({ content }: { content: string }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "MessageBody", defaultState: "message" });
  useEffect(() => { emitRef.current("component_shown", { component: "MessageBody", default_state: "message" }); }, []);
  return <div ref={seenRef}><Message role="article" from="assistant" aria-label="Message"><MessageContent className="min-w-0 max-w-full break-words [&_a]:break-all [&_ol]:my-space-2 [&_ol]:list-decimal [&_ol]:ps-space-6 [&_ul]:my-space-2 [&_ul]:list-disc [&_ul]:ps-space-6 [&_li]:my-space-1 [&_h1]:text-heading-1 [&_h2]:text-heading-2 [&_h3]:text-heading-3 [&_h4]:text-heading-4 [&_h5]:text-heading-5 [&_h6]:text-heading-6"><Streamdown>{content}</Streamdown></MessageContent></Message></div>;
}
