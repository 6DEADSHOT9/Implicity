---
status: accepted
---

# Engine rules are written down and tested by example

The engine's behaviour in edge cases is fixed by the Engine rules in `docs/contracts.md`, each with a worked example its tests mirror. Two build rounds of the engine kept failing review on the same questions the prose left open: how conversations and occasions are counted, what excluding a session undoes, which decision Undo may touch, and when pace is charged. Each round the builder guessed, and each guess was a defect. Writing the rules down with examples turns those guesses into failing tests before any code exists.

## Decisions that are hard to reverse

- **Every change takes one of four arbiter paths.** Rule proposals, Hermes and person proposals, the person's own controls, and exclusion reverts each run a fixed subset of the checks, so the person can always edit their own settings while nothing bypasses the arbiter (rule 1). The host validates values through `validate_state`, keeping the engine free of the registry.
- **Occasions come from one designated feature.** Summing the evidence features double-counted overlapping populations such as sessions, and the aggregate counts cannot tell overlap from disjoint. A dimension names its occasion feature instead.
- **Keep, Dismiss and session end carry the host's context.** Keep and Dismiss take the session context and return a verdict; the host calls `end_session`. Only the host knows boundaries and session ends.
- **Pace slots are reserved atomically.** Showing an offer reserves its session slot and admission reserves the day's slot, in the same write as the change; Keep confirms rather than re-checks.
- **The dimension's change policy wins** over a proposal's, and a mismatch is rejected.
- **Exclusion replays each decision with its stored inputs.** Decisions store every input needed to replay their gate, and only the active decision can revert.
- **Conversations are counted by id.** `DailyCount` carries the distinct `conversation_ids` with an occasion that day, so the gate's "3 conversations" means three different conversations. This changes the event source contract the PostHog implementation must meet.
- **Exclusion re-judges; it does not re-ask.** Excluding a session re-runs the gate for each automatic decision against its own from, to and date, and reverts only what is no longer justified. It never touches explicit settings or kept proposals. Asking "what should change now" instead reverted valid decisions after unrelated exclusions.
- **Only the active decision can be undone.** Undoing a superseded decision has no clear meaning and corrupted the current state.
- **Dismiss needs fresh evidence; Undo is permanent.** "Not now" is not "never", but a dismissed gated offer may not return on the evidence it was dismissed on, and a gate-free one only with a changed payload or after 7 days. Undo stays permanent (ADR 0017).
- **Every offer is a proposal until the arbiter admits it.** Hermes and person proposals always need Keep; Keep is bound to the session the offer was shown in; an unanswered offer expires with its session.
- **Transitions are atomic.** A value, its decision, the pace record and the freshness cutoff are written together or not at all, so a failed write cannot leave a changed value with no decision.
- **Dimension and feature files are YAML**, as the docs always showed.

## Also decided

- **The engine is split** into T20a (evidence and beliefs) and T20b (arbiter and state), each sized for one session, built test-first from the worked examples.
- **Judging and self-reverting a fought change is Stage 2.** It needs per-dimension signals of the person working against a change, which do not exist until the real adaptations. Until then the engine reverts only through session exclusion.

## Considered options

- **Keep patching the single T20.** Rejected: fixes kept introducing new defects because the rules they implemented were never written down.
- **A cooldown for Undo, like Dismiss.** Rejected by ADR 0017 and kept.
