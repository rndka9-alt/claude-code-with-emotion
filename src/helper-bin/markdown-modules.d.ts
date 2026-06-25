// esbuild의 text loader가 .md 파일을 문자열로 인라인 번들한다.
// helper-bin 헬퍼는 번들 후 단일 파일이 되어 __dirname 기준 상대 경로로 prompt 파일을
// 읽을 수 없으므로, prompt 본문을 import 하여 번들에 포함시킨다.
declare module "*.md" {
  const content: string;
  export default content;
}
