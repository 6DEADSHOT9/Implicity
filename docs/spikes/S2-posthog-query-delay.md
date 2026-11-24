# S2: How quickly do events become queryable in self-hosted PostHog?

**Type:** spike. **Time box:** half a day. **Blocks:** T1 and everything after it.

## Question

After the browser sends an event, how long until that event appears in a query
on a self-hosted PostHog running on the same machine?

## Why it matters

The engine evaluates when a session ends or goes idle. If events take longer than
that to become queryable, the evaluation would miss the session's last events and
needs a delay.

## Do

1. Start PostHog's self-hosted Docker Compose stack locally. Record RAM used at idle.
2. Create a project and a personal API key.
3. From a script, send batches of custom events with a unique marker and a client
   timestamp: 1 event, 100 events, 1,000 events.
4. Poll a query for the marker every second and record when each batch is fully visible.
5. Repeat each batch size five times.
6. Send one `session_summary`-sized event with about 30 numeric properties and
   confirm all properties are queryable.

## Pass

A measured delay we can design around. There is no failing result, only a number.

## Deliver

`docs/spikes/findings/S2.md` with: median and worst delay per batch size, idle and
peak RAM for the stack, PostHog version, and a recommended evaluation delay.

## If the delay is long

Recommend the delay to add before the engine evaluates at session end. The catch-up
evaluation at the next session start already covers anything missed.

## Out of bounds

No capture wrapper, no event schemas. Use placeholder event names.
