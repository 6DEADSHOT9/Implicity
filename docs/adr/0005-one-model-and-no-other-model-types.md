# One model, and no other model types

Implicity uses a single LLM and no embedding, classifier or reranking models. Each extra model type is another thing to host, configure and keep working on a local machine. The consequences are deliberate: memory recall is full-text search, kinds of chat are labelled by the main model during its normal turn, and momentary states and guest detection are plain statistics against the owner's baseline.

## Considered Options

- pgvector with a small local embedding model for semantic recall: rejected until keyword recall proves insufficient.
