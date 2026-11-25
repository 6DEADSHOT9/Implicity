import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AspectRatio } from "./ui/aspect-ratio";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Bubble, BubbleContent } from "./ui/bubble";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Command, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyTitle } from "./ui/empty";
import { Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Item, ItemTitle } from "./ui/item";
import { Kbd } from "./ui/kbd";
import { Marker } from "./ui/marker";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "./ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Progress } from "./ui/progress";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Sidebar, SidebarContent, SidebarMenuButton, SidebarProvider } from "./ui/sidebar";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Attachment, AttachmentInfo, AttachmentPreview, Attachments } from "./ai-elements/attachments";
import { ConfirmationAction } from "./ai-elements/confirmation";
import { InlineCitation, InlineCitationText } from "./ai-elements/inline-citation";
import { Message, MessageContent } from "./ai-elements/message";
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from "./ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "./ai-elements/sources";
import { StackTrace, StackTraceContent, StackTraceHeader } from "./ai-elements/stack-trace";
import { Suggestion } from "./ai-elements/suggestion";
import { Task, TaskContent, TaskTrigger } from "./ai-elements/task";
import { Terminal, TerminalContent, TerminalHeader, TerminalTitle } from "./ai-elements/terminal";
import { Tool, ToolContent, ToolHeader } from "./ai-elements/tool";

const attachment = { id: "gallery-file", type: "file" as const, mediaType: "text/plain", filename: "notes.txt", url: "https://example.test/notes.txt" };

