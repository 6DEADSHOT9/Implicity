export type HttpsImplicityLocalContracts =
  ActionEvent | TurnSummary | SessionSummary | Proposal | Decision | Spec | DraftPayload | SettingPayload;

export interface ActionEvent {
  event_id: string;
  name:
    | "session_started"
    | "session_ended"
    | "conversation_started"
    | "conversation_ended"
    | "message_sent"
    | "answer_shown"
    | "component_shown"
    | "component_seen"
    | "section_expanded"
    | "section_collapsed"
    | "representation_switched"
    | "panel_opened"
    | "panel_closed"
    | "panel_docked"
    | "panel_undocked"
    | "answer_copied"
    | "code_copied"
    | "answer_regenerated"
    | "generation_stopped"
    | "message_edited"
    | "shortcut_used"
    | "search_used"
    | "attachment_added"
    | "draft_deleted"
    | "setting_changed"
    | "change_shown"
    | "change_kept"
    | "change_undone"
    | "proposal_shown"
    | "proposal_kept"
    | "proposal_dismissed"
    | "widget_seen"
    | "widget_used"
    | "widget_pinned"
    | "widget_dismissed"
    | "media_played"
    | "media_paused"
    | "media_seeked"
    | "media_replayed";
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
  mode?: string;
  text_scale?: number;
  local_hour_bucket?: number;
  length_bucket?: string;
  attachment_count?: number;
  shortcut?: string | null;
  has_code?: boolean;
  has_table?: boolean;
  has_reasoning?: boolean;
  default_state?: string;
  seconds_visible?: number;
  section_type?: string;
  from?: string;
  to?: string;
  panel?: string;
  share_bucket?: string;
  seconds_since_answer?: number;
  shortcut_name?: string;
  type?: string;
  dimension?: string;
  value?: unknown;
  decision_id?: string;
  proposal_id?: string;
  proposal_type?: string;
  widget_id?: string;
  position_bucket?: string;
}
export interface TurnSummary {
  event_id: string;
  name: "turn_summary";
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
  name: "session_summary";
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
export interface DraftPayload {
  text: string;
}
export interface SettingPayload {
  value: unknown;
}
