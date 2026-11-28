import { useCallback, useEffect, useState } from "react";
import { ChangeNotice } from "@implicity/engine-react";

type Decision = { id: string; dimension: string; from_: string; to: string; reason: string };
type State = { kind: string; values: Record<string, string | null> };

export function App() {
  const [state, setState] = useState<State>();
  const [notice, setNotice] = useState<Decision>();
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextState, notices] = await Promise.all([
        request<State>("/state?kind=coding"),
        request<Decision[]>("/notices"),
      ]);
      setState(nextState);
      setNotice(notices[0]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the demo host.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function adapt() {
    try {
      await request("/demo/session", { method: "POST" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run the engine.");
    }
  }

  async function answer(action: "keep" | "undo") {
    if (!notice) return;
    try {
      await request(`/decisions/${notice.id}/${action}`, { method: "POST" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your choice.");
    }
  }

  return (
    <main style={{ color: "var(--foreground)", fontFamily: "var(--font-body)", margin: "var(--space-6) auto", maxWidth: "var(--content-max-width)", padding: "var(--space-4)" }}>
      <h1>Adaptive engine</h1>
      <p>One dimension, canned counts, and the real Python engine.</p>
      <p>Long answers: <strong>{state?.values.long_answers ?? "Loading…"}</strong> for coding chats</p>
      <button type="button" onClick={() => void adapt()} style={{ minHeight: "var(--target-min-size)" }}>Run next session</button>
      {error && <p role="alert">{error}</p>}
      {notice && <ChangeNotice
        decision_id={notice.id}
        title={`Long answers changed to ${notice.to}`}
        reason={notice.reason}
        onShown={() => request(`/notices/${notice.id}/shown`, { method: "POST" }).then(() => undefined)}
        onKeep={() => { void answer("keep"); }}
        onUndo={() => { void answer("undo"); }}
      />}
    </main>
  );
}

async function request<T = void>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`Demo host returned ${response.status}.`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
