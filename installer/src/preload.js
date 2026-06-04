const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  checkRequirements: () => ipcRenderer.invoke('check-requirements'),
  install: (apiKey) => ipcRenderer.invoke('install', apiKey),
})
