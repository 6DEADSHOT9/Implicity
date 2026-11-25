// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, CarouselNext } from "../src/components/ui/carousel";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../src/components/ui/hover-card";
import { Input } from "../src/components/ui/input";
import { InputGroup, InputGroupAddon } from "../src/components/ui/input-group";
import { Item, ItemTitle } from "../src/components/ui/item";
import { Kbd } from "../src/components/ui/kbd";
import { Label } from "../src/components/ui/label";
import { Pagination } from "../src/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/ui/popover";
import { Progress } from "../src/components/ui/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../src/components/ui/resizable";
import { ScrollArea } from "../src/components/ui/scroll-area";
import { Separator } from "../src/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";
import { SidebarMenuButton, SidebarProvider } from "../src/components/ui/sidebar";
import { Slider } from "../src/components/ui/slider";
import { Skeleton } from "../src/components/ui/skeleton";
import { Spinner } from "../src/components/ui/spinner";
import { Switch } from "../src/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "../src/components/ui/table";
import { Textarea } from "../src/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip";
import { Attachment, AttachmentInfo, AttachmentRemove, Attachments } from "../src/components/ai-elements/attachments";
import { ConfirmationAction } from "../src/components/ai-elements/confirmation";
import { InlineCitation, InlineCitationText } from "../src/components/ai-elements/inline-citation";
import { Message, MessageContent, MessageResponse } from "../src/components/ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "../src/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../src/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "../src/components/ai-elements/sources";
import { StackTrace, StackTraceContent, StackTraceHeader } from "../src/components/ai-elements/stack-trace";
import { Suggestion } from "../src/components/ai-elements/suggestion";
import { Task, TaskContent, TaskTrigger } from "../src/components/ai-elements/task";
import { Terminal, TerminalContent, TerminalCopyButton } from "../src/components/ai-elements/terminal";
import { Tool, ToolContent, ToolHeader } from "../src/components/ai-elements/tool";
import { Toaster } from "../src/components/ui/sonner";

describe("shadcn primitives", () => {
  it("Alert exposes the alert role and its heading", () => {
    render(<Alert><AlertTitle>Saved</AlertTitle><AlertDescription>Changes saved</AlertDescription></Alert>);
    expect(screen.getByRole("alert").textContent).toContain("Saved");
  });
  it("AspectRatio constrains the box to the requested ratio", () => {
    render(<AspectRatio ratio={16 / 9}><span>Preview</span></AspectRatio>);
    const box = screen.getByText("Preview").closest('[data-slot="aspect-ratio"]');
    const ratioBox = box?.parentElement;
    expect((ratioBox as HTMLElement).style.paddingBottom).toBe("56.25%");
    expect((ratioBox as HTMLElement).style.position).toBe("relative");
  });
  it("Avatar renders its fallback in the avatar slot", () => {
    render(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
    expect(screen.getByText("AB").closest('[data-slot="avatar-fallback"]')).toBeTruthy();
  });
  it("Badge and Kbd retain their labels", () => {
    render(<><Badge>Ready</Badge><Kbd>⌘K</Kbd></>);
    expect(screen.getByText("Ready").getAttribute("data-slot")).toBe("badge");
    expect(screen.getByText("⌘K").tagName).toBe("KBD");
  });
  it("Bubble and Card preserve their content semantics", () => {
    render(<><Bubble><BubbleContent>Answer</BubbleContent></Bubble><Card><CardTitle>Title</CardTitle><CardContent>Details</CardContent></Card></>);
    expect(screen.getByText("Answer").closest('[data-slot="bubble-content"]')).toBeTruthy();
    expect(screen.getByText("Title").getAttribute("data-slot")).toBe("card-title");
    expect(screen.getByText("Details").closest('[data-slot="card"]')).toBeTruthy();
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
    expect(screen.getByText("No results").getAttribute("data-slot")).toBe("empty-title");
    expect(screen.getByText("Project").closest('[data-slot="item"]')).toBeTruthy();
  });
  it("Field label is associated with its input", () => {
    render(<Field><FieldLabel htmlFor="email">Email</FieldLabel><Input id="email" /></Field>);
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });
  it("Label and Textarea retain their form association", () => {
    render(<><Label htmlFor="notes">Notes</Label><Textarea id="notes" /></>);
    expect(screen.getByLabelText("Notes").tagName).toBe("TEXTAREA");
  });
  it("InputGroup exposes a labeled group and its input", () => {
    render(<InputGroup aria-label="Search"><InputGroupAddon>Find</InputGroupAddon><Input aria-label="Search terms" /></InputGroup>);
    expect(screen.getByRole("group", { name: "Search" }).contains(screen.getByRole("textbox", { name: "Search terms" }))).toBe(true);
  });
  it("Separator exposes its orientation", () => {
    render(<Separator orientation="vertical" decorative={false} />);
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
  });
  it("Carousel exposes its slides and next control", () => {
    render(<Carousel><CarouselContent><CarouselItem>First slide</CarouselItem><CarouselItem>Second slide</CarouselItem></CarouselContent><CarouselNext aria-label="Next" /></Carousel>);
    expect(screen.getByRole("region").getAttribute("aria-roledescription")).toBe("carousel");
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByText("First slide")).toBeTruthy();
    expect(screen.getByText("Second slide")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  });
  it("Skeleton marks its placeholder and Spinner announces loading", () => {
    render(<><Skeleton /><Spinner /></>);
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });
  it("Sonner displays a toast without a theme provider", async () => {
    render(<Toaster />);
    toast("Saved");
    expect(await screen.findByText("Saved")).toBeTruthy();
  });
  it("HoverCard opens on keyboard focus", async () => {
    const user = userEvent.setup();
    render(<HoverCard openDelay={0}><HoverCardTrigger href="#profile">Profile</HoverCardTrigger><HoverCardContent>Profile details</HoverCardContent></HoverCard>);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Profile" }));
    expect(await screen.findByText("Profile details")).toBeTruthy();
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
  it("Resizable exposes a keyboard-operable separator", () => {
    render(<ResizablePanelGroup orientation="horizontal"><ResizablePanel defaultSize={50}>Left</ResizablePanel><ResizableHandle /><ResizablePanel defaultSize={50}>Right</ResizablePanel></ResizablePanelGroup>);
    const separator = screen.getByRole("separator");
    separator.focus();
    expect(separator.getAttribute("aria-valuenow")).not.toBeNull();
    expect(document.activeElement).toBe(separator);
  });
  it("ScrollArea retains its content", () => {
    render(<ScrollArea><span>Scrollable content</span></ScrollArea>);
    expect(screen.getByText("Scrollable content").closest('[data-slot="scroll-area"]')).toBeTruthy();
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
  it("MessageResponse renders a code fence without runtime highlighting styles", () => {
    render(<MessageResponse>{"```js\nconst answer = 42\n```"}</MessageResponse>);
    const code = screen.getByText("const answer = 42");
    expect(code.closest("pre")).toBeTruthy();
    expect(code.getAttribute("style")).not.toContain("color:");
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
    const onClick = vi.fn();
    render(<Suggestion suggestion="Summarize" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Summarize" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(button);
    expect(onClick).toHaveBeenCalledWith("Summarize");
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
