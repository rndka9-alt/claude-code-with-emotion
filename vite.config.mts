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
    plugins: [react(), tailwindcss()],
    define: {
      __BUILD_COMMIT__: JSON.stringify(getGitCommitHash()),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      outDir: "dist/renderer",
      emptyOutDir: true,
      minify: isDevelopmentMode ? false : "esbuild",
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
    },
  };
});
