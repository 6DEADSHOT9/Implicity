import { createRoot } from "react-dom/client";
import type { CSSProperties } from "react";
import defaultLook from "../../../contracts/looks/default.json" with { type: "json" };
import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };
import { CaptureProvider } from "../../src/registry";
import { MessageBody } from "../../src/registry/MessageBody/MessageBody";
import { Details } from "../../src/registry/Details/Details";
import { RunActivity } from "../../src/registry/RunActivity/RunActivity";
import { MessageActions } from "../../src/registry/MessageActions/MessageActions";
import { AttachmentTray } from "../../src/registry/AttachmentTray/AttachmentTray";
import { Citation } from "../../src/registry/Citation/Citation";
import { ContextChip } from "../../src/registry/ContextChip/ContextChip";
import { ShortcutChips } from "../../src/registry/ShortcutChips/ShortcutChips";
import { ApprovalRequest } from "../../src/registry/ApprovalRequest/ApprovalRequest";
import "../../src/tokens.css";

const long = "https://tracker.invalid/" + "segment/".repeat(50);
const path = "unbrokenfilename".repeat(30);
const plainText = "unbrokenmessage".repeat(30);
const longAlt = "unbrokenalt".repeat(40);
const httpsFixtureUrl = (window as Window & { __httpsFixtureUrl?: string }).__httpsFixtureUrl ?? "https://tracker.invalid/success.png";
const markdown = [
  `[Long link](${long})`,
  plainText,
  "Inline `code`",
  "> A block quote",
  "---",
  "```text\ncode\n```",
  "```\nunlabeled code block\n```",
  "| Column | Value |\n| --- | --- |\n| Name | A |",
  "![blocked](http://tracker.invalid/pixel.png)",
  `![${longAlt}](http://tracker.invalid/long-alt.png)`,
  "![failed preview](https://tracker.invalid/fail.png)",
  `![Cross-origin preview](${httpsFixtureUrl})`,
  '<picture><source srcset="http://tracker.invalid/picture.png 1x, data:image/png;base64,AAAA 2x"><img src="http://tracker.invalid/picture.png" alt="raw html"></picture>',
].join("\n\n");
const tokenStyles = {
  ...Object.fromEntries(Object.entries(defaultLook.light).map(([name, value]) => [`--${name}`, value])),
  ...Object.fromEntries(Object.entries(tokens.sharedPalette.light).map(([name, value]) => [`--${name}`, value])),
  ...tokens.derivedTokens.radius[defaultLook.radius as keyof typeof tokens.derivedTokens.radius],
  ...tokens.derivedTokens.density[defaultLook.density as keyof typeof tokens.derivedTokens.density],
  ...tokens.derivedTokens.dimensions,
  "--font-body": JSON.stringify(tokens.typefaces[defaultLook.typeface.body as keyof typeof tokens.typefaces].family),
} as unknown as CSSProperties;

createRoot(document.getElementById("root")!).render(<CaptureProvider sink={() => undefined}>
  <main data-look={defaultLook.id} data-mode="light" style={{ ...tokenStyles, boxSizing: "border-box", width: "100%", minWidth: 0, padding: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--space-4)" }}>
    <section className="case" style={{ minWidth: 0 }} data-skeleton="MessageBody"><MessageBody content={markdown} /></section>
    <section className="case" data-skeleton="Details"><Details title={long} content={long} open /></section>
    <section className="case" data-skeleton="RunActivity"><RunActivity title={long} open steps={[{ label: long, status: "running" }]} /></section>
    <section className="case" data-skeleton="MessageActions"><MessageActions answer_form="prose" version_index={2} version_count={3} /></section>
    <section className="case" data-skeleton="AttachmentTray"><AttachmentTray attachments={[{ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3304", name: path, type: "document" }]} /></section>
    <section className="case" data-skeleton="Citation"><Citation label={long} source={long} source_type="web" /></section>
    <section className="case" data-skeleton="ContextChip"><ContextChip detail={long} kind="remembered" /></section>
    <section className="case" data-skeleton="ShortcutChips"><ShortcutChips commands={[{ id: "copy_answer", label: long }]} /></section>
    <section className="case" data-skeleton="ApprovalRequest"><ApprovalRequest title={long} detail={long} state="pending" /></section>
  </main>
</CaptureProvider>);
