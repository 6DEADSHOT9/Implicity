import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { galleryRegistry } from "./gallery-metadata";

const params = new URLSearchParams(location.search);
const names = new Set(params.get("ids")?.split(","));
const registry = galleryRegistry(names, location.search);
const initialDeviceClass = params.get("device") === "tablet" ? "tablet" : "desktop";

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} initialDeviceClass={initialDeviceClass} />);
