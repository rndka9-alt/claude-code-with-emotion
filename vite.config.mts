import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function getGitCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const isDevelopmentMode = mode === "development";

  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      // helper-bin 소스는 prompt .md 를 문자열로 import 한다(esbuild text loader 와 동일).
      // vitest 가 그 모듈을 테스트할 수 있도록 .md 를 text 로 변환한다.
      {
        name: "load-md-as-text",
        transform(code: string, id: string) {
          if (id.endsWith(".md")) {
            return { code: `export default ${JSON.stringify(code)};`, map: null };
          }

          return null;
        },
      },
    ],
    define: {
      __BUILD_COMMIT__: JSON.stringify(getGitCommitHash()),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      outDir: "dist/renderer",
      emptyOutDir: true,
      minify: !isDevelopmentMode,
      sourcemap: isDevelopmentMode,
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/renderer/test/setup.ts",
      css: true,
      exclude: ["**/node_modules/**", "**/dist/**"],
    },
  };
});
