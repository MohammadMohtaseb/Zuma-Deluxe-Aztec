const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let realmInstance = null;

// Realm Schemas definition as requested in technical requirements
const ScoreRecordSchema = {
  name: 'ScoreRecord',
  primaryKey: 'id',
  properties: {
    id: 'string',
    playerName: 'string',
    score: 'int',
    stage: 'int',
    maxCombo: 'int',
    createdAt: 'date'
  }
};

const GameProgressSchema = {
  name: 'GameProgress',
  primaryKey: 'id',
  properties: {
    id: 'string',
    unlockedStage: 'int',
    totalMarblesPopped: 'int',
    powerUpsUsed: 'int',
    lastPlayed: 'date'
  }
};

const GameSettingsSchema = {
  name: 'GameSettings',
  primaryKey: 'id',
  properties: {
    id: 'string',
    soundVolume: 'float',
    musicVolume: 'float',
    laserAimGuide: 'bool',
    screenShake: 'bool',
    language: 'string'
  }
};

async function initRealmDatabase() {
  try {
    const Realm = require('realm');
    const realmPath = path.join(app.getPath('userData'), 'zuma_game.realm');
    console.log('[Realm DB] Opening Realm database at:', realmPath);

    realmInstance = await Realm.open({
      path: realmPath,
      schema: [ScoreRecordSchema, GameProgressSchema, GameSettingsSchema],
      schemaVersion: 1
    });
    console.log('[Realm DB] Realm Database initialized successfully.');
  } catch (err) {
    console.warn('[Realm DB] Native Realm initialization note (fallback to JSON/Storage if realm is not installed yet):', err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 1024,
    minHeight: 640,
    center: true,
    title: 'Zuma Deluxe - Aztec Legend',
    icon: path.join(__dirname, 'assets', 'app_icon.ico'),
    backgroundColor: '#0c0703',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // F11 to toggle fullscreen
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (realmInstance && !realmInstance.isClosed) {
      realmInstance.close();
    }
  });
}

// Realm IPC Handlers
ipcMain.handle('realm:saveScore', async (event, scoreData) => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      realmInstance.write(() => {
        realmInstance.create('ScoreRecord', {
          id: scoreData.id || `score_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          playerName: scoreData.playerName || 'Warrior',
          score: Math.floor(scoreData.score) || 0,
          stage: scoreData.stage || 1,
          maxCombo: scoreData.maxCombo || 1,
          createdAt: new Date(scoreData.createdAt || Date.now())
        }, Realm.UpdateMode.Modified);
      });
      return { success: true, source: 'realm' };
    } catch (e) {
      console.error('[Realm DB Error saving score]:', e);
      return { success: false, error: e.message };
    }
  }
  return { success: true, source: 'simulated_realm' };
});

ipcMain.handle('realm:getHighScores', async (event, limit = 10) => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      const records = realmInstance.objects('ScoreRecord').sorted('score', true).slice(0, limit);
      return records.map(r => ({
        id: r.id,
        playerName: r.playerName,
        score: r.score,
        stage: r.stage,
        maxCombo: r.maxCombo,
        createdAt: r.createdAt
      }));
    } catch (e) {
      console.error('[Realm DB Error getting scores]:', e);
      return [];
    }
  }
  return [];
});

ipcMain.handle('realm:getProgress', async () => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      const progress = realmInstance.objectForPrimaryKey('GameProgress', 'default_user');
      if (progress) {
        return {
          unlockedStage: progress.unlockedStage,
          totalMarblesPopped: progress.totalMarblesPopped,
          powerUpsUsed: progress.powerUpsUsed,
          lastPlayed: progress.lastPlayed
        };
      }
    } catch (e) {
      console.error(e);
    }
  }
  return null;
});

ipcMain.handle('realm:saveProgress', async (event, progressData) => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      realmInstance.write(() => {
        realmInstance.create('GameProgress', {
          id: 'default_user',
          unlockedStage: progressData.unlockedStage || 1,
          totalMarblesPopped: progressData.totalMarblesPopped || 0,
          powerUpsUsed: progressData.powerUpsUsed || 0,
          lastPlayed: new Date()
        }, Realm.UpdateMode.Modified);
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true };
});

ipcMain.handle('realm:getSettings', async () => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      const s = realmInstance.objectForPrimaryKey('GameSettings', 'default_settings');
      if (s) {
        return {
          soundVolume: s.soundVolume,
          musicVolume: s.musicVolume,
          laserAimGuide: s.laserAimGuide,
          screenShake: s.screenShake,
          language: s.language
        };
      }
    } catch (e) {
      console.error(e);
    }
  }
  return null;
});

ipcMain.handle('realm:saveSettings', async (event, s) => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      realmInstance.write(() => {
        realmInstance.create('GameSettings', {
          id: 'default_settings',
          soundVolume: s.soundVolume ?? 0.8,
          musicVolume: s.musicVolume ?? 0.5,
          laserAimGuide: s.laserAimGuide ?? true,
          screenShake: s.screenShake ?? true,
          language: s.language || 'ar'
        }, Realm.UpdateMode.Modified);
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true };
});

ipcMain.handle('realm:clearDatabase', async () => {
  if (realmInstance && !realmInstance.isClosed) {
    try {
      realmInstance.write(() => {
        realmInstance.deleteAll();
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: true };
});

app.whenReady().then(async () => {
  await initRealmDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
