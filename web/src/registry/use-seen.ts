import { useCallback, useEffect, useRef, useState } from "react";
import { useCapture } from "./capture";

export const SEEN_VISIBLE_RATIO = 0.5;
export const SEEN_VISIBLE_SECONDS = 3;

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
  const rootVisibleRef = useRef(true);
  const emittedRef = useRef(false);
  emitRef.current = emit;
  fieldsRef.current = { component, defaultState, slot };
  onVisibleRef.current = onVisible;
  const [element, setElement] = useState<Element | null>(null);
  const reportVisible = useCallback(() => {
    const visible = intersectionVisibleRef.current && rootVisibleRef.current && !!observedElementRef.current?.checkVisibility({ opacityProperty: true, visibilityProperty: true });
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
    let observer: IntersectionObserver;
    let viewportObserver: IntersectionObserver | undefined;
    let rootObserver: IntersectionObserver | undefined;
    let scrollRoot: Element | null = null;
    let rootVisible = true;
    let localEntry: IntersectionObserverEntry | undefined;
    let viewportEntry: IntersectionObserverEntry | undefined;
    let resizeObserver: ResizeObserver;
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
    const applyEntries = (entries: IntersectionObserverEntry[], fromViewport = false) => {
      const currentEntries = entries.filter(({ target }) => target === observedElement).sort((a, b) => a.time - b.time);
      if (!currentEntries.length) return;
      if (fromViewport) viewportEntry = currentEntries.at(-1);
      else localEntry = currentEntries.at(-1);
      const entry = localEntry;
      const visibleEntry = scrollRoot ? viewportEntry : localEntry;
      if (!entry || !visibleEntry) return;
      const rootWidth = scrollRoot?.clientWidth ?? window.innerWidth;
      const rootHeight = scrollRoot?.clientHeight ?? window.innerHeight;
      const tall = (entry.boundingClientRect?.height ?? 0) > rootHeight;
      const coversHalfRoot = tall && (visibleEntry.intersectionRect?.width ?? 0) * (visibleEntry.intersectionRect?.height ?? 0) >= rootWidth * rootHeight / 2;
      intersectionVisible = entry.isIntersecting && visibleEntry.isIntersecting && rootVisible && (visibleEntry.intersectionRatio >= SEEN_VISIBLE_RATIO || !!(tall && coversHalfRoot));
      intersectionVisibleRef.current = intersectionVisible;
      if (!intersectionVisible) {
        resetStretch();
        return;
      }

      const latestVisible = observedElement.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      if (!latestVisible) {
        clearTimer();
        visibleSince = undefined;
        needsFreshSample = false;
        schedule(250);
        return;
      }

      if (visibleSince === undefined) visibleSince = Math.max(entry.time, visibleEntry.time);
      notifyVisible();
      if (needsFreshSample) {
        needsFreshSample = false;
        const elapsed = performance.now() - (visibleSince ?? performance.now());
        if (elapsed >= SEEN_VISIBLE_SECONDS * 1000) emitSeen(performance.now());
        else schedule();
      } else if (performance.now() - visibleSince >= SEEN_VISIBLE_SECONDS * 1000) {
        requestFreshSample();
      } else {
        schedule();
      }
    };
    function onTimer() {
      timer = undefined;
      applyEntries(observer?.takeRecords() ?? []);
      if (scrollRoot) applyEntries(viewportObserver?.takeRecords() ?? [], true);
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

    const findScrollRoot = () => {
      for (let parent = observedElement.parentElement; parent; parent = parent.parentElement) {
        const { overflowY } = getComputedStyle(parent);
        if (/(auto|scroll|overlay)/.test(overflowY)) return parent;
      }
      return null;
    };
    const observe = () => {
      const nextScrollRoot = findScrollRoot();
      if (nextScrollRoot !== scrollRoot) {
        if (scrollRoot) resizeObserver?.unobserve(scrollRoot);
        scrollRoot = nextScrollRoot;
        rootObserver?.disconnect();
        viewportObserver?.disconnect();
        rootVisible = !scrollRoot;
        if (scrollRoot) rootVisible = false;
        localEntry = undefined;
        viewportEntry = undefined;
        resetStretch();
        rootVisibleRef.current = rootVisible;
        if (scrollRoot) {
          rootObserver = new IntersectionObserver((entries) => {
            const wasVisible = rootVisible;
            rootVisible = entries.at(-1)?.isIntersecting ?? false;
            rootVisibleRef.current = rootVisible;
            if (!rootVisible) {
              intersectionVisibleRef.current = false;
              resetStretch();
            } else if (!wasVisible) {
              observer.unobserve(observedElement);
              observer.observe(observedElement);
              viewportObserver?.unobserve(observedElement);
              viewportObserver?.observe(observedElement);
            }
          }, { threshold: 0 });
          rootObserver.observe(scrollRoot);
          resizeObserver?.observe(scrollRoot);
        }
      }
      observer?.disconnect();
      viewportObserver?.disconnect();
      const rect = observedElement.getBoundingClientRect();
      const rootBounds = scrollRoot?.getBoundingClientRect();
      const rootWidth = scrollRoot ? scrollRoot.clientWidth : window.innerWidth;
      const rootHeight = scrollRoot ? scrollRoot.clientHeight : window.innerHeight;
      const threshold = rect.height > rootHeight
        ? Math.min(1, rootWidth * rootHeight / (2 * rect.width * rect.height))
        : SEEN_VISIBLE_RATIO;
      observer = new IntersectionObserver((entries) => applyEntries(entries), { root: scrollRoot, threshold: [...new Set([0, threshold, SEEN_VISIBLE_RATIO])].sort((a, b) => a - b) });
      observer.observe(observedElement);
      if (scrollRoot) {
        const coverageThreshold = Math.min(1, rootWidth * rootHeight / (2 * rect.width * rect.height));
        viewportObserver = new IntersectionObserver((entries) => applyEntries(entries, true), { threshold: [...new Set([0, SEEN_VISIBLE_RATIO, coverageThreshold])].sort((a, b) => a - b) });
        viewportObserver.observe(observedElement);
      }
    };
    resizeObserver = new ResizeObserver(observe);
    resizeObserver.observe(observedElement);
    window.addEventListener("resize", observe);
    observe();
    return () => {
      clearTimer();
      observer.disconnect();
      viewportObserver?.disconnect();
      rootObserver?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, [element]);

  return ref;
}
