export const meta = {
  "role": "shell",
  "slots": [],
  "defaultStates": [
    "empty",
    "with-attachments"
  ],
  "commands": [],
  "limits": {
    "minWidth": 320,
    "minHeight": 44,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "empty",
      "props": {
        "attachments": [],
        "shortcuts": [
          { "id": "cmd_550e8400-e29b-41d4-a716-446655440010", "label": "Summarize" },
          { "id": "cmd_550e8400-e29b-41d4-a716-446655440011", "label": "Explain" }
        ]
      }
    },
    {
      "id": "with-attachments",
      "props": {
        "attachments": [
          "report.pdf"
        ],
        "shortcuts": [
          { "id": "cmd_550e8400-e29b-41d4-a716-446655440010", "label": "Summarize" },
          { "id": "cmd_550e8400-e29b-41d4-a716-446655440011", "label": "Explain" }
        ]
      }
    }
  ]
} as const;
