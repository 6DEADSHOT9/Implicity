import { Toaster } from "./ui/sonner";

export function ChangeNoticeToastHost() {
  const mode = document.querySelector<HTMLElement>("[data-gallery-root]")?.dataset.mode ?? document.documentElement.dataset.mode;
  return <Toaster id="change-notices" position="top-right" duration={Infinity} expand theme={mode === "dark" ? "dark" : "light"} style={{ fontFamily: "var(--font-body)", "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", "--normal-border": "var(--border)", "--border-radius": "var(--radius)", "--width": "var(--panel-width)" } as React.CSSProperties} />;
}
