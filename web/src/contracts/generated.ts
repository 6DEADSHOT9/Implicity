// Generated from contracts/schemas; run make contracts-generate.
// schema-sha256: b20aa01ee0d04c05514cf3531f190399c688f1181f95f4777c7983bb46546764
export type HttpsImplicityLocalContracts = Event | Proposal | Decision | Spec;
export type Event =
  | Action_SessionStarted
  | Action_SessionEnded
  | Action_ConversationStarted
  | Action_ConversationEnded
  | Action_MessageSent
  | Action_AnswerShown
  | Action_ComponentShown
  | Action_ComponentSeen
  | Action_SectionExpanded
  | Action_SectionCollapsed
  | Action_RepresentationSwitched
  | Action_PanelOpened
  | Action_PanelClosed
  | Action_PanelDocked
  | Action_PanelUndocked
  | Action_AnswerCopied
  | Action_CodeCopied
  | Action_AnswerRegenerated
  | Action_GenerationStopped
  | Action_MessageEdited
  | Action_ShortcutUsed
  | Action_SearchUsed
  | Action_AttachmentAdded
  | Action_DraftDeleted
  | Action_ChangeShown
  | Action_ChangeKept
  | Action_ChangeUndone
  | Action_ProposalShown
  | Action_ProposalKept
  | Action_ProposalDismissed
  | Action_WidgetSeen
  | Action_WidgetUsed
  | Action_WidgetPinned
  | Action_WidgetDismissed
  | Action_MediaPlayed
  | Action_MediaPaused
  | Action_MediaSeeked
  | Action_MediaReplayed
  | SettingChanged_Reasoning
  | SettingChanged_LongAnswers
  | SettingChanged_DataForm
  | SettingChanged_SourcesPanel
  | SettingChanged_ProjectPanel
  | SettingChanged_ShortcutChips
  | SettingChanged_Density
  | SettingChanged_AnswerLength
  | SettingChanged_AnswerOrder
  | SettingChanged_AnswerForm
  | SettingChanged_AnswerTone
  | TurnSummary
  | SessionSummary;
export type ShortcutId = "copy_answer" | "copy_code" | "regenerate_answer" | "stop_generation" | "search";

