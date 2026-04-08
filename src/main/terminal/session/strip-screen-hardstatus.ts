// TERM=screen-256color 환경에서 oh-my-zsh의 termsupport.zsh는
// GNU screen 전용 하드스테이터스 시퀀스 \ek...\e\\ 를 보낸다.
// xterm.js는 이 시퀀스를 직접 인식하지 못해 내용물이 화면에 그대로 찍히므로,
// PTY 출력이 xterm.js에 도달하기 전에 OSC title 시퀀스로 번역한다.
//
// 이렇게 바꾸면 화면 오염은 막으면서도 xterm 의 onTitleChange 이벤트는 살릴 수 있다.

const SCREEN_HARDSTATUS_RE = /\x1bk([^\x1b]*)\x1b\\/g;
const OSC_TITLE_PREFIX = "\x1b]0;";
const OSC_TITLE_SUFFIX = "\x07";

export function stripScreenHardstatus(data: string): string {
  return data.replace(SCREEN_HARDSTATUS_RE, (_match, title: string) => {
    return `${OSC_TITLE_PREFIX}${title}${OSC_TITLE_SUFFIX}`;
  });
}
