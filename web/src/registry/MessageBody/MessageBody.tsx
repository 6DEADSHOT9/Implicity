import { useEffect, useRef, useState } from "react";
import { defaultRemarkPlugins, defaultUrlTransform, Streamdown } from "streamdown";
import { Message, MessageContent } from "../../components/ai-elements/message";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type MarkdownNode = { type: string; value?: string; lang?: string | null; children?: MarkdownNode[] };

function rawHtmlAsText() {
  return (tree: MarkdownNode) => {
    const visit = (parent: MarkdownNode) => parent.children?.forEach((node, index) => {
      if (node.type === "html") parent.children![index] = { type: "text", value: node.value ?? "" };
      else {
        if (node.type === "code" && !node.lang) node.lang = "text";
        visit(node);
      }
    });
    visit(tree);
  };
}

function RemoteImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  let host = "invalid image URL";
  let imageUrl: URL | undefined;
  try {
    imageUrl = new URL(src ?? "");
    host = imageUrl.hostname || imageUrl.protocol.slice(0, -1) || host;
  } catch { /* Keep the invalid URL placeholder. */ }
  const unavailable = failed || imageUrl?.protocol !== "https:" || !!imageUrl.username || !!imageUrl.password;
  return unavailable
    ? <span role="img" aria-label={`${alt || "Image"} — ${host}`} className="box-border inline-flex min-h-control max-w-full flex-wrap items-center gap-space-2 rounded-md border-token bg-muted px-space-3 text-sm"><span className="min-w-0 flex-1 break-words">{alt || "Image unavailable"}</span><span className="break-all text-muted-foreground">{host}</span></span>
    : <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-full max-w-full rounded-md border-token object-contain" />;
}

export function MessageBody({ content }: { content: string }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "MessageBody", defaultState: "message" });
  useEffect(() => { emitRef.current("component_shown", { component: "MessageBody", default_state: "message" }); }, []);
  return <div ref={seenRef} className="min-w-0 max-w-full">
    <Message role="article" from="assistant" aria-label="Message">
      <MessageContent className="min-w-0 max-w-full break-words [&_a]:break-all [&_ol]:my-space-2 [&_ol]:list-decimal [&_ol]:ps-space-6 [&_ul]:my-space-2 [&_ul]:list-disc [&_ul]:ps-space-6 [&_li]:my-space-1 [&_h1]:text-heading-1 [&_h2]:text-heading-2 [&_h3]:text-heading-3 [&_h4]:text-heading-4 [&_h5]:text-heading-5 [&_h6]:text-heading-6">
        <Streamdown
          remarkPlugins={[...Object.values(defaultRemarkPlugins), rawHtmlAsText]}
          urlTransform={(url, key, node) => key === "src" ? url : defaultUrlTransform(url, key, node)}
          controls={false}
          linkSafety={{ enabled: false }}
          codeBlockMaxHeight={0}
          tableMaxHeight={0}
          components={{
            a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="break-all font-medium text-primary">{children}</a>,
            code: ({ children, className }) => <code className={className ? `${className} font-mono text-sm` : "rounded-md bg-muted px-space-2 py-space-1 font-mono text-sm"}>{children}</code>,
            blockquote: ({ children }) => <blockquote className="my-space-4 border-s-token ps-space-3 text-muted-foreground">{children}</blockquote>,
            hr: () => <hr className="my-space-4 border-b-token border-border" />,
            pre: ({ children }) => <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md border-token bg-muted p-space-3 font-mono text-sm">{children}</pre>,
            table: ({ children }) => <div className="max-w-full overflow-x-auto rounded-md border-token"><table className="min-w-full text-sm">{children}</table></div>,
            th: ({ children }) => <th className="border-token px-space-3 py-space-2 text-start font-medium">{children}</th>,
            td: ({ children }) => <td className="border-token px-space-3 py-space-2 align-top">{children}</td>,
            img: ({ src, alt }) => <RemoteImage src={typeof src === "string" ? src : undefined} alt={alt} />,
          }}
        >{content}</Streamdown>
      </MessageContent>
    </Message>
  </div>;
}
