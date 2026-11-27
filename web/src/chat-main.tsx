import { createRoot } from "react-dom/client";
import look from "../../contracts/looks/default.json" with { type: "json" };
import { ChatApp } from "./chat-app";
import { applyLookTokens } from "./look-tokens";
import "./tokens.css";

applyLookTokens(document.documentElement, look, "light", look.density, String(look.text_size));
createRoot(document.getElementById("root")!).render(<ChatApp />);
