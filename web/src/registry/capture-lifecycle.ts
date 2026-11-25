import { useEffect, useRef } from "react";
import type { useCapture } from "./capture";
import { useSeen } from "./use-seen";

type LifecycleCapture = ReturnType<typeof useCapture<"component_shown" | "component_seen">>;

export function useSkeletonCapture(capture: LifecycleCapture, component: string, defaultState: string) {
  const emit = useRef(capture.emit);
  emit.current = capture.emit;
  const seenRef = useSeen({ component, defaultState });

  useEffect(() => {
    emit.current("component_shown", { component, default_state: defaultState });
  }, [component, defaultState]);

  return seenRef;
}
