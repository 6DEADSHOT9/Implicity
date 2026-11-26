export const meta = {
  "role": "shell",
  "slots": [],
  "defaultStates": [
    "standard",
    "with-settings"
  ],
  "commands": [],
  "limits": {
    "minWidth": 320,
    "minHeight": 64,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "standard",
      "props": {
        "title": "https://example.invalid/conversations/a-deliberately-long-unbroken-title-that-must-wrap-on-tablet",
        "kind": "project"
      }
    },
    {
      "id": "with-settings",
      "props": {
        "title": "https://example.invalid/conversations/a-deliberately-long-unbroken-title-that-must-wrap-on-tablet",
        "kind": "project",
        "settingsOpen": true
      }
    }
  ]
} as const;
