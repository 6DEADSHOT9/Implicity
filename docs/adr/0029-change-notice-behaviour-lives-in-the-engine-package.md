---
status: accepted
---

# ChangeNotice behaviour lives in the engine package

The engine's React package exports a headless `useChangeNotice` hook. It holds the behaviour that belongs to the engine: `shown` is reported when the notice is visible, Keep waits for that acknowledgement, Undo is available while the decision is in effect, and errors are surfaced. The package's own ChangeNotice component is built on that hook. The app's ChangeNotice skeleton will use the same hook and keep its own presentation (a Marker inside a conversation, a Toast outside one) and its capture events.

## Considered options

- **Two separate components.** The package's component would be the engine's reference, and the app would keep its own copy. That is simple today, but the first version of the package had already drifted from the skeleton: it reported `shown` on mount, gated Undo differently, had one presentation against two, and used different events.
- **The package imports the app's skeleton.** Rule 3 forbids the engine from importing the app.

## Consequences

- The dependency runs from the app to the engine package, which rule 3 allows. The package stays liftable.
- Engine behaviour is tested once, in the package. The app tests only its presentation and its capture events.
- The app skeleton moving onto the hook is follow-up work after Stage 1. Until then the two components can differ in presentation, and the package's hook is the reference for behaviour.
