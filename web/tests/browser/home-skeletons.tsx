import { useState } from "react";
import { createRoot } from "react-dom/client";
import look from "../../../contracts/looks/default.json" with { type: "json" };
import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };
import { HomeGrid } from "../../src/registry/HomeGrid/HomeGrid";
import { NowPlayingWidget } from "../../src/registry/NowPlayingWidget/NowPlayingWidget";
import { ProjectsWidget } from "../../src/registry/ProjectsWidget/ProjectsWidget";
import { QuickPromptsWidget } from "../../src/registry/QuickPromptsWidget/QuickPromptsWidget";
import { ResumeWidget } from "../../src/registry/ResumeWidget/ResumeWidget";
import { ScheduledWidget } from "../../src/registry/ScheduledWidget/ScheduledWidget";
import { WidgetFrame } from "../../src/registry/WidgetFrame/WidgetFrame";
import { WidgetPicker } from "../../src/registry/WidgetPicker/WidgetPicker";
import "../../src/tokens.css";

const textSize = tokens.derivedTokens.textSize[String(look.text_size) as keyof typeof tokens.derivedTokens.textSize];
const tokenValues = {
  ...look.light,
  ...Object.fromEntries(Object.entries(tokens.sharedPalette.light).map(([name, value]) => [`--${name}`, value])),
  ...tokens.derivedTokens.radius[look.radius as keyof typeof tokens.derivedTokens.radius],
  ...tokens.derivedTokens.density[look.density as keyof typeof tokens.derivedTokens.density],
  "--text-scale": textSize["--text-scale"],
  ...textSize.sizes,
  ...textSize.headings,
  ...tokens.derivedTokens.dimensions,
  ...tokens.derivedTokens.motionDurations,
  ...tokens.derivedTokens.motionEasing,
  ...tokens.derivedTokens.motionAnimations,
  ...tokens.derivedTokens.fontWeights,
  ...tokens.derivedTokens.lineHeights,
  "--font-body": JSON.stringify(tokens.typefaces[look.typeface.body as keyof typeof tokens.typefaces].family),
  "--font-heading": JSON.stringify(tokens.typefaces[look.typeface.heading as keyof typeof tokens.typefaces].family),
  "--font-serif": JSON.stringify(tokens.typefaces.serif.family),
  "--font-informal": JSON.stringify(tokens.typefaces.informal.family),
  "--font-mono": JSON.stringify(tokens.typefaces.mono.family),
};
for (const [name, value] of Object.entries(tokenValues)) document.documentElement.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
document.documentElement.dataset.look = look.id;
document.documentElement.dataset.mode = "light";
document.documentElement.dataset.density = look.density;
document.documentElement.dataset.textSize = String(look.text_size);

const longTitle = "T".repeat(150);
const longText = "a".repeat(150);
const longUrl = "https://example.invalid/a/very-long-widget-content-that-must-wrap-inside-the-home-grid-without-widening-the-page";
const paragraph = "Useful recommendations and ordinary sentences wrap naturally without splitting words in the middle.";
const content = [<p key="paragraph">{paragraph}</p>, <span key="hash">{longText}</span>, <span key="url">{longUrl}</span>];

function HomeSkeletonHarness() {
  const [open, setOpen] = useState(false);
  const pickerWidgets = Array.from({ length: 60 }, (_, index) => ({
    id: ["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"][index % 5],
    label: `Widget ${index + 1}`,
    enabled: true,
  }));
  return <main>
    <HomeGrid title={longTitle} slots={{ widgets: [<span key="hash">{longText}</span>, <span key="url">{longUrl}</span>] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="Workspace" slots={{ content }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="resume_source" slots={{ content: [<ResumeWidget key="resume" slots={{ content }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="projects_source" slots={{ content: [<ProjectsWidget key="projects" slots={{ content }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="scheduled_source" slots={{ content: [<ScheduledWidget key="scheduled" slots={{ content }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="quick_prompts_source" slots={{ content: [<QuickPromptsWidget key="prompts" slots={{ content }} />] }} />
    <WidgetFrame title={longTitle} lastUpdate="Updated today" source="now_playing_source" slots={{ content: [<NowPlayingWidget key="now-playing" progress={35} slots={{ content }} />] }} />
    <WidgetPicker open={open} title="Choose Home widgets" widgets={pickerWidgets} availableWidgets={[{ id: "DataTable", label: "Data table" }]} onOpenChange={setOpen} onWidgetChange={() => undefined} onAdd={() => undefined} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<HomeSkeletonHarness />);
