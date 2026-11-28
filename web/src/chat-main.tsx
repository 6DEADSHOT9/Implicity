import { createRoot } from "react-dom/client";
import look from "../../contracts/looks/default.json" with { type: "json" };
import { ChatApp } from "./chat-app";
import { applyLookTokens } from "./look-tokens";
import "./tokens.css";

const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const applyMode = () => {
  const mode = colorScheme.matches ? "dark" : "light";
  applyLookTokens(document.documentElement, look, mode, look.density, String(look.text_size));
  document.documentElement.style.colorScheme = mode;
  document.body.style.backgroundColor = "var(--background)";
};
applyMode();
colorScheme.addEventListener("change", applyMode);
createRoot(document.getElementById("root")!).render(<ChatApp />);