export interface Action_SessionStarted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "session_started";
  mode: string;
  text_scale: number;
  local_hour_bucket: number;
}
export interface Action_SessionEnded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "session_ended";
  mode: string;
  text_scale: number;
  local_hour_bucket: number;
}
export interface Action_ConversationStarted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "conversation_started";
}
export interface Action_ConversationEnded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "conversation_ended";
}
export interface Action_MessageSent {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "message_sent";
  length_bucket: "short" | "medium" | "long";
  attachment_count: number;
  shortcut?: ShortcutId | null;
}
export interface Action_AnswerShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "answer_shown";
  length_bucket: "short" | "medium" | "long";
  has_code: boolean;
  has_table: boolean;
  has_reasoning: boolean;
}
export interface Action_ComponentShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "component_shown";
  default_state: "empty" | "loading" | "long_content" | "error" | "folded" | "open" | "closed";
}
export interface Action_ComponentSeen {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "component_seen";
  seconds_visible: number;
}
export interface Action_SectionExpanded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "section_expanded";
  section_type: "reasoning" | "long_answer" | "details" | "run_activity";
}
export interface Action_SectionCollapsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "section_collapsed";
  section_type: "reasoning" | "long_answer" | "details" | "run_activity";
}
export interface Action_RepresentationSwitched {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "representation_switched";
  from: "prose" | "list" | "table" | "chart" | "code";
  to: "prose" | "list" | "table" | "chart" | "code";
}
export interface Action_PanelOpened {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "panel_opened";
  panel: "sources" | "project";
}
export interface Action_PanelClosed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "panel_closed";
  panel: "sources" | "project";
}
export interface Action_PanelDocked {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "panel_docked";
  panel: "sources" | "project";
}
export interface Action_PanelUndocked {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "panel_undocked";
  panel: "sources" | "project";
}
export interface Action_AnswerCopied {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "answer_copied";
  share_bucket: "small" | "half" | "large";
}
export interface Action_CodeCopied {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "code_copied";
  share_bucket: "small" | "half" | "large";
}
export interface Action_AnswerRegenerated {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "answer_regenerated";
  seconds_since_answer: number;
}
export interface Action_GenerationStopped {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "generation_stopped";
  seconds_since_answer: number;
}
export interface Action_MessageEdited {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "message_edited";
  seconds_since_answer: number;
}
export interface Action_ShortcutUsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "shortcut_used";
  shortcut_name: ShortcutId;
}
export interface Action_SearchUsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "search_used";
}
export interface Action_AttachmentAdded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "attachment_added";
  type: "file" | "photo";
}
export interface Action_DraftDeleted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "draft_deleted";
  length_bucket: "short" | "medium" | "long";
}
export interface Action_ChangeShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "change_shown";
  decision_id: string;
}
export interface Action_ChangeKept {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "change_kept";
  decision_id: string;
}
export interface Action_ChangeUndone {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "change_undone";
  decision_id: string;
}
export interface Action_ProposalShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "proposal_shown";
  proposal_id: string;
  proposal_type: "look" | "widget" | "workflow" | "kind";
}
export interface Action_ProposalKept {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "proposal_kept";
  proposal_id: string;
  proposal_type: "look" | "widget" | "workflow" | "kind";
}
export interface Action_ProposalDismissed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "proposal_dismissed";
  proposal_id: string;
  proposal_type: "look" | "widget" | "workflow" | "kind";
}
export interface Action_WidgetSeen {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "widget_seen";
  widget_id: string;
}
export interface Action_WidgetUsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "widget_used";
  widget_id: string;
}
export interface Action_WidgetPinned {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "widget_pinned";
  widget_id: string;
}
export interface Action_WidgetDismissed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "widget_dismissed";
  widget_id: string;
}
export interface Action_MediaPlayed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "media_played";
  position_bucket: "start" | "quarter" | "middle" | "three_quarters" | "end";
}
export interface Action_MediaPaused {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "media_paused";
  position_bucket: "start" | "quarter" | "middle" | "three_quarters" | "end";
}
export interface Action_MediaSeeked {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "media_seeked";
  position_bucket: "start" | "quarter" | "middle" | "three_quarters" | "end";
}
export interface Action_MediaReplayed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "media_replayed";
  position_bucket: "start" | "quarter" | "middle" | "three_quarters" | "end";
}
export interface SettingChanged_Reasoning {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "reasoning";
  value: "folded" | "expanded";
}
export interface SettingChanged_LongAnswers {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "long_answers";
  value: "folded" | "open";
}
export interface SettingChanged_DataForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "data_form";
  value: "table" | "chart";
}
export interface SettingChanged_SourcesPanel {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "sources_panel";
  value: "closed" | "docked";
}
export interface SettingChanged_ProjectPanel {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "project_panel";
  value: "closed" | "docked";
}
export interface SettingChanged_ShortcutChips {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "shortcut_chips";
  value: true | false;
}
export interface SettingChanged_Density {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "density";
  value: "compact" | "comfortable" | "spacious";
}
export interface SettingChanged_AnswerLength {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "answer_length";
  value: "short" | "medium" | "long";
}
export interface SettingChanged_AnswerOrder {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "answer_order";
  value: "answer first" | "explanation first";
}
export interface SettingChanged_AnswerForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "answer_form";
  value: "prose" | "list" | "table";
}
export interface SettingChanged_AnswerTone {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string | null;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "setting_changed";
  dimension: "answer_tone";
  value: "normal" | "warm" | "terse";
}
export interface TurnSummary {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "turn_summary";
  typing: Typing;
  reading: {
    time_on_answer: number;
    furthest_point: number;
    scroll_backs: number;
    time_before_next_action: number;
  };
  pointer: {
    distance_travelled: number;
    hesitations: number;
    misses_on_small_targets: number;
  };
}
export interface Typing {
  composing_time: number;
  mean_key_gap: number;
  key_gap_spread: number;
  burst_count: number;
  pause_count: number;
  backspace_rate: number;
}
export interface SessionSummary {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string | null;
  kind?: string | null;
  component?: string | null;
  slot?: string;
  layout_version?: number | null;
  registry_version?: number | null;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "trackpad" | "touch";
  session_flag: "normal" | "guest_suspected";
  name: "session_summary";
  duration: number;
  active_time: number;
  turns: number;
  kinds: string[];
  local_hour_bucket: number;
  day_type: "weekday" | "weekend";
  typing: Typing;
}
export interface Proposal {
  id: string;
  source: "rule" | "hermes" | "person";
  dimension: string;
  kind: string | null;
  to: unknown;
  mode: "automatic" | "proposed";
  reason: string;
  evidence: {
    features?: unknown[];
    occasions?: number;
    conversations?: number;
    days?: number;
    [k: string]: unknown;
  };
  payload: {
    [k: string]: unknown;
  };
}
export interface Decision {
  id: string;
  proposal_id: string;
  dimension: string;
  kind: string | null;
  from: unknown;
  to: unknown;
  reason: string;
  evidence: {
    [k: string]: unknown;
  };
  dimension_version: number;
  status: "pending" | "shown" | "kept" | "undone" | "reverted";
  created_at: string;
  shown_at: string | null;
}
export interface Spec {
  registry_version: number;
  root: string;
  elements: {
    [k: string]: SpecElement;
  };
}
export interface SpecElement {
  type: string;
  props: {
    [k: string]: unknown;
  };
  slots?: {
    [k: string]: string[];
  };
}