export function PrimitiveGallery() {
  return <section aria-label="Base primitives" className="primitive-gallery">
    <h2>Base primitives</h2>
    <div className="primitive-gallery-grid">
      <Card><CardHeader><CardTitle>Actions and identity</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-space-2"><Button>Continue</Button><ButtonGroup aria-label="Message actions"><Button variant="outline">Copy</Button><Button variant="outline">Retry</Button></ButtonGroup><Badge>Ready</Badge><Avatar><AvatarFallback>IM</AvatarFallback></Avatar><Kbd>⌘K</Kbd></CardContent></Card>
      <Card><CardHeader><CardTitle>Inputs and settings</CardTitle></CardHeader><CardContent className="flex flex-col gap-space-3"><Field><FieldLabel htmlFor="primitive-email">Email</FieldLabel><Input id="primitive-email" placeholder="name@example.com"/></Field><div className="flex items-center gap-space-3"><Checkbox aria-label="Remember this device"/><Switch aria-label="Enable notifications"/><Slider aria-label="Volume" defaultValue={[62]}/></div><Select><SelectTrigger aria-label="Theme"><SelectValue placeholder="Choose a theme"/></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="focused">Focused</SelectItem></SelectContent></Select></CardContent></Card>
      <Card><CardHeader><CardTitle>Navigation and overlays</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-space-3"><Tabs defaultValue="overview"><TabsList aria-label="Panel views"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList><TabsContent value="overview">Current view</TabsContent><TabsContent value="activity">Recent activity</TabsContent></Tabs><Dialog><DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger><DialogContent><DialogTitle>Dialog</DialogTitle><p>Keyboard dismissible.</p></DialogContent></Dialog><Sheet><SheetTrigger asChild><Button variant="outline">Open sheet</Button></SheetTrigger><SheetContent><SheetTitle>Side panel</SheetTitle></SheetContent></Sheet><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">More</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Rename</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Popover><PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger><PopoverContent>Popover content</PopoverContent></Popover><TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild><Button variant="ghost">Help</Button></TooltipTrigger><TooltipContent>Helpful detail</TooltipContent></Tooltip></TooltipProvider></CardContent></Card>
      <Card><CardHeader><CardTitle>Search and layout</CardTitle></CardHeader><CardContent className="flex flex-col gap-space-3"><div className="@container w-full"><span className="hidden @md:flex" data-container-breakpoint>Container breakpoint</span></div><span className="hidden sm:flex md:block lg:grid" data-screen-breakpoint>Screen breakpoint</span><Command label="Search commands"><CommandInput placeholder="Search"/><CommandList><CommandItem>Open a project</CommandItem></CommandList></Command><ResizablePanelGroup orientation="horizontal" className="primitive-gallery-resizable rounded-md border-token"><ResizablePanel defaultSize={50}>Main</ResizablePanel><ResizableHandle withHandle/><ResizablePanel defaultSize={50}>Details</ResizablePanel></ResizablePanelGroup><ScrollArea className="max-h-content-height">Scrollable content</ScrollArea><div className="primitive-gallery-sidebar"><SidebarProvider defaultOpen={false}><Sidebar side="right" collapsible="icon"><SidebarContent><SidebarMenuButton>Inbox</SidebarMenuButton></SidebarContent></Sidebar></SidebarProvider></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Data and empty states</CardTitle></CardHeader><CardContent className="flex flex-col gap-space-3"><Progress aria-label="Task progress" value={62}/><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Review</TableCell><TableCell>Ready</TableCell></TableRow></TableBody></Table><Pagination><PaginationContent><PaginationItem><PaginationLink href="#page-1" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationLink href="#page-2">2</PaginationLink></PaginationItem></PaginationContent></Pagination><Item><ItemTitle>Project row</ItemTitle></Item><Empty><EmptyTitle>No activity</EmptyTitle><EmptyDescription>New updates appear here.</EmptyDescription></Empty><Alert><AlertTitle>Saved</AlertTitle><AlertDescription>Your changes are ready.</AlertDescription></Alert><AspectRatio ratio={16 / 9} className="rounded-md bg-muted"/></CardContent></Card>
      <Card><CardHeader><CardTitle>Conversation</CardTitle></CardHeader><CardContent className="flex flex-col gap-space-3"><Message from="assistant"><MessageContent>Base components inherit the selected look and density.</MessageContent></Message><Marker label="Remembered from your earlier conversation about travel" actions={<Button variant="outline" aria-label="Undo marker">Undo</Button>}>This answer used saved context.</Marker><Bubble><BubbleContent>Conversation bubble</BubbleContent></Bubble><Reasoning><ReasoningTrigger>Reasoning</ReasoningTrigger><ReasoningContent>Checked the available context.</ReasoningContent></Reasoning><Task defaultOpen={false}><TaskTrigger title="Task steps"/><TaskContent>Search · Review · Complete</TaskContent></Task><Tool><ToolHeader type="dynamic-tool" toolName="lookup" state="output-available"/><ToolContent>Tool output</ToolContent></Tool><Sources><SourcesTrigger count={1}/><SourcesContent><Source href="https://example.test">Reference</Source></SourcesContent></Sources><InlineCitation><InlineCitationText>Source [1]</InlineCitationText></InlineCitation><Suggestion suggestion="Summarize"/><ConfirmationAction>Approve</ConfirmationAction></CardContent></Card>
      <Card><CardHeader><CardTitle>Files and output</CardTitle></CardHeader><CardContent className="flex flex-col gap-space-3"><Attachments variant="inline"><Attachment data={attachment}><AttachmentPreview/><AttachmentInfo/></Attachment></Attachments><PromptInput onSubmit={() => undefined}><PromptInputTextarea className="primitive-gallery-prompt" aria-label="Message" placeholder="Write a message"/><PromptInputSubmit aria-label="Send"/></PromptInput><StackTrace trace="Error: failed"><StackTraceHeader>Error details</StackTraceHeader><StackTraceContent>at Gallery (src/gallery.tsx:1:1)</StackTraceContent></StackTrace><Terminal output="ready"><TerminalHeader><TerminalTitle>Terminal</TerminalTitle></TerminalHeader><TerminalContent/></Terminal></CardContent></Card>
    </div>
  </section>;
}
