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
    "minHeight": 64,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "empty",
      "props": {
        "attachments": [],
        "shortcuts": [
          "Summarize",
          "Explain"
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
          "Summarize",
          "Explain"
        ]
      }
    }
  ]
} as const;
