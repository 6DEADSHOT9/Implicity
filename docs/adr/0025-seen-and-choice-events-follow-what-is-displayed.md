---
status: accepted
---

# Seen and choice events follow what is displayed

Two meanings are fixed, because every recorded event carries them and old data cannot be re-measured.

- **Seen.** One shared helper, `useSeen()`, decides it for every skeleton. A component is on screen while at least half of it is visible (an IntersectionObserver) and the browser's `checkVisibility({ opacityProperty: true, visibilityProperty: true })` is true. `component_seen` is sent once per mount after 3 seconds on screen, with the seconds it was actually visible; leaving the screen first resets the timer. Skeletons never measure seen time themselves.
- **A choice.** A choice event, such as switching a representation, a dock state or a widget's switch, is recorded when the displayed value actually changes, not when a control is clicked. A click that a controlled parent refuses records nothing.

## Considered options

- **Seen on first render.** Simple, but it counts components scrolled past or hidden behind others, so occasions would be inflated.
- **Exact visibility**: watching the DOM for changes and computing clipping and overlap. More precise, but costly on every page, and fragile across browsers. We accepted two limits instead: a component hidden and shown again within the same 3 seconds may still count, and `clip-path` is ignored.
- **Choices on click.** Easier to wire, but it records choices that never took effect when a parent refuses the change, so the engine would learn from things the person never saw.

## Consequences

- Occasions and choices mean the same thing for every component, so the engine's features compare across components and over time.
- The half-visible ratio and the 3 seconds are named constants the capture wrapper may tune. Changing them, or changing either meaning, makes data before and after the change incomparable, so a change needs its own decision.
