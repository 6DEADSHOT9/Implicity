import { Children, isValidElement, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { marked } from "marked";
import { defaultRemarkPlugins, defaultUrlTransform, Streamdown } from "streamdown";
import type { Components } from "streamdown";
import actions from "../../../../contracts/actions.json";
import { Button } from "../../components/ui/button";
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
  const cells = rows.map((row) => Children.toArray(row.props.children)
    .filter(isValidElement<ElementWithChildren>)
    .map((cell) => cell.props.children ?? null));
  // Streamdown requires a body row for a header-only GFM table; remove its parser placeholder.
  const bodyCells = cells.slice(1).filter((row) => !row.every((cell) => textContent(cell) === "\u200b"));
  return { columns: cells[0]?.map(textContent) ?? [], renderedColumns: cells[0] ?? [], rows: bodyCells.map((row) => row.map(textContent)), renderedRows: bodyCells };
}

function MarkdownTable({ children }: ComponentProps<"table">) {
  const { columns, renderedColumns, rows, renderedRows } = tableData(children ?? null);
  return <DataTable columns={columns} renderedColumns={renderedColumns} rows={rows} renderedRows={renderedRows} showEmptyHeaders chartValues={undefined} form="table" state="default" />;
}

const markdownComponents: Components = {
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
};

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

function markdownBlocks(content: string) {
  let spacing = "";
  const blocks: string[] = [];
  const definitions: string[] = [];
  for (const token of marked.lexer(content)) {
    if (token.type === "space") spacing += token.raw;
    else if (token.type === "def") definitions.push(token.raw);
    else {
      blocks.push(spacing + token.raw);
      spacing = "";
    }
  }
  if (spacing && blocks.length) blocks[blocks.length - 1] += spacing;
  return { blocks, definitions };
}

function Markdown({ content }: { content: string }) {
  const markdown = marked.lexer(content).map((token) => token.type === "table" && token.rows.length === 0
    ? `${token.raw}${token.raw.endsWith("\n") ? "" : "\n"}|${token.header.map(() => "\u200b").join("|")}|\n`
    : token.raw).join("");
  return <Streamdown
    remarkPlugins={[...Object.values(defaultRemarkPlugins), rawHtmlAsText]}
    urlTransform={(url, key, node) => key === "src" ? url : defaultUrlTransform(url, key, node)}
    controls={false}
    linkSafety={{ enabled: false }}
    codeBlockMaxHeight={0}
    tableMaxHeight={0}
    components={markdownComponents}
  >{markdown}</Streamdown>;
}

type LongAnswerState = "folded" | "open";

export function MessageBody({ content, streaming = false, initiallyOpen = false, longAnswerState = "folded" }: { content: string; streaming?: boolean; initiallyOpen?: boolean; longAnswerState?: LongAnswerState }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const isLong = content.length >= actions.length_cutoffs.answer.long;
  const [state, setState] = useState<LongAnswerState>(() => streaming || initiallyOpen ? "open" : longAnswerState);
  const displayedState = isLong ? (streaming ? "open" : state) : "message";
  const shortSeenRef = useSeen({ component: "MessageBody", defaultState: "message" });
  const longSeenRef = useSeen({ component: "MessageBody", defaultState: displayedState, slot: "long_answer" });
  const previousState = useRef(displayedState);
  useEffect(() => {
    emitRef.current("component_shown", {
      component: "MessageBody",
      default_state: displayedState,
      ...(isLong ? { slot: "long_answer" } : {}),
    });
  }, []);
  useEffect(() => {
    if (!isLong || previousState.current === displayedState) return;
    if (previousState.current !== "message") emitRef.current(displayedState === "open" ? "section_expanded" : "section_collapsed", { component: "MessageBody", slot: "long_answer" });
    previousState.current = displayedState;
  }, [displayedState, isLong]);
  const { blocks, definitions } = isLong ? markdownBlocks(content) : { blocks: [], definitions: [] };
  let leadLength = 0;
  let leadEnd = 0;
  for (const block of blocks) {
    if (leadEnd > 0 && leadLength + block.length > actions.length_cutoffs.answer.medium) break;
    leadLength += block.length;
    leadEnd++;
    if (leadLength >= actions.length_cutoffs.answer.medium) break;
  }
  const lead = blocks.slice(0, leadEnd).join("") + (definitions.length ? `\n\n${definitions.join("")}` : "");
  const visibleContent = !isLong || displayedState === "open" ? content : lead;
  return <div ref={isLong ? longSeenRef : shortSeenRef} role={isLong ? "region" : undefined} aria-label={isLong ? "Long answer" : undefined} data-slot={isLong ? "long_answer" : undefined} data-state={isLong ? displayedState : undefined} className="w-full min-w-0 max-w-full">
    <Message role="article" from="assistant" aria-label="Message">
      <MessageContent className="w-full min-w-0 max-w-full break-words [&_a]:break-all [&_ol]:my-space-2 [&_ol]:list-decimal [&_ol]:ps-space-6 [&_ul]:my-space-2 [&_ul]:list-disc [&_ul]:ps-space-6 [&_li]:my-space-1 [&_h1]:text-heading-1 [&_h2]:text-heading-2 [&_h3]:text-heading-3 [&_h4]:text-heading-4 [&_h5]:text-heading-5 [&_h6]:text-heading-6">
        <Markdown content={visibleContent} />
        {isLong && !streaming && displayedState === "folded"
          ? <Button variant="ghost" onClick={() => setState("open")}>Show more</Button>
          : null}
        {isLong && !streaming && displayedState === "open"
          ? <Button variant="ghost" onClick={() => setState("folded")}>Show less</Button>
          : null}
      </MessageContent>
    </Message>
  </div>;
}
