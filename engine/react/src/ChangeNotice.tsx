import { useEffect, useId, useState, type CSSProperties } from "react";

export type ChangeNoticeProps = {
  decision_id: string;
  title: string;
  reason: string;
  onShown?: () => void | Promise<void>;
  onKeep: () => void;
  onUndo: () => void;
};

export function ChangeNotice({
  decision_id,
  title,
  reason,
  onShown,
  onKeep,
  onUndo,
}: ChangeNoticeProps) {
  const titleId = useId();
  const [shown, setShown] = useState(false);
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    let current = true;
    setShown(false);
    setShowError(false);
    Promise.resolve(onShown?.()).then(
      () => { if (current) setShown(true); },
      () => { if (current) setShowError(true); },
    );
    return () => { current = false; };
  }, [decision_id]);

  return (
    <section
      aria-labelledby={titleId}
      role="status"
      style={{
        background: "var(--card)",
        border: "var(--border-width) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        color: "var(--card-foreground)",
        padding: "var(--space-4)",
      }}
    >
      <h2 id={titleId} style={{ fontSize: "var(--heading-4)" }}>{title}</h2>
      <p>{reason}</p>
      {showError && <p role="alert">Could not confirm this notice was shown. Keep is unavailable.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <button type="button" disabled={!shown} onClick={onKeep} style={buttonStyle(true)}>Keep</button>
        <button type="button" onClick={onUndo} style={buttonStyle(false)}>Undo</button>
      </div>
    </section>
  );
}

function buttonStyle(primary: boolean): CSSProperties {
  return {
    background: primary ? "var(--primary)" : "var(--background)",
    border: "var(--border-width) solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: primary ? "var(--primary-foreground)" : "var(--foreground)",
    cursor: "pointer",
    minHeight: "var(--target-min-size)",
    paddingInline: "var(--space-4)",
  };
}
