import { useEffect, useRef } from "react";
import type { useCapture } from "./capture";
import { useSeen } from "./use-seen";

type LifecycleCapture = ReturnType<typeof useCapture<"component_shown" | "component_seen">>;

export function useSkeletonCapture(capture: LifecycleCapture, component: string, defaultState: string) {
  const emit = useRef(capture.emit);
  emit.current = capture.emit;
  const initial = useRef({ component, defaultState });
  const seenRef = useSeen(initial.current);

  useEffect(() => {
    emit.current("component_shown", { component: initial.current.component, default_state: initial.current.defaultState });
  }, []);

  return seenRef;
}
