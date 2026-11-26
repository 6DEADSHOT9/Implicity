from implicity_api.modules.event_source import posthog

EVENT_STORE_SECRET_BYTES = posthog.EVENT_STORE_SECRET_BYTES
configure_event_store = posthog.configure_event_store

__all__ = ["EVENT_STORE_SECRET_BYTES", "configure_event_store"]
