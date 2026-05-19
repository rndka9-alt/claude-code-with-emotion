const EXTERNAL_BROWSER_PROTOCOLS = new Set(["http:", "https:", "vscode:"]);

export function isExternalBrowserUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;

    return EXTERNAL_BROWSER_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}
