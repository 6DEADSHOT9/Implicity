import { useCallback, useEffect, useRef, useState } from "react";
import { useCapture } from "./capture";
import { SEEN_VISIBLE_RATIO, SEEN_VISIBLE_SECONDS } from "./capture-rules";

export { SEEN_VISIBLE_RATIO, SEEN_VISIBLE_SECONDS } from "./capture-rules";

type SeenRef = ((node: Element | null) => void) & { reportVisible(): boolean };

// shortcut: hidden then shown between checks may count, and clip-path is ignored; revisit if the contract requires continuous CSS-state tracking.

export function useSeen({ component, defaultState, slot, onVisible }: { component: string; defaultState: string; slot?: string; onVisible?: () => void }) {
  const { emit } = useCapture<"component_seen">();
  const emitRef = useRef(emit);
  const fieldsRef = useRef({ component, defaultState, slot });
  const onVisibleRef = useRef(onVisible);
  const notifiedVisibleRef = useRef(false);
  const observedElementRef = useRef<Element | null>(null);
  const intersectionVisibleRef = useRef(false);
  const emittedRef = useRef(false);
  emitRef.current = emit;
  fieldsRef.current = { component, defaultState, slot };
  onVisibleRef.current = onVisible;
  const [element, setElement] = useState<Element | null>(null);
  const reportVisible = useCallback(() => {
    const visible = intersectionVisibleRef.current && !!observedElementRef.current?.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    if (visible && !notifiedVisibleRef.current) {
      notifiedVisibleRef.current = true;
      onVisibleRef.current?.();
    }
    return visible;
  }, []);
  const ref = useCallback(((node: Element | null) => {
    observedElementRef.current = node;
    intersectionVisibleRef.current = false;
    setElement(node);
  }) as SeenRef, []);
  ref.reportVisible = reportVisible;

  useEffect(() => {
    if (!element || emittedRef.current) return;
    const observedElement = element;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let visibleSince: number | undefined;
    let intersectionVisible = false;
    let needsFreshSample = false;
    const clearTimer = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const resetStretch = () => {
      clearTimer();
      visibleSince = undefined;
      needsFreshSample = false;
    };
    const schedule = (delay?: number) => {
      if (timer !== undefined || emittedRef.current) return;
      const remaining = delay ?? (visibleSince === undefined
        ? SEEN_VISIBLE_SECONDS * 1000
        : Math.max(0, SEEN_VISIBLE_SECONDS * 1000 - (performance.now() - visibleSince)));
      timer = setTimeout(onTimer, remaining);
    };
    const requestFreshSample = () => {
      clearTimer();
      needsFreshSample = true;
      observer.unobserve(observedElement);
      observer.observe(observedElement);
    };
    const emitSeen = (time: number) => {
      emittedRef.current = true;
      const { component, defaultState, slot } = fieldsRef.current;
      emitRef.current("component_seen", {
        component,
        default_state: defaultState,
        seconds_visible: (time - (visibleSince ?? time)) / 1000,
        ...(slot === undefined ? {} : { slot }),
      });
    };
    const notifyVisible = () => {
      if (notifiedVisibleRef.current) return;
      reportVisible();
    };
    const applyEntries = (entries: IntersectionObserverEntry[]) => {
      const currentEntries = entries.filter(({ target }) => target === observedElement).sort((a, b) => a.time - b.time);
      let latestVisible = false;
      for (const entry of currentEntries) {
        intersectionVisible = entry.isIntersecting && entry.intersectionRatio >= SEEN_VISIBLE_RATIO;
        intersectionVisibleRef.current = intersectionVisible;
        if (!intersectionVisible) {
          resetStretch();
          continue;
        }

        latestVisible = observedElement.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        if (!latestVisible) {
          clearTimer();
          visibleSince = undefined;
          needsFreshSample = false;
          continue;
        }

        if (visibleSince === undefined) visibleSince = entry.time;
      }
      if (!currentEntries.length || !intersectionVisible) return;
      if (latestVisible) notifyVisible();
      if (!latestVisible) {
        schedule(250);
      } else if (needsFreshSample) {
        needsFreshSample = false;
        const elapsed = performance.now() - (visibleSince ?? performance.now());
        if (elapsed >= SEEN_VISIBLE_SECONDS * 1000) emitSeen(performance.now());
        else schedule();
      } else {
        schedule();
      }
    };
    function onTimer() {
      timer = undefined;
      applyEntries(observer.takeRecords());
      if (emittedRef.current || !intersectionVisible) return;
      if (!observedElement.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
        visibleSince = undefined;
        schedule(250);
        return;
      }
      notifyVisible();
      if (visibleSince === undefined) {
        requestFreshSample();
        return;
      }
      if (performance.now() - visibleSince < SEEN_VISIBLE_SECONDS * 1000) {
        schedule();
        return;
      }
      requestFreshSample();
    }

    const observer = new IntersectionObserver((entries) => applyEntries(entries), { threshold: [0, SEEN_VISIBLE_RATIO] });
    observer.observe(observedElement);
    return () => {
      clearTimer();
      observer.disconnect();
    };
  }, [element]);

  return ref;
}
