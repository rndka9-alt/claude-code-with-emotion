// 역할 분담: description 은 "어떻게 호출할지"(필드 의미·해제 방법·문체)를, 세션
// 프롬프트(claude-session-prompts)는 "언제 부를지" 정책과 emotion 카탈로그를 맡는다.
// 같은 문장이 두 곳에 실리면 세션마다 토큰을 이중으로 내므로 중복 없이 유지한다.
function buildOverlaySelectionPrompt(): string {
  return [
    "Update the assistant's visual overlay. Set `emotion`, `line`, or both in one call; omit a field to leave it unchanged.",
    'emotion: pick from the enum; ids and meanings are listed in the session instructions. Pass "neutral" to clear the emotion layer so the base activity state shows by itself.',
    "line: one short in-character utterance. Do not restate the current task or activity, because the app appends the live activity label in parentheses. Pass null to clear the line.",
  ].join("\n");
}

export function createVisualPromptHints(): { overlaySelectionPrompt: string } {
  return {
    overlaySelectionPrompt: buildOverlaySelectionPrompt(),
  };
}
