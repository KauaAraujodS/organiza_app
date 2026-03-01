/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("organizaDesktop", {
  openDriveFile: (payload) => ipcRenderer.invoke("drive:open-file", payload),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
});
