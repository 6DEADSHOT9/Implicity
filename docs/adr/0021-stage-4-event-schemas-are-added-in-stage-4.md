---
status: accepted
---

# Stage 4 event schemas are added in Stage 4

The widget events (`widget_seen`, `widget_used`, `widget_pinned`, `widget_dismissed`) and the media events (`media_played`, `media_paused`, `media_seeked`, `media_replayed`) stay listed in `docs/contracts.md`, but their schemas are written when Stage 4 builds Home behaviour and media playback, not in the Stage 1 contracts ticket. Nothing in Stage 1 emits them, and their vocabularies, widget ids and a media position bucket, have no source yet. Writing them now would fix a wire format before anyone needs it, and changing a published event later costs more than adding one. Until then the capture wrapper rejects them as unknown events.
