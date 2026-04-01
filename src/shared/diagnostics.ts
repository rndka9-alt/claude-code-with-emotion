export interface RendererDiagnosticPayload {
  type: 'window-error' | 'unhandled-rejection';
  message: string;
  stack?: string;
}

export const DIAGNOSTICS_CHANNELS: {
  rendererEvent: string;
} = {
  rendererEvent: 'diagnostics:renderer-event',
};
