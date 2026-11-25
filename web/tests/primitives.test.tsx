// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "../src/components/ui/alert";
import { AspectRatio } from "../src/components/ui/aspect-ratio";
import { Avatar, AvatarFallback } from "../src/components/ui/avatar";
import { Badge } from "../src/components/ui/badge";
import { Bubble, BubbleContent } from "../src/components/ui/bubble";
import { Button } from "../src/components/ui/button";
import { ButtonGroup } from "../src/components/ui/button-group";
import { Card, CardContent, CardTitle } from "../src/components/ui/card";
import { Checkbox } from "../src/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../src/components/ui/collapsible";
import { Command, CommandInput } from "../src/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../src/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/components/ui/dropdown-menu";
import { Empty, EmptyTitle } from "../src/components/ui/empty";
import { Field, FieldLabel } from "../src/components/ui/field";
import { Input } from "../src/components/ui/input";
import { Item, ItemTitle } from "../src/components/ui/item";
import { Kbd } from "../src/components/ui/kbd";
import { Pagination } from "../src/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/ui/popover";
import { Progress } from "../src/components/ui/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../src/components/ui/resizable";
import { ScrollArea } from "../src/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";
import { SidebarMenuButton, SidebarProvider } from "../src/components/ui/sidebar";
import { Slider } from "../src/components/ui/slider";
import { Switch } from "../src/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "../src/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip";
import { Attachment, AttachmentInfo, AttachmentRemove, Attachments } from "../src/components/ai-elements/attachments";
import { ConfirmationAction } from "../src/components/ai-elements/confirmation";
import { InlineCitation, InlineCitationText } from "../src/components/ai-elements/inline-citation";
import { Message, MessageContent } from "../src/components/ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "../src/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../src/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "../src/components/ai-elements/sources";
import { StackTrace, StackTraceContent, StackTraceHeader } from "../src/components/ai-elements/stack-trace";
import { Suggestion } from "../src/components/ai-elements/suggestion";
import { Task, TaskContent, TaskTrigger } from "../src/components/ai-elements/task";
import { Terminal, TerminalContent, TerminalCopyButton } from "../src/components/ai-elements/terminal";
import { Tool, ToolContent, ToolHeader } from "../src/components/ai-elements/tool";

