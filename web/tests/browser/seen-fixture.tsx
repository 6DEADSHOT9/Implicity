import { createRoot } from "react-dom/client";
import { CaptureProvider } from "../../src/registry/capture";
import { MessageBody } from "../../src/registry/MessageBody/MessageBody";
import "../../src/tokens.css";

window.seenEvents = [];
const content = Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1}: ${"A long answer stays open and readable on a narrow screen. ".repeat(4)}`).join("\n\n");

createRoot(document.getElementById("root")!).render(
  <CaptureProvider sink={(event) => window.seenEvents.push(event)}>
    <MessageBody content={content} initiallyOpen />
  </CaptureProvider>,
);
