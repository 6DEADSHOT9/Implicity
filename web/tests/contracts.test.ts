import type { Event, SettingChanged_Density } from "../src/contracts/generated";
import { describe, expect, it } from "vitest";

const validEvent: Event = {
  event_id: "evt_1",
  name: "message_sent",
  timestamp: "2026-11-24T00:00:00Z",
  contracts_version: 1,
  session_id: "ses_1",
  device_class: "desktop",
  input_type: "mouse",
  session_flag: "normal",
  length_bucket: "medium",
  attachment_count: 0,
};

// @ts-expect-error event variants reject undocumented fields
const invalidEvent: Event = { ...validEvent, message_text: "private text" };

// @ts-expect-error the action-specific fields are required
const incompleteEvent: Event = { ...validEvent, length_bucket: undefined };

const validSetting: SettingChanged_Density = {
  ...validEvent,
  name: "setting_changed",
  dimension: "density",
  value: "spacious",
};

// @ts-expect-error dimension values come from the dimension contract
const invalidSetting: SettingChanged_Density = { ...validSetting, value: "KeyA" };

describe("generated contract types", () => {
  it("keeps valid action and dimension values", () => {
    expect(validEvent.name).toBe("message_sent");
    expect(validSetting.value).toBe("spacious");
  });
});

void [invalidEvent, incompleteEvent, invalidSetting];
