# PostHog is the event store

Behaviour events are stored only in a self-hosted PostHog on the same machine, and Implicity keeps no copy of raw events. PostHog already captures and stores exactly this kind of data, so a second event log beside it was duplicated work. The cost is that learning pauses while PostHog is down (chat and the interface keep working) and that the stack needs about 16 GB of RAM.

## Considered Options

- A local event log in our own database with PostHog as an optional copy: rejected as two stores doing one job.
- PostHog Cloud: rejected for now because behaviour data would leave the machine.
