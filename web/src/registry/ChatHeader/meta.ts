export const meta = {
  "role": "shell",
  "slots": [],
  "defaultStates": [
    "standard",
    "with-settings"
  ],
  "commands": ["open_settings"],
  "limits": {
    "minWidth": 320,
    "minHeight": 44,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "standard",
      "props": {
        "title": "https://example.invalid/conversations/a-deliberately-long-unbroken-title-that-must-wrap-on-tablet",
        "kind": "coding"
      }
    },
    {
      "id": "with-settings",
      "props": {
        "title": "https://example.invalid/conversations/a-deliberately-long-unbroken-title-that-must-wrap-on-tablet",
        "kind": "coding",
        "settingsOpen": true
      }
    }
  ]
} as const;
