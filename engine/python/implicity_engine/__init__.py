"""Generic, deterministic adaptation engine."""

from .engine import DailyCount, Engine, FakeEventSource, Verdict, load_dimensions

__all__ = ["DailyCount", "Engine", "FakeEventSource", "Verdict", "load_dimensions"]
