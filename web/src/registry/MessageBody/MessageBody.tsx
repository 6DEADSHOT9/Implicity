import { Children, isValidElement, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { defaultRemarkPlugins, defaultUrlTransform, Streamdown } from "streamdown";
import type { Components } from "streamdown";
import { Message, MessageContent } from "../../components/ai-elements/message";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { DataTable } from "../DataTable/DataTable";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type MarkdownNode = { type: string; value?: string; lang?: string | null; children?: MarkdownNode[] };
type ElementWithChildren = { children?: ReactNode; className?: string };

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<ElementWithChildren>(node)) return textContent(node.props.children);
  return "";
}

function tableData(children: ReactNode) {
  const rows = Children.toArray(children).flatMap((section) => {
    if (!isValidElement<ElementWithChildren>(section)) return [];
    return Children.toArray(section.props.children).filter(isValidElement<ElementWithChildren>);
  });
  const values = rows.map((row) => Children.toArray(row.props.children)
    .filter(isValidElement<ElementWithChildren>)
    .map((cell) => textContent(cell.props.children)));
  return { columns: values[0] ?? [], rows: values.slice(1) };
}

function MarkdownTable({ children }: ComponentProps<"table">) {
  const { columns, rows } = tableData(children ?? null);
  return <DataTable columns={columns} rows={rows} chartValues={undefined} form="table" state="default" />;
}

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
    ? <span role="img" aria-label={`${alt || "Image"} — ${host}`} className="box-border inline-flex min-h-control max-w-full flex-wrap items-center gap-space-2 rounded-md token-border bg-muted px-space-3 text-sm"><span className="min-w-0 flex-1 break-words">{alt || "Image unavailable"}</span><span className="break-all text-muted-foreground">{host}</span></span>
    : <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="max-h-full max-w-full rounded-md token-border object-contain" />;
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
            code: ({ children, className }) => <code className={className ? "font-mono text-sm" : "rounded-md bg-muted px-space-2 py-space-1 font-mono text-sm"}>{children}</code>,
            blockquote: ({ children }) => <blockquote className="my-space-4 token-border-s ps-space-3 text-muted-foreground">{children}</blockquote>,
            hr: () => <hr className="my-space-4 token-border-b border-border" />,
            pre: ({ children }) => {
              const code = Children.only(children);
              const props = isValidElement<ElementWithChildren>(code) ? code.props : {};
              const language = props.className?.match(/language-([^\s]+)/)?.[1] ?? "text";
              return <CodeBlock code={textContent(props.children)} language={language} variant="code" state="default" />;
            },
            table: MarkdownTable as Components["table"],
            th: ({ children }) => <th scope="col" className="token-border px-space-3 py-space-2 text-start font-medium">{children}</th>,
            td: ({ children }) => <td className="token-border px-space-3 py-space-2 align-top">{children}</td>,
            img: ({ src, alt }) => <RemoteImage src={typeof src === "string" ? src : undefined} alt={alt} />,
          }}
        >{content}</Streamdown>
      </MessageContent>
    </Message>
  </div>;
}
