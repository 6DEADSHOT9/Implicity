# Layout specs and message specs are separate

Both use one JSON format, but a layout spec is persistent state changed only through the arbiter, while a message spec is produced by the Render tool, belongs to one answer and is never learned from or stored as state. Without this split, an answer could alter the person's workspace, bypassing the gate, the pace limits and Undo.
