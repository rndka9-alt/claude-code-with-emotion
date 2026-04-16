import tailwindcss from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";
import tailwindTokens from "./tailwind.config.js";

const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

const colorNames = Object.keys(tailwindTokens.theme.extend.colors);
const shadowNames = Object.keys(tailwindTokens.theme.extend.boxShadow);

// 커스텀 컬러 토큰: 유틸리티·variant prefix + opacity modifier(/20 등) 허용
const colorPatterns = colorNames.map(
  (n) => `.*\\-${escapeRegex(n)}(/.*)?`,
);
// 커스텀 shadow 토큰
const shadowPatterns = shadowNames.map((n) => `shadow\\-${escapeRegex(n)}`);

export default [
  {
    ignores: ["dist/**"],
  },
  ...tailwindcss.configs["flat/recommended"],
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Prettier가 정렬하므로 ESLint 정렬 룰은 끔
      "tailwindcss/classnames-order": "off",
      "tailwindcss/no-custom-classname": "error",
    },
    settings: {
      tailwindcss: {
        whitelist: [
          ...colorPatterns,
          ...shadowPatterns,
          // CSS 셀렉터 기반 마커 클래스 — Tailwind 유틸리티가 아니므로 허용
          "scrollbar\\-hide",
          "status\\-panel__.*",
          "tab\\-title\\-editor",
          "tab\\-close\\-button",
        ],
      },
    },
  },
];
