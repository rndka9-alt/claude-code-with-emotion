import { z } from "zod";

const INITIAL_ASSISTANT_PROVIDER_ARGUMENT_PREFIX = "--assistant-provider=";

const assistantProviderFeaturesSchema = z.object({
  sessionStatus: z.boolean(),
  visualMcpSetup: z.boolean(),
});

const assistantProviderMetadataSchema = z.object({
  displayName: z.string().min(1),
  features: assistantProviderFeaturesSchema,
  id: z.string().min(1),
  launchCommand: z.string().min(1),
});

export type AssistantProviderMetadata = z.infer<
  typeof assistantProviderMetadataSchema
>;

export function parseAssistantProviderMetadata(
  value: unknown,
): AssistantProviderMetadata {
  const result = assistantProviderMetadataSchema.safeParse(value);

  if (!result.success) {
    throw new Error("Assistant provider metadata payload is invalid.");
  }

  return result.data;
}

export function createInitialAssistantProviderMetadataArgument(
  metadata: AssistantProviderMetadata,
): string {
  return `${INITIAL_ASSISTANT_PROVIDER_ARGUMENT_PREFIX}${encodeURIComponent(
    JSON.stringify(metadata),
  )}`;
}

export function parseInitialAssistantProviderMetadataFromArguments(
  args: readonly string[],
): AssistantProviderMetadata | undefined {
  const argument = args.find((candidate) =>
    candidate.startsWith(INITIAL_ASSISTANT_PROVIDER_ARGUMENT_PREFIX),
  );

  if (argument === undefined) {
    return undefined;
  }

  const encodedPayload = argument.slice(
    INITIAL_ASSISTANT_PROVIDER_ARGUMENT_PREFIX.length,
  );

  try {
    return parseAssistantProviderMetadata(
      JSON.parse(decodeURIComponent(encodedPayload)),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parse failure";

    throw new Error(`Invalid assistant provider metadata argument: ${message}`);
  }
}
