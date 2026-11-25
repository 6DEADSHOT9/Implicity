import { useEffect, useRef } from "react";
import type { useCapture } from "./capture";

// TODO(#74): replace this local seen observer with the shared useSeen() helper when PR #75 lands.
type LifecycleCapture = ReturnType<typeof useCapture<"component_shown" | "component_seen">>;

export function useSkeletonCapture(capture: LifecycleCapture, component: string, defaultState: string) {
  const elementRef = useRef<HTMLElement>(null);
  const root = (element: HTMLElement | null) => { elementRef.current = element; };
  const emit = useRef(capture.emit);
  emit.current = capture.emit;

  useEffect(() => {
    emit.current("component_shown", { component, default_state: defaultState });
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timer === undefined) {
        timer = setTimeout(() => {
          emit.current("component_seen", { component, default_state: defaultState, seconds_visible: 3 });
          timer = undefined;
        }, 3000);
      } else if (!entry.isIntersecting && timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [component, defaultState]);

  return root;
}
