import { createRoot } from "react-dom/client";
import { Gallery } from "./gallery";
import { registry } from "./registry";
import "./tokens.css";

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
