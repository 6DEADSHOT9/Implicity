import { createRoot } from "react-dom/client";
import { Gallery } from "./gallery";
import "./tokens.css";
import { BrowserCaptureProvider } from "./registry/capture";
import { registry } from "./registry";

createRoot(document.getElementById("root")!).render(<BrowserCaptureProvider registry={registry} enabled={import.meta.env.VITE_GALLERY_CAPTURE_ENABLED === "true"}><Gallery /></BrowserCaptureProvider>);
