export interface LinksBridge {
  openExternal: (url: string) => Promise<void>;
}

export const LINKS_CHANNELS: {
  openExternal: string;
} = {
  openExternal: 'links:open-external',
};
