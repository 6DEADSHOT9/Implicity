import actions from "../../../contracts/actions.json" with { type: "json" };

export const SEEN_VISIBLE_RATIO = actions.component_seen.visible_ratio;
export const SEEN_VISIBLE_SECONDS = actions.component_seen.visible_seconds;
export const DEVICE_CLASS_BREAKPOINT = actions.device_class_breakpoint;
export const SECONDS_DECIMAL_PLACES = actions.seconds_decimal_places;
export const deviceClass = (width: number): "tablet" | "desktop" => width < DEVICE_CLASS_BREAKPOINT ? "tablet" : "desktop";
