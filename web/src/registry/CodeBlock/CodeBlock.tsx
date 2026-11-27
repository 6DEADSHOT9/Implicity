import { useEffect, useState } from "react";
import type { z } from "zod";
import { getSingletonHighlighter, type BundledLanguage, type ThemeRegistration } from "shiki";
import { CodeBlock as CodeBlockPrimitive, CodeBlockContent, CodeBlockHeader, CodeBlockTitle } from "@/components/ai-elements/code-block";
import { StackTrace, StackTraceContent, StackTraceError, StackTraceErrorMessage, StackTraceErrorType, StackTraceFrames, StackTraceHeader } from "@/components/ai-elements/stack-trace";
import { Terminal, TerminalContent, TerminalHeader, TerminalTitle } from "@/components/ai-elements/terminal";
import { token } from "../token";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const highlightTheme = {
  name: "registry-tokens",
  type: "dark",
  fg: token("--code-foreground"),
  bg: token("--code-background"),
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: token("--code-comment") } },
    { scope: ["keyword", "storage"], settings: { foreground: token("--code-keyword") } },
    { scope: ["string", "constant.character"], settings: { foreground: token("--code-string") } },
    { scope: ["constant.numeric"], settings: { foreground: token("--code-number") } },
    { scope: ["entity.name.function"], settings: { foreground: token("--code-function") } },
    { scope: ["entity.name.type", "support.type"], settings: { foreground: token("--code-type") } },
    { scope: ["keyword.operator"], settings: { foreground: token("--code-operator") } },
    { scope: ["markup.inserted"], settings: { foreground: token("--code-string") } },
    { scope: ["markup.deleted"], settings: { foreground: token("--code-keyword") } },
  ],
} satisfies ThemeRegistration;
const languages = ["text", "javascript", "typescript", "python", "json", "bash", "html", "css", "diff"];
const syntaxClasses = new Map([
  [token("--code-comment"), "text-code-comment"],
  [token("--code-keyword"), "text-code-keyword"],
  [token("--code-string"), "text-code-string"],
  [token("--code-number"), "text-code-number"],
  [token("--code-function"), "text-code-function"],
  [token("--code-type"), "text-code-type"],
  [token("--code-operator"), "text-code-operator"],
]);
export function CodeBlock({ code, language, variant, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "CodeBlock", state === "default" ? variant ?? "code" : state);
  const [highlighted, setHighlighted] = useState<{ code: string; language: string; tokens: Array<Array<{ content: string; color?: string }>> }>();
  const lang = languages.includes(language) ? language as BundledLanguage : "text";
  const tokens = highlighted?.code === code && highlighted.language === lang ? highlighted.tokens : [];
  useEffect(() => {
    if (state === "empty" || state === "error" || variant === "terminal" || variant === "stack_trace") return;

    let current = true;
    void getSingletonHighlighter({ langs: [lang], themes: [highlightTheme] }).then((highlighter) => {
      if (!current) return;
      const { tokens } = highlighter.codeToTokens(code, { lang, theme: highlightTheme.name });
      setHighlighted({ code, language: lang, tokens });
    });
    return () => { current = false; };
  }, [code, lang, state, variant]);
  if (state === "error") return <CodeBlockPrimitive ref={root} language={language}><CodeBlockContent role="alert">Code could not be loaded</CodeBlockContent></CodeBlockPrimitive>;
  if (variant === "terminal") return <div ref={root}>
    <Terminal output={state === "empty" ? "" : code} role="region" aria-label="Terminal output">
      <TerminalHeader><TerminalTitle /></TerminalHeader>
      <TerminalContent tabIndex={0}>
        {state !== "empty" && <pre className="whitespace-pre-wrap break-words">{code.split("\n").map((line, index) => (
          <span className="block" key={index}>
            {line.startsWith("$ ")
              ? <><span className="text-terminal-prompt">$ </span><span>{line.slice(2)}</span></>
              : <span className={line.startsWith("Error") ? "text-terminal-error" : line.startsWith("Warning") ? "text-terminal-warning" : line.startsWith("Info") ? "text-terminal-info" : "text-terminal-success"}>{line}</span>}
          </span>
        ))}</pre>}
      </TerminalContent>
    </Terminal>
  </div>;
  if (variant === "stack_trace") return <div ref={root}>
    <StackTrace trace={state === "empty" ? "" : code} defaultOpen>
      <StackTraceHeader><StackTraceError><StackTraceErrorType /><StackTraceErrorMessage className="text-code-foreground" /></StackTraceError></StackTraceHeader>
      <StackTraceContent><StackTraceFrames /></StackTraceContent>
    </StackTrace>
  </div>;
  return <CodeBlockPrimitive ref={root} language={language}>
    <CodeBlockHeader><CodeBlockTitle>{language} · {variant}</CodeBlockTitle></CodeBlockHeader>
    <CodeBlockContent aria-label={`${language} ${variant}`} tabIndex={0}>
        {state === "empty" ? "" : tokens.length ? tokens.map((line, lineIndex) => <span className="block" key={lineIndex}>
          {line.map((part, partIndex) => <span key={partIndex} className={syntaxClasses.get(part.color ?? "") ?? "text-code-foreground"}>{part.content}</span>)}
        </span>) : code}
    </CodeBlockContent>
  </CodeBlockPrimitive>;
}
