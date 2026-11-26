import { createRoot } from "react-dom/client";
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
const path = "/" + "very-long-file-name/".repeat(35) + "report.pdf";
const markdown = `[Long link](${long})\n\n\`\`\`text\ncode\n\`\`\`\n\n| Column | Value |\n| --- | --- |\n| Name | A |\n\n![blocked](http://tracker.invalid/pixel.png)\n\n![Remote preview](https://tracker.invalid/fail.png)`;

createRoot(document.getElementById("root")!).render(<CaptureProvider sink={() => undefined}>
  <main style={{ boxSizing: "border-box", width: "100%", minWidth: 0, padding: 12, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
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
