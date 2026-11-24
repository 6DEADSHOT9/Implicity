# Python for the backend

The backend and the engine's logic are Python, with a small React package for the engine's browser side. TypeScript throughout would have let the engine ship as one importable package and share types with the frontend. Python was chosen anyway. It is the same language as Hermes, and shared shapes are generated from JSON Schema to cover the type-sharing gap. The cost is that another project runs the engine as a Python library or small service, not as a single TypeScript import.
