export const meta = {
  "role": "shell",
  "slots": [],
  "defaultStates": [
    "closed",
    "open"
  ],
  "commands": [],
  "limits": {
    "minWidth": 320,
    "minHeight": 64,
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
          "https://example.invalid/search/results/this-is-a-long-unbroken-result-label-for-narrow-frames",
          "Planning session"
        ]
      }
    }
  ]
} as const;
