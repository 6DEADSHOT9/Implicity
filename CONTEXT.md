# Implicity

A locally hosted conversational platform that adapts its interface, its answers and its actions to one person, by learning from what they do as well as what they say.

## Language

### Behaviour

**Signal**:
A kind of behaviour the browser observes, such as typing rhythm or reading progress.
_Avoid_: Metric, tracking

**Event**:
One record of behaviour sent to the event store: an action, a turn summary or a session summary.
_Avoid_: Log, hit

**Session**:
One continuous period of use, ending on close or idle.
_Avoid_: Visit

**Turn**:
One message from the person and the answer to it.
_Avoid_: Exchange, round

**Kind**:
The kind of chat a conversation is: one of five predefined kinds or a custom one the person accepted.
_Avoid_: Category, mode, topic, task type

**Feature**:
A named pair of daily counts per kind: how often something happened, and how often it could have.
_Avoid_: Metric, stat

**Occasion**:
One moment where a choice was really available to the person and seen on screen.
_Avoid_: Opportunity, impression, episode

**Event source**:
The interface the engine reads feature counts through.
_Avoid_: Analytics client, PostHog client

### Adaptation

**Dimension**:
One thing the engine can adapt, with a fixed set of values.
_Avoid_: Setting, preference, parameter

**Belief**:
What the engine currently thinks a dimension's value should be for a kind, derived from features.
_Avoid_: Preference, score, model

**Gate**:
The evidence a belief needs before a change may be made.
_Avoid_: Threshold

**Proposal**:
A suggested change from a rule, from Hermes or from the person, which changes nothing by itself.
_Avoid_: Suggestion, recommendation, candidate

**Arbiter**:
The single function that admits, defers or rejects a proposal.
_Avoid_: Policy engine, approver

**Decision**:
An admitted proposal: the change, its reason, its evidence and its inverse.
_Avoid_: Change record, adaptation

**State**:
The current value of every dimension: layout, look, answer style, Home and workflows.
_Avoid_: Config, profile

**Explicit**:
Set by the person, and never overridden by inference until they return it to automatic.
_Avoid_: Manual, override, pinned

**Lock**:
A switch that stops changes to one area: look, layout, answer style or Home.
_Avoid_: Pin, freeze (freeze is the master switch over all areas)

### Interface

**Registry**:
The set of reviewed components the interface may use.
_Avoid_: Component library, catalogue (the catalogue is the tool that lists the registry)

**Skeleton**:
A registry component: structure, behaviour, schema and events, styled with tokens only.
_Avoid_: Template, base component

**Layout spec**:
The persistent description of the workspace, changed only through the arbiter.
_Avoid_: Layout config, UI state

**Message spec**:
A description of components inside one answer, produced by the Render tool.
_Avoid_: Generated UI, widget (a widget lives on Home)

**Look**:
A named set of token values with a light and a dark variant.
_Avoid_: Theme, skin

**Token**:
A named design value that components read, such as a colour, radius or density.
_Avoid_: Variable, style
