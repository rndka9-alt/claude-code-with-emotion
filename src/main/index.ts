import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const WINDOW_SIZE = {
  width: 1440,
  height: 960,
  minWidth: 960,
  minHeight: 720,
};

function getRendererEntry(): { kind: 'url'; value: string } | { kind: 'file'; value: string } {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (typeof devServerUrl === 'string' && devServerUrl.length > 0) {
    return { kind: 'url', value: devServerUrl };
  }

  return {
    kind: 'file',
    value: path.join(__dirname, '../renderer/index.html'),
  };
}

function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const mainWindow = new BrowserWindow({
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    minWidth: WINDOW_SIZE.minWidth,
    minHeight: WINDOW_SIZE.minHeight,
    show: false,
    backgroundColor: '#101218',
    title: 'Claude Code With Emotion',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const rendererEntry = getRendererEntry();

  if (rendererEntry.kind === 'url') {
    void mainWindow.loadURL(rendererEntry.value);
  } else {
    void mainWindow.loadFile(rendererEntry.value);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  return mainWindow;
}

function hasOpenWindows(): boolean {
  return BrowserWindow.getAllWindows().length > 0;
}

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (!hasOpenWindows()) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
