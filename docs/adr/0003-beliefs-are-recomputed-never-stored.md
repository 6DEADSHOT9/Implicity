# Beliefs are recomputed, never stored

The engine does not keep running counters. At each evaluation it recomputes every belief from a rolling 60-day window of counts with a 14-day half-life, and stores only decisions with the evidence snapshot behind them. Excluding a guest's session or deleting data must change what was learned after the fact, and recomputing makes that work with no special handling. The cost is a set of queries at every evaluation, which is acceptable because the engine only evaluates at session boundaries.
