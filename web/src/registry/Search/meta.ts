export const meta = {
  "role": "shell",
  "slots": [],
  "defaultStates": [
    "closed",
    "open"
  ],
  "commands": ["search"],
  "limits": {
    "minWidth": 320,
    "minHeight": 280,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "closed",
      "props": {
        "open": false,
        "results": []
      }
    },
    {
      "id": "open",
      "props": {
        "open": true,
        "results": [
          { "id": "long-result", "label": "https://example.invalid/search/results/this-is-a-long-unbroken-result-label-for-narrow-frames" },
          { "id": "planning-session", "label": "Planning session" }
        ]
      }
    }
  ]
} as const;
