import { useCallback, useEffect, useRef, useState } from "react";
import { useCapture } from "./capture";

export const SEEN_VISIBLE_RATIO = 0.5;
export const SEEN_VISIBLE_SECONDS = 3;

export function useSeen({ component, defaultState, slot }: { component: string; defaultState: string; slot?: string }) {
  const { emit } = useCapture<"component_seen">();
  const emitRef = useRef(emit);
  const fieldsRef = useRef({ component, defaultState, slot });
  emitRef.current = emit;
  fieldsRef.current = { component, defaultState, slot };
  const [element, setElement] = useState<Element | null>(null);
  const ref = useCallback((node: Element | null) => setElement(node), []);

  useEffect(() => {
    if (!element) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let visibleSince: number | undefined;
    let emitted = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= SEEN_VISIBLE_RATIO) {
        if (visibleSince === undefined && !emitted) {
          visibleSince = Date.now();
          const startedAt = visibleSince;
          timer = setTimeout(() => {
            emitted = true;
            const { component, defaultState, slot } = fieldsRef.current;
            emitRef.current("component_seen", {
              component,
              default_state: defaultState,
              seconds_visible: (Date.now() - startedAt) / 1000,
              ...(slot === undefined ? {} : { slot }),
            });
          }, SEEN_VISIBLE_SECONDS * 1000);
        }
      } else {
        clearTimeout(timer);
        timer = undefined;
        visibleSince = undefined;
      }
    }, { threshold: SEEN_VISIBLE_RATIO });

    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [element]);

  return ref;
}
