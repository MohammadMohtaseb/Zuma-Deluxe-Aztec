const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  realm: {
    saveScore: (scoreData) => ipcRenderer.invoke('realm:saveScore', scoreData),
    getHighScores: (limit = 10) => ipcRenderer.invoke('realm:getHighScores', limit),
    getProgress: () => ipcRenderer.invoke('realm:getProgress'),
    saveProgress: (progressData) => ipcRenderer.invoke('realm:saveProgress', progressData),
    getSettings: () => ipcRenderer.invoke('realm:getSettings'),
    saveSettings: (settingsData) => ipcRenderer.invoke('realm:saveSettings', settingsData),
    clearDatabase: () => ipcRenderer.invoke('realm:clearDatabase')
  }
});
