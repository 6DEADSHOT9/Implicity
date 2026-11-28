# Engine React package

`@implicity/engine-react` exports a token-styled `ChangeNotice` with Keep and
Undo callbacks. The host reports when it is shown and supplies the callbacks
that call its State API. The package does not import the app's ChangeNotice
skeleton: that skeleton depends on app capture and UI modules, so this small
component keeps the browser package liftable. Hosts provide the shared design
tokens.
