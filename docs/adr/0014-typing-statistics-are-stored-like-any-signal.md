# Typing statistics are stored like any other signal

Per-session typing statistics go to PostHog with every other behaviour summary. They identify a person fairly well, so keeping them only in SQLite was considered; it was rejected for now to avoid one signal being a special case in capture and features. Raw keystrokes and key identities still never leave the page. This must be reconsidered before PostHog moves off the owner's machine.
