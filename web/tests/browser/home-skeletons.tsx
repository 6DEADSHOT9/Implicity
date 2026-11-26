import { useState } from "react";
import { createRoot } from "react-dom/client";
import { HomeGrid } from "../../src/registry/HomeGrid/HomeGrid";
import { NowPlayingWidget } from "../../src/registry/NowPlayingWidget/NowPlayingWidget";
import { ProjectsWidget } from "../../src/registry/ProjectsWidget/ProjectsWidget";
import { QuickPromptsWidget } from "../../src/registry/QuickPromptsWidget/QuickPromptsWidget";
import { ResumeWidget } from "../../src/registry/ResumeWidget/ResumeWidget";
import { ScheduledWidget } from "../../src/registry/ScheduledWidget/ScheduledWidget";
import { WidgetFrame } from "../../src/registry/WidgetFrame/WidgetFrame";
import { WidgetPicker } from "../../src/registry/WidgetPicker/WidgetPicker";
import "../../src/tokens.css";

const longTitle = "https://example.invalid/a/very-long-home-widget-title-that-wraps-without-breaking-ordinary-words-or-overflowing-the-screen";
const longUrl = "https://example.invalid/a/very-long-widget-content-that-must-wrap-inside-the-home-grid-without-widening-the-page";
const paragraph = "Useful recommendations and ordinary sentences wrap naturally without splitting words in the middle.";

function HomeSkeletonHarness() {
  const [open, setOpen] = useState(false);
  return <main>
    <HomeGrid title="Your Home" slots={{ widgets: [<span key="url">{longUrl}</span>] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="Workspace" slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="resume_source" slots={{ content: [<ResumeWidget slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="projects_source" slots={{ content: [<ProjectsWidget slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="scheduled_source" slots={{ content: [<ScheduledWidget slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="quick_prompts_source" slots={{ content: [<QuickPromptsWidget slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="now_playing_source" slots={{ content: [<NowPlayingWidget progress={35} slots={{ content: [<p key="paragraph">{paragraph}</p>, <span key="url">{longUrl}</span>] }} />] }} />
    <WidgetPicker open={open} title="Choose Home widgets" enabled onOpenChange={setOpen} onEnabledChange={() => undefined} onAddWidget={() => undefined} slots={{ widgets: Array.from({ length: 60 }, (_, index) => <div key={index}>Widget {index + 1}</div>) }} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<HomeSkeletonHarness />);
