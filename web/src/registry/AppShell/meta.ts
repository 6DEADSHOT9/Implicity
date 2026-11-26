export const meta = {
  "role": "shell",
  "slots": [
    "main",
    "navigation",
    "panel"
  ],
  "defaultStates": [
    "default",
    "docked"
  ],
  "commands": [],
  "limits": {
    "minWidth": 320,
    "minHeight": 320,
    "minContrast": 4.5
  },
  "galleryStates": [
    {
      "id": "default",
      "props": {
        "panelOpen": false
      },
      "slots": {
        "main": [
          "main_content"
        ],
        "navigation": [
          "navigation_items"
        ],
        "panel": [
          "panel_content"
        ]
      }
    },
    {
      "id": "docked",
      "props": {
        "panelOpen": true
      },
      "slots": {
        "main": [
          "main_content"
        ],
        "navigation": [
          "navigation_items"
        ],
        "panel": [
          "panel_content"
        ]
      }
    }
  ]
} as const;
