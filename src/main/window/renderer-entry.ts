import path from "node:path";

export function getRendererEntry():
  | { kind: "url"; value: string }
  | { kind: "file"; value: string } {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (typeof devServerUrl === "string" && devServerUrl.length > 0) {
    return { kind: "url", value: devServerUrl };
  }

  return {
    kind: "file",
    value: path.join(__dirname, "../../renderer/index.html"),
  };
}
