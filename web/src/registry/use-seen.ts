import { useCallback, useEffect, useRef, useState } from "react";
import { useCapture } from "./capture";

export const SEEN_VISIBLE_RATIO = 0.5;
export const SEEN_VISIBLE_SECONDS = 3;

function isVisible(element: Element) {
  let clipLeft = 0;
  let clipRight = document.documentElement.clientWidth;
  let clipTop = 0;
  let clipBottom = document.documentElement.clientHeight;
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") return false;
    if (ancestor !== element) {
      const bounds = ancestor.getBoundingClientRect();
      if (["hidden", "clip", "scroll", "auto"].includes(style.overflowX)) {
        clipLeft = Math.max(clipLeft, bounds.left);
        clipRight = Math.min(clipRight, bounds.right);
      }
      if (["hidden", "clip", "scroll", "auto"].includes(style.overflowY)) {
        clipTop = Math.max(clipTop, bounds.top);
        clipBottom = Math.min(clipBottom, bounds.bottom);
      }
    }
  }

  const { top, right, bottom, left, width, height } = element.getBoundingClientRect();
  const area = width * height;
  if (!area) return false;
  const visibleWidth = Math.max(0, Math.min(right, clipRight) - Math.max(left, clipLeft));
  const visibleHeight = Math.max(0, Math.min(bottom, clipBottom) - Math.max(top, clipTop));
  return (visibleWidth * visibleHeight) / area >= SEEN_VISIBLE_RATIO;
}

export function useSeen({ component, defaultState, slot }: { component: string; defaultState: string; slot?: string }) {
  const { emit } = useCapture<"component_seen">();
  const emitRef = useRef(emit);
  const fieldsRef = useRef({ component, defaultState, slot });
  const emittedRef = useRef(false);
  emitRef.current = emit;
  fieldsRef.current = { component, defaultState, slot };
  const [element, setElement] = useState<Element | null>(null);
  const ref = useCallback((node: Element | null) => setElement(node), []);

  useEffect(() => {
    if (!element || emittedRef.current) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let visibleSince: number | undefined;
    let intersectionVisible = false;
    const clearStretch = () => {
      clearTimeout(timer);
      timer = undefined;
      visibleSince = undefined;
    };
    const schedule = () => {
      if (visibleSince === undefined || timer !== undefined || emittedRef.current) return;
      timer = setTimeout(() => {
        timer = undefined;
        applyEntries(observer.takeRecords());
        if (visibleSince === undefined || emittedRef.current) return;
        if (!intersectionVisible || !isVisible(element)) {
          clearStretch();
          return;
        }
        const secondsVisible = (performance.now() - visibleSince) / 1000;
        if (secondsVisible < SEEN_VISIBLE_SECONDS) {
          schedule();
          return;
        }
        clearTimeout(timer);
        timer = undefined;
        emittedRef.current = true;
        const { component, defaultState, slot } = fieldsRef.current;
        emitRef.current("component_seen", {
          component,
          default_state: defaultState,
          seconds_visible: secondsVisible,
          ...(slot === undefined ? {} : { slot }),
        });
      }, Math.max(0, SEEN_VISIBLE_SECONDS * 1000 - (performance.now() - visibleSince)));
    };
    const updateVisibility = (visible: boolean, time: number) => {
      intersectionVisible = visible;
      if (visible && isVisible(element)) {
        if (visibleSince === undefined) visibleSince = time;
        schedule();
      } else {
        clearStretch();
      }
    };
    const applyEntries = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries.filter(({ target }) => target === element).sort((a, b) => a.time - b.time)) {
        updateVisibility(entry.isIntersecting && entry.intersectionRatio >= SEEN_VISIBLE_RATIO, entry.time);
      }
    };
    const observer = new IntersectionObserver((entries) => applyEntries(entries), { threshold: [0, SEEN_VISIBLE_RATIO] });
    const styles = new MutationObserver(() => {
      clearStretch();
      updateVisibility(intersectionVisible, performance.now());
    });
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      styles.observe(ancestor, { attributes: true, attributeFilter: ["class", "hidden", "style"] });
    }
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      styles.disconnect();
    };
  }, [element]);

  return ref;
}
