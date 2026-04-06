// TERM=screen-256color 환경에서 oh-my-zsh의 termsupport.zsh는
// GNU screen 전용 하드스테이터스 시퀀스 \ek...\e\\ 를 보낸다.
// xterm.js는 이 시퀀스를 인식하지 못해 내용물이 화면에 그대로 찍히므로,
// PTY 출력이 xterm.js에 도달하기 전에 제거한다.
//
// 이 시퀀스는 GNU screen/tmux 안에서만 의미가 있고,
// xterm.js 환경에서는 어떤 기능도 수행하지 않으므로 제거해도 부작용이 없다.

const SCREEN_HARDSTATUS_RE = /\x1bk[^\x1b]*\x1b\\/g;

export function stripScreenHardstatus(data: string): string {
  return data.replace(SCREEN_HARDSTATUS_RE, "");
}
