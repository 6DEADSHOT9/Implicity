# All model calls go through Hermes

Implicity's code never calls a model directly and has no provider interface of its own. Hermes already abstracts the provider, so swapping away from the Codex subscription is a Hermes setting. An earlier design had our own provider interface with Codex as one implementation; it was dropped as a second layer doing the same job.
