// eslint-disable-next-line no-unused-vars
import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld(
  'api', {
    request: (channel, data) => {
      // whitelist channels
      const validChannels = ['toMain'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    response: (channel, func) => {
      const validChannels = [
        'store-data', 'exportGP5', 'saveFile', 'saveFileAs', 'revert', 'restore', 'newFile', 'saved',
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
