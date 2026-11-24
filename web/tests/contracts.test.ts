import type { Event, SettingChanged_Density } from "../src/contracts/generated";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../contracts/schemas/index.json";
import { describe, expect, it } from "vitest";

const sharedFields = {
  event_id: "evt_1",
  timestamp: "2026-11-24T00:00:00Z",
  contracts_version: 1,
  session_id: "ses_1",
  device_class: "desktop",
  input_type: "mouse",
  session_flag: "normal",
} as const;

const validEvent: Event = {
  ...sharedFields,
  name: "message_sent",
  length_bucket: "medium",
  attachment_count: 0,
};

// @ts-expect-error event variants reject undocumented fields
const invalidEvent: Event = { ...validEvent, message_text: "private text" };

// @ts-expect-error the action-specific fields are required
const incompleteEvent: Event = { ...validEvent, length_bucket: undefined };

const validSetting: SettingChanged_Density = {
  ...sharedFields,
  name: "setting_changed",
  dimension: "density",
  value: "spacious",
};

// @ts-expect-error dimension values come from the dimension contract
const invalidSetting: SettingChanged_Density = { ...validSetting, value: "KeyA" };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateContract = ajv.compile(schema);

describe("generated contract types", () => {
  it("keeps valid action and dimension values", () => {
    expect(validEvent.name).toBe("message_sent");
    expect(validSetting.value).toBe("spacious");
    expect(validateContract(validEvent)).toBe(true);
    expect(validateContract(validSetting)).toBe(true);
    expect(validateContract({ ...validEvent, message_text: "private" })).toBe(false);
  });
});

void [invalidEvent, incompleteEvent, invalidSetting];
