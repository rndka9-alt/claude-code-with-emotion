import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xterm/xterm/css/xterm.css';
import { App } from './App';
import './styles.css';

function mirrorRuntimeDiagnosticsToRendererConsole(): void {
  const diagnosticsBridge = window.claudeApp?.diagnostics;

  if (diagnosticsBridge === undefined) {
    return;
  }

  diagnosticsBridge.onRuntimeEvent((payload) => {
    const prefix = `[runtime:${payload.scope}]`;
    const formattedMessage = `${prefix} ${payload.message}`;

    if (payload.scope.includes('error') || payload.scope === 'process') {
      console.error(formattedMessage);
      return;
    }

    if (
      payload.scope.includes('warning') ||
      payload.scope === 'renderer-console' ||
      payload.scope === 'window-process'
    ) {
      console.warn(formattedMessage);
      return;
    }

    console.info(formattedMessage);
  });
}

const container = document.getElementById('root');

if (container !== null) {
  mirrorRuntimeDiagnosticsToRendererConsole();
  const root = createRoot(container);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
