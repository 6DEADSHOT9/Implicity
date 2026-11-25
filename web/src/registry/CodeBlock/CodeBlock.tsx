import { useEffect, useState } from "react";
import type { z } from "zod";
import { createHighlighter, type BundledLanguage } from "shiki";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock as CodeBlockPrimitive } from "@/components/ai-elements/code-block";
import { StackTrace, StackTraceContent, StackTraceError, StackTraceErrorMessage, StackTraceErrorType, StackTraceFrames, StackTraceHeader } from "@/components/ai-elements/stack-trace";
import { Terminal, TerminalContent, TerminalHeader, TerminalTitle } from "@/components/ai-elements/terminal";
import { token } from "../token";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const highlighter = createHighlighter({ themes: [{ name: "registry-tokens", type: "dark", fg: token("--code-foreground"), bg: token("--code-background"), settings: [{ scope: ["comment", "punctuation.definition.comment"], settings: { foreground: token("--code-comment") } }, { scope: ["keyword", "storage"], settings: { foreground: token("--code-keyword") } }, { scope: ["string", "constant.character"], settings: { foreground: token("--code-string") } }, { scope: ["constant.numeric"], settings: { foreground: token("--code-number") } }, { scope: ["entity.name.function"], settings: { foreground: token("--code-function") } }, { scope: ["entity.name.type", "support.type"], settings: { foreground: token("--code-type") } }, { scope: ["keyword.operator"], settings: { foreground: token("--code-operator") } }, { scope: ["markup.inserted"], settings: { foreground: token("--code-string") } }, { scope: ["markup.deleted"], settings: { foreground: token("--code-keyword") } }] }], langs: ["text", "javascript", "typescript", "python", "json", "bash", "html", "css", "diff"] });
const languages = ["text", "javascript", "typescript", "python", "json", "bash", "html", "css", "diff"];
export function CodeBlock({ code, language, variant, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "CodeBlock", "default");
  const [tokens, setTokens] = useState<Array<Array<{ content: string; color?: string }>>>([]);
  useEffect(() => {
    if (state === "empty") { setTokens([]); return; }
    void highlighter.then((instance) => setTokens(instance.codeToTokens(code, { lang: languages.includes(language) ? language as BundledLanguage : "text", theme: "registry-tokens" }).tokens.map((line) => line.map((part) => ({ content: part.content, color: part.color })))));
  }, [code, language, state]);
  if (variant === "terminal") return <div ref={root}>
    <Terminal output={state === "empty" ? "" : code} role="region" aria-label="Terminal output">
      <TerminalHeader><TerminalTitle /></TerminalHeader>
      <TerminalContent className="bg-code-background text-code-foreground" />
    </Terminal>
  </div>;
  if (variant === "stack_trace") return <div ref={root}>
    <StackTrace trace={state === "empty" ? "" : code} defaultOpen>
      <StackTraceHeader><StackTraceError><StackTraceErrorType /><StackTraceErrorMessage className="text-code-foreground" /></StackTraceError></StackTraceHeader>
      <StackTraceContent><StackTraceFrames /></StackTraceContent>
    </StackTrace>
  </div>;
  return <Card ref={root}>
    <CardHeader><CardTitle className="text-heading-4">{language} · {variant}</CardTitle></CardHeader>
    <CardContent>
      {state === "error" ? <p role="alert">Code could not be loaded</p>
        : <CodeBlockPrimitive aria-label={`${language} ${variant}`} tabIndex={0}>
          <code>{tokens.length ? tokens.map((line, lineIndex) => <span className="block" key={lineIndex}>
            {line.map((part, partIndex) => <span key={partIndex} className={part.color === token("--code-comment") ? "text-code-comment" : part.color === token("--code-keyword") ? "text-code-keyword" : part.color === token("--code-string") ? "text-code-string" : part.color === token("--code-number") ? "text-code-number" : part.color === token("--code-function") ? "text-code-function" : part.color === token("--code-type") ? "text-code-type" : part.color === token("--code-operator") ? "text-code-operator" : "text-code-foreground"}>{part.content}</span>)}
          </span>) : state === "empty" ? "" : code}</code>
        </CodeBlockPrimitive>}
    </CardContent>
  </Card>;
}
