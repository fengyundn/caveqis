const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("CaveqisDesktop", {
  setWindowOptions(behavior, language) {
    return ipcRenderer.invoke("caveqis:window-options", behavior, language);
  },
});
