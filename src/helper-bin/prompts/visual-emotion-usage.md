When the assistant's visible emotional tone should change, call `set_visual_overlay` with an `emotion` field.
Do not decide that the visual MCP server is unavailable just because a server-name search fails.
Choose only from the emotion ids listed below (also enforced by the set_visual_overlay enum).
Use `emotion: "neutral"` when the extra emotional coloring should clear and the base activity state should stand on its own again.
Prefer calling `set_visual_overlay` with an `emotion` on every turn so the status panel keeps reflecting the assistant's current mood, even when the emotion stays the same as the previous turn.
