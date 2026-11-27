import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, type CapturedEvent } from "../../src/registry";
import { WidgetPicker } from "../../src/registry/WidgetPicker/WidgetPicker";
import "../../src/tokens.css";

declare global {
  interface Window { widgetPickerEvents: CapturedEvent[] }
}

window.widgetPickerEvents = [];
const props = {
  open: true,
  title: "Choose Home widgets",
  widgets: [{ widgetId: "home_resume", componentId: "ResumeWidget", label: "Resume", enabled: true }],
  availableWidgets: [],
};
const scenario = new URLSearchParams(location.search).get("scenario");
const updateWidget = (setWidgets: (update: (widgets: typeof props.widgets) => typeof props.widgets) => void, enabled: boolean) => {
  setWidgets((widgets) => widgets.map((widget) => ({ ...widget, enabled })));
};

function AcceptanceHarness() {
  const [widgets, setWidgets] = useState(props.widgets);
  const [revision, setRevision] = useState(0);
  const calls = useRef(0);
  const answers = useRef<Array<(accepted: boolean) => void>>([]);
  const onWidgetChange = (_id: string, enabled: boolean): boolean | Promise<boolean> => {
    if (scenario === "delayed") {
      window.setTimeout(() => updateWidget(setWidgets, enabled), 50);
      return true;
    }
    if (scenario === "promise") {
      return Promise.resolve().then(() => {
        updateWidget(setWidgets, enabled);
        return true;
      });
    }
    if (scenario === "pending-rerender") {
      setWidgets((current) => [...current]);
      setRevision((value) => value + 1);
      return new Promise((resolve) => window.setTimeout(() => {
        updateWidget(setWidgets, enabled);
        resolve(true);
      }, 50));
    }
    if (scenario === "quick") {
      window.setTimeout(() => updateWidget(setWidgets, enabled), 10);
      return new Promise((resolve) => window.setTimeout(() => resolve(true), 60));
    }
    if (scenario === "false") return Promise.resolve(false);
    if (scenario === "rejected") return Promise.reject(new Error("save failed"));
    if (["double", "late", "hung", "throwing"].includes(scenario ?? "")) {
      calls.current += 1;
      if (scenario === "hung" && calls.current === 1) return new Promise(() => {});
      if (scenario === "throwing" && calls.current === 1) throw new Error("save failed");
      return new Promise((resolve) => answers.current.push(resolve));
    }
    return false;
  };
  return <CaptureProvider sink={(event) => window.widgetPickerEvents.push(event)}>
    <p data-revision>{revision}</p>
    <WidgetPicker {...props} widgets={widgets} onOpenChange={() => undefined} onWidgetChange={onWidgetChange} />
    <button data-action="show-off" onClick={() => updateWidget(setWidgets, false)}>Show off</button>
    <button data-action="app-on" onClick={() => updateWidget(setWidgets, true)}>App on</button>
    <button data-action="new-list" onClick={() => setWidgets((current) => [...current])}>New list</button>
    <button data-action="complete-first" onClick={() => answers.current.shift()?.(true)}>Complete first</button>
    <button data-action="complete-later" onClick={() => answers.current.shift()?.(true)}>Complete later</button>
    <button data-action="complete-saves" onClick={() => answers.current.splice(0).forEach((resolve) => resolve(true))}>Complete saves</button>
  </CaptureProvider>;
}

createRoot(document.getElementById("root")!).render(<AcceptanceHarness />);
