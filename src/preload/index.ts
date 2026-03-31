import { contextBridge } from 'electron';
import type { ClaudeAppApi } from '../shared/electron-api';

const claudeAppApi: ClaudeAppApi = {
  appVersion: process.versions.electron,
};

contextBridge.exposeInMainWorld('claudeApp', claudeAppApi);
