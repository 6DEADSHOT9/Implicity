import { createRoot } from "react-dom/client";
import { ChatApp } from "./chat-app";
import "./tokens.css";

createRoot(document.getElementById("root")!).render(<ChatApp />);
