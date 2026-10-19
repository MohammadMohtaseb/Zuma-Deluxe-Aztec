/**
 * Realm DB Client & Storage Layer
 * Supports Electron Native Realm DB IPC Bridge with seamless browser IndexedDB/LocalStorage fallback.
 * Strictly adheres to Realm Object Schema.
 */

class RealmDBManager {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.electronAPI && window.electronAPI.realm;
    this.storageKeyScores = 'zuma_realm_scores';
    this.storageKeyProgress = 'zuma_realm_progress';
    this.storageKeySettings = 'zuma_realm_settings';
    this.mode = this.isElectron ? 'Electron Native Realm DB' : 'Realm Web / Local Storage Engine';
    console.log(`[Database] Initialized in ${this.mode} mode.`);
  }

  // Schema verification helpers
  validateScore(data) {
    return {
      id: data.id || `score_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      playerName: String(data.playerName || 'بطل الآزتيك'),
      score: parseInt(data.score, 10) || 0,
      stage: parseInt(data.stage, 10) || 1,
      maxCombo: parseInt(data.maxCombo, 10) || 1,
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
    };
  }

  async saveScore(record) {
    const valid = this.validateScore(record);
    if (this.isElectron) {
      try {
        const res = await window.electronAPI.realm.saveScore(valid);
        return res;
      } catch (e) {
        console.warn('[Realm IPC error, falling back]:', e);
      }
    }
    // Local / Browser fallback
    const scores = this._getLocalScores();
    scores.push(valid);
    scores.sort((a, b) => b.score - a.score);
    // keep top 50
    if (scores.length > 50) scores.length = 50;
    localStorage.setItem(this.storageKeyScores, JSON.stringify(scores));
    return { success: true, record: valid, engine: 'realm-local' };
  }

  async getHighScores(limit = 10) {
    if (this.isElectron) {
      try {
        const scores = await window.electronAPI.realm.getHighScores(limit);
        if (scores && scores.length > 0) return scores;
      } catch (e) {
        console.warn('[Realm IPC error, falling back]:', e);
      }
    }
    const scores = this._getLocalScores();
    return scores.slice(0, limit);
  }

  async getProgress() {
    if (this.isElectron) {
      try {
        const prog = await window.electronAPI.realm.getProgress();
        if (prog) return prog;
      } catch (e) {
        console.warn(e);
      }
    }
    const raw = localStorage.getItem(this.storageKeyProgress);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return {
      unlockedStage: 1,
      totalMarblesPopped: 0,
      powerUpsUsed: 0,
      lastPlayed: new Date().toISOString()
    };
  }

  async saveProgress(data) {
    const current = await this.getProgress();
    const updated = {
      unlockedStage: Math.max(current.unlockedStage, data.unlockedStage || 1),
      totalMarblesPopped: (current.totalMarblesPopped || 0) + (data.addedPopped || 0),
      powerUpsUsed: (current.powerUpsUsed || 0) + (data.addedPowerUps || 0),
      lastPlayed: new Date().toISOString()
    };

    if (this.isElectron) {
      try {
        await window.electronAPI.realm.saveProgress(updated);
      } catch (e) {}
    }
    localStorage.setItem(this.storageKeyProgress, JSON.stringify(updated));
    return updated;
  }

  async getSettings() {
    if (this.isElectron) {
      try {
        const s = await window.electronAPI.realm.getSettings();
        if (s) return s;
      } catch (e) {}
    }
    const raw = localStorage.getItem(this.storageKeySettings);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return {
      soundVolume: 0.8,
      musicVolume: 0.5,
      laserAimGuide: true,
      screenShake: true,
      language: 'ar'
    };
  }

  async saveSettings(settings) {
    if (this.isElectron) {
      try {
        await window.electronAPI.realm.saveSettings(settings);
      } catch (e) {}
    }
    localStorage.setItem(this.storageKeySettings, JSON.stringify(settings));
    return settings;
  }

  async clearAll() {
    if (this.isElectron) {
      try {
        await window.electronAPI.realm.clearDatabase();
      } catch (e) {}
    }
    localStorage.removeItem(this.storageKeyScores);
    localStorage.removeItem(this.storageKeyProgress);
    return true;
  }

  _getLocalScores() {
    const raw = localStorage.getItem(this.storageKeyScores);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      } catch (e) {}
    }
    // Default initial Aztec Highscores
    const defaults = [
      { id: 'sc_init_1', playerName: 'Montezuma', score: 15400, stage: 3, maxCombo: 5, createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 'sc_init_2', playerName: 'Quetzal', score: 12200, stage: 2, maxCombo: 4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'sc_init_3', playerName: 'Jaguar Warrior', score: 8900, stage: 2, maxCombo: 3, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'sc_init_4', playerName: 'Sun Priest', score: 5500, stage: 1, maxCombo: 2, createdAt: new Date().toISOString() }
    ];
    localStorage.setItem(this.storageKeyScores, JSON.stringify(defaults));
    return defaults;
  }
}

// Global instance
window.dbManager = new RealmDBManager();
