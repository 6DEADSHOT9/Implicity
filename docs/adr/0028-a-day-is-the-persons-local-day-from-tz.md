---
status: accepted
---

# A day is the person's local day, from `TZ`

Every count the engine reads is bucketed by the person's local day. Setup fills `TZ` in `.env` with the machine's IANA time zone, without overwriting a value already there. Compose passes it to the app container, and the host builds both its clock and the PostHog event source from that zone. The PostHog queries group events with `toDate(timestamp, '<zone>')` rather than PostHog's own project time zone.

## Considered options

- **UTC days.** Nothing to configure, but an evening's activity lands on the next day for anyone east or west of Greenwich, so the gate's daily counts and the 14-day half-life describe the wrong days. The engine's rules already say "day" means the person's local day.
- **The browser reports its zone each session.** Follows the person when they travel, but needs a new field in the event contract and a rule for sessions that disagree. Stage 1 runs on one machine for one person.
- **PostHog's project time zone.** It would need setup to write PostHog settings, and the engine's day would then depend on a setting outside this repository.

## Consequences

- Containers default to UTC, so the app must not rely on the container's local time; it reads `TZ`.
- Changing `TZ` later moves day boundaries for all past events as well, because days are computed at read time. Nothing stored needs migrating.
- Travel between zones is not handled in Stage 1.
