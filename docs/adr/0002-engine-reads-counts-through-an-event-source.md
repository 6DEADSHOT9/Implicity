# The engine reads counts through an event source interface

The adaptive engine never talks to PostHog directly. It asks one interface for daily counts and session summaries, and PostHog is one implementation of it. This keeps the engine liftable into projects that store events elsewhere, and lets every engine test run on canned numbers with no PostHog. If PostHog Endpoints is missing from the self-hosted build, a second implementation uses the query API behind the same interface; that fallback must be revisited before scaling.
