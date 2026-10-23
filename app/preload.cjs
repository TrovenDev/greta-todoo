const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('troven', {
  call: (action, payload) => ipcRenderer.invoke('troven', action, payload),
  onChange: callback => { ipcRenderer.on('changed', (_,data)=>callback(data)); },
  onUpdate: callback => { ipcRenderer.on('update', (_,data)=>callback(data)); }
});
