import { createRoot } from "react-dom/client";
import { ChatApp } from "../../src/chat-app";
import { CaptureProvider } from "../../src/registry/capture";
import "../../src/tokens.css";

window.chatSeenEvents = [];

createRoot(document.getElementById("root")!).render(
  <CaptureProvider sink={(event) => window.chatSeenEvents.push(event)}>
    <ChatApp />
  </CaptureProvider>,
);
