// Generated from contracts/schemas; run make contracts-generate.
// schema-sha256: 2b93e4115e5ecebae93b018a1f3d73a59e316958dd45a28c3a4b7356d9e47887
export type HttpsImplicityLocalContracts = Event | Proposal | Decision | Spec | ProposalRequest;
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
  | SettingChanged_HomeWidgets
  | TurnSummary
  | SessionSummary
  | Action_RepresentationSwitched_DataForm
  | Action_RepresentationSwitched_AnswerForm;
export type Command = string;
export type DecisionId = string;
export type ProposalId = string;

export interface Action_SessionStarted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "session_started";
  mode: "light" | "dark";
  text_scale: number;
  local_hour_bucket: "night" | "morning" | "afternoon" | "evening";
}
export interface Action_SessionEnded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "session_ended";
  mode: "light" | "dark";
  text_scale: number;
  local_hour_bucket: "night" | "morning" | "afternoon" | "evening";
}
export interface Action_ConversationStarted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "conversation_started";
}
export interface Action_ConversationEnded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "conversation_ended";
}
export interface Action_MessageSent {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "message_sent";
  length_bucket: "short" | "medium" | "long";
  attachment_count: number;
  command?: Command;
}
export interface Action_AnswerShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
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
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "component_shown";
  default_state: string;
}
export interface Action_ComponentSeen {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "component_seen";
  seconds_visible: number;
  default_state: string;
}
export interface Action_SectionExpanded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "section_expanded";
}
export interface Action_SectionCollapsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "section_collapsed";
}
export interface Action_PanelOpened {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "panel_opened";
}
export interface Action_PanelClosed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "panel_closed";
}
export interface Action_PanelDocked {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "panel_docked";
}
export interface Action_PanelUndocked {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "panel_undocked";
}
export interface Action_AnswerCopied {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "answer_copied";
  share_bucket: "some" | "most" | "all";
}
export interface Action_CodeCopied {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "code_copied";
  share_bucket: "some" | "most" | "all";
}
export interface Action_AnswerRegenerated {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "answer_regenerated";
  seconds_since_answer: number;
}
export interface Action_GenerationStopped {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "generation_stopped";
  seconds_since_answer: number;
}
export interface Action_MessageEdited {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "message_edited";
  seconds_since_answer: number | null;
}
export interface Action_ShortcutUsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "shortcut_used";
  command: Command;
}
export interface Action_SearchUsed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "search_used";
}
export interface Action_AttachmentAdded {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "attachment_added";
  type: "image" | "document" | "audio" | "video" | "other";
}
export interface Action_DraftDeleted {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "draft_deleted";
  length_bucket: "short" | "medium" | "long";
}
export interface Action_ChangeShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "change_shown";
  decision_id: DecisionId;
}
export interface Action_ChangeKept {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "change_kept";
  decision_id: DecisionId;
}
export interface Action_ChangeUndone {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "change_undone";
  decision_id: DecisionId;
}
export interface Action_ProposalShown {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "proposal_shown";
  proposal_id: ProposalId;
  proposal_type: "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
}
export interface Action_ProposalKept {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "proposal_kept";
  proposal_id: ProposalId;
  proposal_type: "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
}
export interface Action_ProposalDismissed {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "proposal_dismissed";
  proposal_id: ProposalId;
  proposal_type: "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
}
export interface SettingChanged_Reasoning {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "reasoning";
  value: "folded" | "expanded";
}
export interface SettingChanged_LongAnswers {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "long_answers";
  value: "folded" | "open";
}
export interface SettingChanged_DataForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "data_form";
  value: "table" | "chart";
}
export interface SettingChanged_SourcesPanel {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "sources_panel";
  value: "closed" | "docked";
}
export interface SettingChanged_ProjectPanel {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "project_panel";
  value: "closed" | "docked";
}
export interface SettingChanged_ShortcutChips {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "shortcut_chips";
  value: "on" | "off";
  command: Command;
}
export interface SettingChanged_Density {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "density";
  value: "compact" | "comfortable" | "spacious";
}
export interface SettingChanged_AnswerLength {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "answer_length";
  value: "short" | "medium" | "long";
}
export interface SettingChanged_AnswerOrder {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "answer_order";
  value: "answer first" | "explanation first";
}
export interface SettingChanged_AnswerForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "answer_form";
  value: "prose" | "list" | "table";
}
export interface SettingChanged_AnswerTone {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "answer_tone";
  value: "normal" | "warm" | "terse";
}
export interface SettingChanged_HomeWidgets {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "setting_changed";
  dimension: "home_widgets";
  value: "on" | "off";
}
export interface TurnSummary {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "turn_summary";
  typing: Typing;
  reading: {
    time_on_answer: number | null;
    furthest_point: number;
    scroll_backs: number;
    time_before_next_action: number | null;
  };
  pointer: {
    distance_travelled: number;
    hesitations: number;
    misses_on_small_targets: number;
  };
}
export interface Typing {
  composing_time: number | null;
  mean_key_gap: number | null;
  key_gap_spread: number | null;
  burst_count: number;
  pause_count: number;
  backspace_rate: number | null;
}
export interface SessionSummary {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "session_summary";
  duration: number | null;
  active_time: number | null;
  turns: number;
  kinds: (("casual" | "coding" | "writing" | "analysis" | "other") | string)[];
  local_hour_bucket: "night" | "morning" | "afternoon" | "evening";
  day_type: "weekday" | "weekend";
  typing: Typing;
}
export interface Action_RepresentationSwitched_DataForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "representation_switched";
  dimension: "data_form";
  from: "table" | "chart";
  to: "table" | "chart";
}
export interface Action_RepresentationSwitched_AnswerForm {
  event_id: string;
  timestamp: string;
  contracts_version: number;
  session_id: string;
  conversation_id?: string;
  kind?: ("casual" | "coding" | "writing" | "analysis" | "other") | string;
  component?: string;
  slot?: string;
  layout_version: number;
  registry_version: number;
  device_class: "desktop" | "tablet";
  input_type: "mouse" | "touch" | "pen" | "none";
  name: "representation_switched";
  dimension: "answer_form";
  from: "prose" | "list" | "table";
  to: "prose" | "list" | "table";
}
export interface Proposal {
  id: ProposalId;
  source: "rule" | "hermes" | "person";
  dimension: string;
  kind: ("casual" | "coding" | "writing" | "analysis" | "other") | string | null;
  to: unknown;
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
  change_policy: "automatic" | "proposed";
  type: "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
}
export interface Decision {
  id: DecisionId;
  proposal_id: ProposalId;
  dimension: string;
  kind: ("casual" | "coding" | "writing" | "analysis" | "other") | string | null;
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
export interface ProposalRequest {
  source: "hermes";
  dimension: string;
  kind: ("casual" | "coding" | "writing" | "analysis" | "other") | string | null;
  to: unknown;
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
  change_policy: "automatic" | "proposed";
  type: "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
}
