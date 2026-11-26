import { useEffect, useRef } from "react";
import { Badge } from "../../components/ui/badge";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

export function Citation({ label, url, source_type }: { label: string; url: string; source_type: "web" | "memory" }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "Citation", defaultState: source_type });
  useEffect(() => { emitRef.current("component_shown", { component: "Citation", default_state: source_type }); }, []);
  return <Badge ref={seenRef} asChild variant="secondary" className="inline-flex h-auto min-h-control max-w-full whitespace-normal break-all px-space-3 py-space-2"><a href={url} target="_blank" rel="noreferrer" aria-label={`${source_type === "memory" ? "Memory" : "Source"}: ${label}`}>{label}</a></Badge>;
}
