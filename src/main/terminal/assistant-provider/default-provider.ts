import { claudeAssistantProvider } from "./claude";
import type { AssistantProvider } from "./provider";

export function getDefaultAssistantProvider(): AssistantProvider {
  return claudeAssistantProvider;
}

export function getVisualMcpSetupStatus(
  stateFilePath: string,
): ReturnType<AssistantProvider["mcpSetup"]["getStatus"]> {
  return getDefaultAssistantProvider().mcpSetup.getStatus(stateFilePath);
}

export function installVisualMcpUserSetup(
  helperBinDir: string,
  stateFilePath: string,
): ReturnType<AssistantProvider["mcpSetup"]["install"]> {
  return getDefaultAssistantProvider().mcpSetup.install(
    helperBinDir,
    stateFilePath,
  );
}

export function removeVisualMcpUserSetup(
  stateFilePath: string,
): ReturnType<AssistantProvider["mcpSetup"]["remove"]> {
  return getDefaultAssistantProvider().mcpSetup.remove(stateFilePath);
}
