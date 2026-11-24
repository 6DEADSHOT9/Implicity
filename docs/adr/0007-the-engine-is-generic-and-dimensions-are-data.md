# The engine is generic and dimensions are data

The adaptive engine manages named dimensions with evidence, gates, decisions and Undo, and does not know what any dimension means. Each dimension is a declarative file owned by the app. This is what makes the engine reusable in another project, and it means adding an adaptation needs no engine code. Home, workflows and nudges are app features that ask the engine for admission, not engine features.