describe("shadcn primitives", () => {
  it("Alert exposes the alert role and its heading", () => {
    render(<Alert><AlertTitle>Saved</AlertTitle><AlertDescription>Changes saved</AlertDescription></Alert>);
    expect(screen.getByRole("alert").textContent).toContain("Saved");
  });
  it("AspectRatio renders its content", () => {
    render(<AspectRatio ratio={16 / 9}><span>Preview</span></AspectRatio>);
    expect(screen.getByText("Preview")).toBeTruthy();
  });
  it("Avatar announces its fallback as an image", () => {
    render(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
    expect(screen.getByText("AB")).toBeTruthy();
  });
  it("Badge and Kbd retain their labels", () => {
    render(<><Badge>Ready</Badge><Kbd>⌘K</Kbd></>);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("⌘K")).toBeTruthy();
  });
  it("Bubble and Card preserve their content semantics", () => {
    render(<><Bubble><BubbleContent>Answer</BubbleContent></Bubble><Card><CardTitle>Title</CardTitle><CardContent>Details</CardContent></Card></>);
    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
  });
  it("ButtonGroup exposes a group and Button receives keyboard focus", async () => {
    const user = userEvent.setup();
    render(<ButtonGroup aria-label="Actions"><Button>Save</Button></ButtonGroup>);
    const button = screen.getByRole("button", { name: "Save" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole("group", { name: "Actions" })).toBeTruthy();
  });
  it("Checkbox and Switch expose labeled control roles", () => {
    render(<><Checkbox aria-label="Remember"/><Switch aria-label="Notifications"/></>);
    expect(screen.getByRole("checkbox", { name: "Remember" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeTruthy();
  });
  it("Collapsible toggles from its keyboard-accessible trigger", async () => {
    const user = userEvent.setup();
    render(<Collapsible><CollapsibleTrigger>Show details</CollapsibleTrigger><CollapsibleContent>Details</CollapsibleContent></Collapsible>);
    const trigger = screen.getByRole("button", { name: "Show details" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Details")).toBeTruthy();
  });
  it("Command provides a labeled search input", () => {
    render(<Command label="Search commands"><CommandInput /></Command>);
    expect(screen.getByRole("combobox", { name: "Search commands" })).toBeTruthy();
  });
  it("Dialog closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<Dialog><DialogTrigger>Open dialog</DialogTrigger><DialogContent><DialogTitle>Dialog title</DialogTitle></DialogContent></Dialog>);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Dialog title" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("DropdownMenu closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DropdownMenu><DropdownMenuTrigger>Actions</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Rename</DropdownMenuItem></DropdownMenuContent></DropdownMenu>);
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
  });
  it("Empty and Item expose their titles", () => {
    render(<><Empty><EmptyTitle>No results</EmptyTitle></Empty><Item><ItemTitle>Project</ItemTitle></Item></>);
    expect(screen.getByText("No results")).toBeTruthy();
    expect(screen.getByText("Project")).toBeTruthy();
  });
  it("Field label is associated with its input", () => {
    render(<Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" /></Field>);
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
  it("Pagination has a named navigation landmark", () => {
    render(<Pagination />);
    expect(screen.getByRole("navigation", { name: "pagination" })).toBeTruthy();
  });
  it("Popover closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Popover><PopoverTrigger>More</PopoverTrigger><PopoverContent>More options</PopoverContent></Popover>);
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("More options")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("More options")).toBeNull();
  });
  it("Progress announces its value and label", () => {
    render(<Progress aria-label="Upload progress" value={45} max={100} />);
    const progress = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(progress.getAttribute("value")).toBe("45");
  });
  it("Resizable exposes a keyboard-operable separator", async () => {
    const user = userEvent.setup();
    render(<ResizablePanelGroup orientation="horizontal"><ResizablePanel defaultSize={50}>Left</ResizablePanel><ResizableHandle /><ResizablePanel defaultSize={50}>Right</ResizablePanel></ResizablePanelGroup>);
    const separator = screen.getByRole("separator");
    separator.focus();
    expect(document.activeElement).toBe(separator);
  });
  it("ScrollArea retains its content", () => {
    render(<ScrollArea><span>Scrollable content</span></ScrollArea>);
    expect(screen.getByText("Scrollable content")).toBeTruthy();
  });
  it("Select exposes a labeled combobox and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Select><SelectTrigger aria-label="Color"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent><SelectItem value="blue">Blue</SelectItem></SelectContent></Select>);
    const trigger = screen.getByRole("combobox", { name: "Color" });
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Blue" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option", { name: "Blue" })).toBeNull();
  });
  it("Sheet closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Sheet><SheetTrigger>Open panel</SheetTrigger><SheetContent><SheetTitle>Panel title</SheetTitle></SheetContent></Sheet>);
    await user.click(screen.getByRole("button", { name: "Open panel" }));
    expect(screen.getByRole("dialog", { name: "Panel title" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("Sidebar menu control is labeled and focusable", async () => {
    const user = userEvent.setup();
    render(<SidebarProvider><SidebarMenuButton>Inbox</SidebarMenuButton></SidebarProvider>);
    const button = screen.getByRole("button", { name: "Inbox" });
    await user.tab();
    expect(document.activeElement).toBe(button);
  });
  it("Slider exposes a labeled slider role", () => {
    render(<Slider aria-label="Volume" defaultValue={[40]} />);
    expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
  });
  it("Table exposes row and cell roles", () => {
    render(<Table><TableBody><TableRow><TableCell>Cell value</TableCell></TableRow></TableBody></Table>);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Cell value" })).toBeTruthy();
  });
  it("Tabs move between tabs with arrow keys", async () => {
    const user = userEvent.setup();
    render(<Tabs defaultValue="one"><TabsList aria-label="Views"><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList><TabsContent value="one">First view</TabsContent><TabsContent value="two">Second view</TabsContent></Tabs>);
    const first = screen.getByRole("tab", { name: "One" });
    const second = screen.getByRole("tab", { name: "Two" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-selected")).toBe("true");
  });
  it("Tooltip opens when its trigger receives focus", async () => {
    const user = userEvent.setup();
    render(<TooltipProvider><Tooltip><TooltipTrigger>Help</TooltipTrigger><TooltipContent>Helpful text</TooltipContent></Tooltip></TooltipProvider>);
    await user.tab();
    expect(screen.getByRole("tooltip").textContent).toContain("Helpful text");
  });
});

describe("AI Elements primitives", () => {
  it("Attachment labels a removable file", () => {
    render(<Attachments variant="inline"><Attachment onRemove={() => undefined} data={{ id: "f1", type: "file", mediaType: "text/plain", filename: "notes.txt", url: "https://example.test/notes.txt" }}><AttachmentInfo /><AttachmentRemove /></Attachment></Attachments>);
    expect(screen.getByText("notes.txt")).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove/i })).toBeTruthy();
  });
  it("Confirmation provides a labeled action button", () => {
    render(<ConfirmationAction>Approve</ConfirmationAction>);
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });
  it("Inline Citation keeps citation text", () => {
    render(<InlineCitation><InlineCitationText>Source [1]</InlineCitationText></InlineCitation>);
    expect(screen.getByText("Source [1]")).toBeTruthy();
  });
  it("Message exposes assistant content", () => {
    render(<Message from="assistant"><MessageContent>Answer text</MessageContent></Message>);
    expect(screen.getByText("Answer text")).toBeTruthy();
  });
  it("Prompt Input exposes a labeled textbox and submit button", () => {
    render(<PromptInput onSubmit={() => undefined}><PromptInputTextarea aria-label="Message"/><PromptInputSubmit aria-label="Send" /></PromptInput>);
    expect(screen.getByRole("textbox", { name: "Message" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });
  it("Reasoning opens from its trigger", async () => {
    const user = userEvent.setup();
    render(<Reasoning><ReasoningTrigger>Reasoning</ReasoningTrigger><ReasoningContent>Steps used</ReasoningContent></Reasoning>);
    await user.click(screen.getByRole("button", { name: /reasoning/i }));
    expect(screen.getByText("Steps used")).toBeTruthy();
  });
  it("Sources disclose links from a labeled trigger", async () => {
    const user = userEvent.setup();
    render(<Sources><SourcesTrigger count={1}>Sources</SourcesTrigger><SourcesContent><Source href="https://example.test">Example</Source></SourcesContent></Sources>);
    await user.click(screen.getByRole("button", { name: "Sources" }));
    expect(screen.getByRole("link", { name: "Example" })).toBeTruthy();
  });
  it("Stack Trace expands from a labeled control", async () => {
    const user = userEvent.setup();
    render(<StackTrace trace="Error: failed"><StackTraceHeader>Expand trace</StackTraceHeader><StackTraceContent>Trace details</StackTraceContent></StackTrace>);
    await user.click(screen.getByRole("button", { name: "Expand trace" }));
    expect(screen.getByText("Trace details")).toBeTruthy();
  });
  it("Suggestion is a keyboard-accessible button", async () => {
    const user = userEvent.setup();
    render(<Suggestion suggestion="Summarize" />);
    const button = screen.getByRole("button", { name: "Summarize" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(button);
  });
  it("Task collapses and expands with its trigger", async () => {
    const user = userEvent.setup();
    render(<Task defaultOpen={false}><TaskTrigger title="Run task"/><TaskContent>Task details</TaskContent></Task>);
    await user.click(screen.getByRole("button", { name: /run task/i }));
    expect(screen.getByText("Task details")).toBeTruthy();
  });
  it("Terminal exposes output and copy control", () => {
    render(<Terminal output="ready"><TerminalCopyButton aria-label="Copy output"/><TerminalContent /></Terminal>);
    expect(screen.getByText("ready")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy output" })).toBeTruthy();
  });
  it("Tool exposes a named trigger and expandable content", async () => {
    const user = userEvent.setup();
    render(<Tool><ToolHeader type="dynamic-tool" toolName="lookup" state="output-available"/><ToolContent>Tool details</ToolContent></Tool>);
    const trigger = screen.getByRole("button", { name: /lookup/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Tool details")).toBeTruthy();
  });
});
