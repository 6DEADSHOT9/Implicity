---
status: accepted
---

# Engine rules are written down and tested by example

The engine's behaviour in edge cases is fixed by the Engine rules in `docs/contracts.md`, each with a worked example its tests mirror. Two build rounds of the engine kept failing review on the same questions the prose left open: how conversations and occasions are counted, what excluding a session undoes, which decision Undo may touch, and when pace is charged. Each round the builder guessed, and each guess was a defect. Writing the rules down with examples turns those guesses into failing tests before any code exists.

## Decisions that are hard to reverse

- **The rules are scoped to Stage 1.** Specifying the whole engine for every stage at once kept producing new gaps each review round, all in features no Stage 1 ticket builds. The Stage 1 rules cover the gate, value lookup, automatic decisions with ChangeNotices, Keep, Undo, the person's controls, locks, freeze, pace and scale freshness. Session exclusion, offers on ProposalCards, custom kinds, layout validation, preferences said in chat and judging fought changes are recorded as later-stage design, each with its open questions, and finished by the ticket that builds the feature.
- **Every change goes through the arbiter on a fixed path.** In Stage 1: automatic rule decisions run all five checks; the person's own controls run only validity and lock checks, so the person can always edit their settings while nothing bypasses the arbiter (rule 1).
- **Occasions come from one designated feature.** Summing evidence features double-counts overlapping populations, which aggregate counts cannot detect.
- **Conversations are counted by id.** `DailyCount` carries the distinct `conversation_ids` with an occasion that day, so "3 conversations" means three different conversations. This changes the event source contract the PostHog implementation must meet.
- **Only the active decision can be undone.** Undoing a superseded decision has no clear meaning and corrupted the current state. Undo stays permanent (ADR 0017).
- **Transitions are atomic and conditional.** A value, its decision, the pace reservation and the freshness cutoff are written together or not at all, and the write fails if the slot or value changed since it was read, so no partial change and no double-booked slot.
- **Dimension and feature files are YAML**, as the docs always showed.

## Also decided

- **The engine is split** into T20a (evidence and beliefs) and T20b (arbiter and state), each sized for one session, built test-first from the worked examples.
- **Judging and self-reverting a fought change is Stage 2.** Until then the Stage 1 engine never reverts on its own.

## Considered options

- **Keep patching the single T20.** Rejected: fixes kept introducing new defects because the rules they implemented were never written down.
- **A cooldown for Undo, like Dismiss.** Rejected by ADR 0017 and kept.
