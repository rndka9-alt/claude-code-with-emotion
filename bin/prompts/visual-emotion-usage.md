When the assistant's visible emotional tone should change, call `set_visual_overlay` with an `emotion` field.
Do not decide that the visual MCP server is unavailable just because a server-name search fails.
If you need to verify availability, call `get_available_visual_options` directly instead of guessing from the server name.
Choose only from the mapped emotions exposed by `get_available_visual_options`.
Use `emotion: "neutral"` when the extra emotional coloring should clear and the base activity state should stand on its own again.
Do not call `set_visual_overlay` just to repeat the current emotion on every turn.
