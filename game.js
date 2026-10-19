/**
 * Zuma Deluxe Aztec Clone - Core Game Engine
 * Implements:
 * - Central Stone Frog Idol with 360° rotation & mouth/back gem ball queue
 * - Doubly-linked Marble Chain with Spline path physics
 * - Match-3 Recursive algorithm & Magnetic gap pull
 * - Power-ups: Bomb, Slow-Down, Reverse, Accuracy Beam
 * - Golden Warning Skull with jaw animation and danger triggers
 * - Zuma progression bar, scoring, combo tracking & Realm DB integration
 */

const MARBLE_RADIUS = 19;
const MARBLE_DIAMETER = 38;

const MARBLE_COLORS = [
  { id: 'red', name: 'ياقوت أحمر', hex: '#e61937', light: '#ff6b81', dark: '#6b0010', accent: '#ffe0e6', rune: '♦' },
  { id: 'blue', name: 'ياقوت أزرق', hex: '#0088ff', light: '#70c5ff', dark: '#003380', accent: '#d6f0ff', rune: '▲' },
  { id: 'yellow', name: 'توباز ذهبي', hex: '#ffb300', light: '#ffe66d', dark: '#805500', accent: '#fffadb', rune: '★' },
  { id: 'green', name: 'زمرد أخضر', hex: '#00c853', light: '#69f0ae', dark: '#004d1a', accent: '#e8f5e9', rune: '●' },
  { id: 'purple', name: 'جمشت بنفسجي', hex: '#aa00ff', light: '#e040fb', dark: '#4a0072', accent: '#f3e5f5', rune: '✦' }
];

const POWERUP_TYPES = {
  BOMB: { id: 'bomb', icon: '💣', name: 'كرة التفجير', color: '#ff3300' },
  SLOW: { id: 'slow', icon: '❄️', name: 'كرة الإبطاء', color: '#00f0ff' },
  REVERSE: { id: 'reverse', icon: '⏪', name: 'العودة للخلف', color: '#cc00ff' },
  ACCURACY: { id: 'accuracy', icon: '🎯', name: 'شعاع الدقة', color: '#ffea00' }
};

class ZumaGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Virtual canvas resolution
    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Visual Assets
    this.assets = {
      bg: null,
      frog: null,
      skull: null,
      loaded: false
    };

    // Managers
    this.fx = new ParticleFXManager();
    this.audio = window.zumaAudio;
    this.db = window.dbManager;

    // Game state
    this.stageIndex = 0;
    this.currentPath = STAGE_PATHS[0];
    this.state = 'START_SCREEN'; // START_SCREEN, PLAYING, PAUSED, LEVEL_CLEAR, GAME_OVER, RESPAWNING
    this.score = 0;
    this.lives = 3;
    this.maxCombo = 1;
    this.currentCombo = 0;

    // Load High-Res Visual Assets
    this._loadAssets();


    // Zuma meter
    this.zumaPoints = 0;
    this.zumaTarget = 2400; // Points needed to trigger "ZUMA!"
    this.isZumaReached = false;
    this.isSpawningActive = true;

    // Frog Idol
    this.frog = {
      x: 560,
      y: 390,
      angle: 0,
      currentBall: null,
      nextBall: null,
      radius: 46
    };

    // Projectile
    this.projectile = null; // {x, y, vx, vy, color, powerup, radius}

    // Marble Chain
    this.marbles = []; // Array of Marble objects
    this.trainSpeed = 0.85; // Base normal rolling speed (pixels/frame)
    this.targetSpeed = 0.85;
    this.maxSpawnCount = 70;
    this.spawnedCount = 0;
    this.lastSpawnDist = 0;

    // Active power-up buffs
    this.activeBuffs = {
      slowTimer: 0,
      reverseTimer: 0,
      accuracyTimer: 0
    };

    // Magnetic pull tracking
    this.pullPairs = []; // Pairs of segments pulling together

    // Warning skull
    this.skull = {
      jawOpen: 0, // 0 to 1
      isWarning: false,
      warningTimer: 0
    };

    // Mouse coordinates (scaled to virtual resolution)
    this.mouse = { x: this.width / 2, y: this.height / 2 };

    // High scores cached
    this.highScores = [];

    this._bindEvents();
    this._loadSettingsAndInit();
  }

  async _loadSettingsAndInit() {
    this.settings = await this.db.getSettings();
    this.audio.setVolumes(this.settings.soundVolume, this.settings.musicVolume);
    this.highScores = await this.db.getHighScores(10);
    this.initLevel(0);
    this._startLoop();
  }

  initLevel(stageIdx) {
    this.stageIndex = stageIdx % STAGE_PATHS.length;
    this.currentPath = STAGE_PATHS[this.stageIndex];
    this.frog.x = this.currentPath.frogPos.x;
    this.frog.y = this.currentPath.frogPos.y;

    this.marbles = [];
    this.projectile = null;
    this.pullPairs = [];
    this.isZumaReached = false;
    this.isSpawningActive = true;
    this.zumaPoints = 0;
    this.zumaTarget = 2000 + this.stageIndex * 700;
    this.spawnedCount = 0;
    this.maxSpawnCount = 55 + this.stageIndex * 20;
    this.trainSpeed = 0.85 + this.stageIndex * 0.15;
    this.targetSpeed = this.trainSpeed;
    this.currentCombo = 0;

    // Reset buffs
    this.activeBuffs.slowTimer = 0;
    this.activeBuffs.reverseTimer = 0;
    this.activeBuffs.accuracyTimer = 0;

    // Setup frog ammo
    this.frog.currentBall = this._generateRandomBallColor();
    this.frog.nextBall = this._generateRandomBallColor();

    this.audio.setDangerLevel(0);
    this._updateHUD();
  }

  _generateRandomBallColor(allowPowerup = true) {
    // Only use colors that currently exist in the chain (if chain is nonempty), plus base pool
    const activeColors = new Set();
    for (const m of this.marbles) {
      activeColors.add(m.color.id);
    }

    let palette = MARBLE_COLORS.slice(0, 4 + Math.min(this.stageIndex, 1));
    if (activeColors.size > 0 && Math.random() < 0.75) {
      palette = palette.filter(c => activeColors.has(c.id));
      if (palette.length === 0) palette = MARBLE_COLORS.slice(0, 4);
    }

    const selectedColor = palette[Math.floor(Math.random() * palette.length)];

    // Power-up chance
    let powerup = null;
    if (allowPowerup && Math.random() < 0.08) {
      const pKeys = Object.keys(POWERUP_TYPES);
      powerup = POWERUP_TYPES[pKeys[Math.floor(Math.random() * pKeys.length)]];
    }

    return { color: selectedColor, powerup: powerup };
  }

  _bindEvents() {
    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    });

    // Fire ball on Left Click
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING') return;
      if (e.button === 0) {
        this.fireProjectile();
      } else if (e.button === 2) {
        // Right click: swap ball
        e.preventDefault();
        this.swapBalls();
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Spacebar to swap balls, P to pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'PLAYING') this.swapBalls();
      } else if (e.code === 'KeyP') {
        this.togglePause();
      }
    });

    // Touch controls
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;
      const t = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (t.clientX - rect.left) * (this.width / rect.width);
      this.mouse.y = (t.clientY - rect.top) * (this.height / rect.height);
      this.fireProjectile();
    });
  }

  swapBalls() {
    if (!this.frog.currentBall || !this.frog.nextBall) return;
    const temp = this.frog.currentBall;
    this.frog.currentBall = this.frog.nextBall;
    this.frog.nextBall = temp;
    this.audio.playSwap();
    this.fx.spawnMarbleBurst(this.frog.x, this.frog.y, this.frog.currentBall.color.hex, 6);
  }

  fireProjectile() {
    if (this.projectile || !this.frog.currentBall) return;

    const angle = this.frog.angle;
    // Speed doubles if Accuracy Beam is active
    const speed = this.activeBuffs.accuracyTimer > 0 ? 32 : 18;

    // Launch from tip of frog mouth
    const launchDist = 38;
    const startX = this.frog.x + Math.cos(angle) * launchDist;
    const startY = this.frog.y + Math.sin(angle) * launchDist;

    this.projectile = {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: this.frog.currentBall.color,
      powerup: this.frog.currentBall.powerup,
      radius: MARBLE_RADIUS
    };

    this.audio.playShoot();
    this.fx.spawnMarbleBurst(startX, startY, this.frog.currentBall.color.hex, 8);

    // Queue next ball
    this.frog.currentBall = this.frog.nextBall;
    this.frog.nextBall = this._generateRandomBallColor();
  }

  // Main Loop
  _startLoop() {
    let lastTime = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      this.update(dt);
      this.render();

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    if (this.state !== 'PLAYING') {
      this.fx.update();
      return;
    }

    // 1. Update Frog Rotation
    const dx = this.mouse.x - this.frog.x;
    const dy = this.mouse.y - this.frog.y;
    this.frog.angle = Math.atan2(dy, dx);

    // 2. Update Buff Timers
    if (this.activeBuffs.slowTimer > 0) {
      this.activeBuffs.slowTimer -= dt;
    }
    if (this.activeBuffs.reverseTimer > 0) {
      this.activeBuffs.reverseTimer -= dt;
    }
    if (this.activeBuffs.accuracyTimer > 0) {
      this.activeBuffs.accuracyTimer -= dt;
    }

    // 3. Spawning Marbles at the head of the track
    this._updateSpawning();

    // 4. Update Marble Train Physics & Spacing
    this._updateMarblePhysics(dt);

    // 5. Update Magnetic Pulling between gaps
    this._updateMagneticPull(dt);

    // 6. Update Projectile Physics & Collision
    this._updateProjectile();

    // 7. Check Danger State & Golden Skull Jaw
    this._updateDangerAndSkull();

    // 8. Update Visual FX
    this.fx.update();

    // 9. Check Victory or Defeat
    this._checkWinLossConditions();
  }

  _updateSpawning() {
    if (!this.isSpawningActive) return;

    if (this.spawnedCount >= this.maxSpawnCount) {
      this.isSpawningActive = false;
      return;
    }

    // If train is empty or head has moved past threshold, spawn new marble
    const headMarble = this.marbles[this.marbles.length - 1];
    if (!headMarble || headMarble.distance >= MARBLE_DIAMETER) {
      const newBallData = this._generateRandomBallColor();
      const newMarble = {
        distance: 0,
        color: newBallData.color,
        powerup: newBallData.powerup,
        x: 0,
        y: 0,
        angle: 0,
        pushVelocity: 0, // for impact animations
        id: `m_${Date.now()}_${Math.random()}`
      };
      this.marbles.push(newMarble);
      this.spawnedCount++;
    }
  }

  _updateMarblePhysics(dt) {
    if (this.marbles.length === 0) return;

    // Calculate effective train rolling speed
    let effectiveSpeed = this.trainSpeed;
    if (this.activeBuffs.slowTimer > 0) {
      effectiveSpeed *= 0.4; // 60% reduction
    }
    if (this.activeBuffs.reverseTimer > 0) {
      effectiveSpeed = -this.trainSpeed * 1.8; // Reverse backwards!
    }

    // Apply forward/backward movement to the trailing marble (closest to track start)
    // and push chain forward maintaining minimum spacing
    const firstM = this.marbles[this.marbles.length - 1]; // First spawned is at smallest distance
    if (firstM) {
      firstM.distance = Math.max(0, firstM.distance + effectiveSpeed);
    }

    // Cascade push from head to tail so marbles don't overlap
    // Array order: index 0 is closest to Golden Skull (furthest distance along track)
    // index N-1 is closest to spawn point (smallest distance)
    for (let i = this.marbles.length - 2; i >= 0; i--) {
      const prev = this.marbles[i + 1]; // behind
      const curr = this.marbles[i];     // ahead

      // If behind marble catches up with curr marble, push curr marble forward!
      if (prev.distance + MARBLE_DIAMETER > curr.distance) {
        curr.distance = prev.distance + MARBLE_DIAMETER;
      }
    }

    // Calculate actual 2D coordinates along the spline
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const pt = this.currentPath.getPointAtDistance(m.distance);
      m.x = pt.x;
      m.y = pt.y;
      m.angle = pt.angle;
    }
  }

  _updateMagneticPull(dt) {
    if (this.marbles.length < 2) return;

    // Find gaps between marbles where colors match!
    // If marbles[i] (closer to skull) and marbles[i+1] (behind it) have a gap > MARBLE_DIAMETER
    // AND marbles[i].color.id === marbles[i+1].color.id
    // Then magnetically attract them!
    for (let i = 0; i < this.marbles.length - 1; i++) {
      const front = this.marbles[i];
      const rear = this.marbles[i + 1];
      const gap = front.distance - rear.distance;

      if (gap > MARBLE_DIAMETER + 1) {
        if (front.color.id === rear.color.id) {
          // Magnetic attraction: pull the front segment backwards towards the rear!
          const pullSpeed = 4.2;
          front.distance -= pullSpeed;
          this.audio.playMagneticPull();

          // Spawn magnetic sparkles in the gap
          if (Math.random() < 0.3) {
            const midDist = (front.distance + rear.distance) / 2;
            const pt = this.currentPath.getPointAtDistance(midDist);
            this.fx.spawnMarbleBurst(pt.x, pt.y, front.color.hex, 2);
          }

          // If gap closed
          if (front.distance <= rear.distance + MARBLE_DIAMETER) {
            front.distance = rear.distance + MARBLE_DIAMETER;
            this.audio.playMarbleClack(1.2);

            // Increment combo count and re-evaluate Match-3!
            this.currentCombo++;
            this.maxCombo = Math.max(this.maxCombo, this.currentCombo);
            this._checkMatchAt(i, true);
          }
        }
      }
    }
  }

  _updateProjectile() {
    if (!this.projectile) return;

    const p = this.projectile;
    p.x += p.vx;
    p.y += p.vy;

    // Spawn subtle projectile trail
    if (Math.random() < 0.6) {
      this.fx.particles.push({
        x: p.x,
        y: p.y,
        vx: -p.vx * 0.1,
        vy: -p.vy * 0.1,
        size: 4,
        color: p.color.hex,
        alpha: 0.6,
        decay: 0.08,
        type: 'spark'
      });
    }

    // Check collision against any marble in the chain
    let hitIndex = -1;
    let minDist = MARBLE_DIAMETER;

    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < minDist) {
        minDist = d;
        hitIndex = i;
      }
    }

    if (hitIndex !== -1) {
      // Collision detected! Insert ball into chain
      this._insertProjectileAt(hitIndex, p);
      this.projectile = null;
      return;
    }

    // Check bounds (flew off canvas)
    if (p.x < -50 || p.x > this.width + 50 || p.y < -50 || p.y > this.height + 50) {
      this.projectile = null;
    }
  }

  _insertProjectileAt(targetIndex, proj) {
    const target = this.marbles[targetIndex];

    // Determine whether the hit occurred in front or behind the target along the spline
    const pt = this.currentPath.getPointAtDistance(target.distance);
    const tangent = { x: pt.tangentX, y: pt.tangentY };
    const impactVec = { x: proj.x - target.x, y: proj.y - target.y };
    const dot = impactVec.x * tangent.x + impactVec.y * tangent.y;

    const insertIndex = dot > 0 ? targetIndex : targetIndex + 1;
    const insertDist = dot > 0 ? target.distance + MARBLE_DIAMETER : target.distance - MARBLE_DIAMETER;

    const newMarble = {
      distance: insertDist,
      color: proj.color,
      powerup: proj.powerup,
      x: proj.x,
      y: proj.y,
      angle: target.angle,
      id: `m_${Date.now()}_${Math.random()}`
    };

    this.marbles.splice(insertIndex, 0, newMarble);

    // Push rear marbles to make space
    for (let i = insertIndex + 1; i < this.marbles.length; i++) {
      if (this.marbles[i].distance >= this.marbles[i - 1].distance - MARBLE_DIAMETER) {
        this.marbles[i].distance = this.marbles[i - 1].distance - MARBLE_DIAMETER;
      }
    }

    this.audio.playMarbleClack(1.0);
    this.fx.spawnMarbleBurst(newMarble.x, newMarble.y, newMarble.color.hex, 8);

    // Check Match-3
    this.currentCombo = 1;
    this._checkMatchAt(insertIndex, false);
  }

  _checkMatchAt(centerIndex, isComboTrigger = false) {
    if (centerIndex < 0 || centerIndex >= this.marbles.length) return;

    const targetColor = this.marbles[centerIndex].color.id;

    // Scan backward (towards skull)
    let startIndex = centerIndex;
    while (startIndex > 0 &&
      this.marbles[startIndex - 1].color.id === targetColor &&
      Math.abs(this.marbles[startIndex - 1].distance - this.marbles[startIndex].distance) <= MARBLE_DIAMETER + 2) {
      startIndex--;
    }

    // Scan forward (towards spawn)
    let endIndex = centerIndex;
    while (endIndex < this.marbles.length - 1 &&
      this.marbles[endIndex + 1].color.id === targetColor &&
      Math.abs(this.marbles[endIndex].distance - this.marbles[endIndex + 1].distance) <= MARBLE_DIAMETER + 2) {
      endIndex++;
    }

    const matchCount = endIndex - startIndex + 1;

    if (matchCount >= 3) {
      // Valid Match-3+!
      this._destroyMatchSequence(startIndex, endIndex, isComboTrigger);
    } else {
      if (!isComboTrigger) {
        this.currentCombo = 0; // Reset combo if manual shot didn't match
      }
    }
  }

  _destroyMatchSequence(startIndex, endIndex, isCombo) {
    const count = endIndex - startIndex + 1;
    const comboMult = Math.max(1, this.currentCombo);
    const points = count * 100 * comboMult;
    this.score += points;

    // Zuma Meter Progress
    this.zumaPoints += points;
    if (!this.isZumaReached && this.zumaPoints >= this.zumaTarget) {
      this.isZumaReached = true;
      this.isSpawningActive = false;
      this.audio.playZumaFanfare();
      this.fx.spawnZumaCelebration(this.width / 2, this.height / 2);
      this.fx.addFloatingText(this.width / 2, this.height / 2 - 40, '🌟 ZUMA! 🌟', '#ffd700', 44, true);
    }

    // Sound & FX
    this.audio.playMatchExplode(comboMult);
    this.fx.addTrauma(0.2 + comboMult * 0.1);

    // Collect powerups and spawn bursts
    const matchedMarbles = this.marbles.slice(startIndex, endIndex + 1);
    let avgX = 0, avgY = 0;

    matchedMarbles.forEach(m => {
      avgX += m.x;
      avgY += m.y;
      this.fx.spawnMarbleBurst(m.x, m.y, m.color.hex, 12);

      if (m.powerup) {
        this._activatePowerup(m.powerup, m.x, m.y, startIndex);
      }
    });

    avgX /= count;
    avgY /= count;

    // Floating text
    const text = isCombo ? `كومبو x${comboMult}! +${points}` : `+${points}`;
    this.fx.addFloatingText(avgX, avgY - 20, text, isCombo ? '#00f0ff' : '#ffe66d', 26, isCombo);

    // Remove from array
    this.marbles.splice(startIndex, count);

    // Record stats in DB
    this.db.saveProgress({ addedPopped: count });

    this._updateHUD();
  }

  _activatePowerup(powerup, x, y, atIndex) {
    this.db.saveProgress({ addedPowerUps: 1 });

    switch (powerup.id) {
      case 'bomb':
        this.audio.playBombExplode();
        this.fx.spawnBombExplosion(x, y, 100);
        this.fx.addFloatingText(x, y - 50, '💣 انفجار قنبلة!', '#ff3300', 30, true);

        // Eliminate all adjacent marbles within 110px radius
        const bombRadius = 110;
        for (let i = this.marbles.length - 1; i >= 0; i--) {
          const m = this.marbles[i];
          const dist = Math.hypot(m.x - x, m.y - y);
          if (dist <= bombRadius) {
            this.fx.spawnMarbleBurst(m.x, m.y, m.color.hex, 10);
            this.score += 150;
            this.marbles.splice(i, 1);
          }
        }
        break;

      case 'slow':
        this.audio.playSlowMotion();
        this.activeBuffs.slowTimer = 5.0; // 5 seconds
        this.fx.addFloatingText(x, y - 50, '❄️ إبطاء الزمن!', '#00f0ff', 28, true);
        break;

      case 'reverse':
        this.audio.playReverseWarp();
        this.activeBuffs.reverseTimer = 3.0; // 3 seconds rewind
        this.fx.addFloatingText(x, y - 50, '⏪ ارتداد للخلف!', '#cc00ff', 28, true);
        break;

      case 'accuracy':
        this.audio.playLaserBeam();
        this.activeBuffs.accuracyTimer = 12.0; // 12 seconds
        this.fx.addFloatingText(x, y - 50, '🎯 شعاع الدقة القصوى!', '#ffea00', 28, true);
        break;
    }
  }

  _updateDangerAndSkull() {
    if (this.marbles.length === 0) {
      this.audio.setDangerLevel(0);
      this.skull.isWarning = false;
      this.skull.jawOpen = 0;
      return;
    }

    const leadMarble = this.marbles[0];
    const progressRatio = leadMarble.distance / this.currentPath.totalLength;
    this.audio.setDangerLevel(progressRatio);

    if (progressRatio >= this.currentPath.dangerRatio) {
      // In danger zone!
      this.skull.isWarning = true;
      this.skull.jawOpen = 0.5 + Math.sin(Date.now() * 0.01) * 0.5;

      this.skull.warningTimer += 0.016;
      if (this.skull.warningTimer > 1.2) {
        this.skull.warningTimer = 0;
        this.audio.playWarningSkull();
        this.fx.addTrauma(0.15);
      }
    } else {
      this.skull.isWarning = false;
      this.skull.jawOpen = 0;
      this.skull.warningTimer = 0;
    }
  }

  _checkWinLossConditions() {
    // 1. Defeat: leading marble entered Golden Skull
    if (this.marbles.length > 0 && this.marbles[0].distance >= this.currentPath.totalLength) {
      this._handleBallEaten();
      return;
    }

    // 2. Victory: Zuma reached AND all marbles cleared from the track
    if (this.isZumaReached && this.marbles.length === 0) {
      this._handleLevelVictory();
    }
  }

  _handleBallEaten() {
    this.state = 'RESPAWNING';
    this.audio.playGameOver();
    this.fx.addTrauma(0.8);
    this.lives--;
    this._updateHUD();

    const skullPos = this.currentPath.samples[this.currentPath.samples.length - 1];
    this.fx.spawnBombExplosion(skullPos.x, skullPos.y, 80);

    setTimeout(() => {
      if (this.lives > 0) {
        // Respawn stage
        this.initLevel(this.stageIndex);
        this.state = 'PLAYING';
      } else {
        // Game Over!
        this.handleGameOver();
      }
    }, 1800);
  }

  async _handleLevelVictory() {
    this.state = 'LEVEL_CLEAR';
    this.audio.playVictory();
    this.fx.spawnZumaCelebration(this.width / 2, this.height / 2);

    // Save progress to Realm DB
    await this.db.saveProgress({ unlockedStage: this.stageIndex + 2 });

    const victoryModal = document.getElementById('victoryModal');
    if (victoryModal) {
      document.getElementById('vicScore').textContent = this.score;
      document.getElementById('vicStage').textContent = this.stageIndex + 1;
      document.getElementById('vicMaxCombo').textContent = `x${this.maxCombo}`;
      victoryModal.classList.remove('hidden');
    }
  }

  async handleGameOver() {
    this.state = 'GAME_OVER';
    this.audio.stopWarDrums();

    // Prompt player for HighScore in Realm DB
    const modal = document.getElementById('gameOverModal');
    if (modal) {
      document.getElementById('finalScore').textContent = this.score;
      document.getElementById('finalStage').textContent = this.stageIndex + 1;
      document.getElementById('finalMaxCombo').textContent = `x${this.maxCombo}`;
      modal.classList.remove('hidden');
    }
  }

  async submitHighScore(playerName) {
    await this.db.saveScore({
      playerName: playerName || 'محارب الآزتيك',
      score: this.score,
      stage: this.stageIndex + 1,
      maxCombo: this.maxCombo
    });
    this.highScores = await this.db.getHighScores(10);
    this.renderHighScoresTable();
  }

  renderHighScoresTable() {
    const list = document.getElementById('highScoresList');
    if (!list) return;
    list.innerHTML = '';

    if (this.highScores.length === 0) {
      list.innerHTML = '<div class="empty-state">لا توجد سجلات بعد في قاعدة البيانات.</div>';
      return;
    }

    this.highScores.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      row.innerHTML = `
        <span class="rank-badge">${idx + 1}</span>
        <span class="player-name">${item.playerName}</span>
        <span class="score-val">${item.score.toLocaleString()}</span>
        <span class="stage-val">المرحلة ${item.stage}</span>
        <span class="combo-val">كومبو x${item.maxCombo || 1}</span>
      `;
      list.appendChild(row);
    });
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.audio.stopWarDrums();
      document.getElementById('pauseModal').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.audio.startWarDrums();
      document.getElementById('pauseModal').classList.add('hidden');
    }
  }

  _updateHUD() {
    const scoreEl = document.getElementById('hudScore');
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();

    const stageEl = document.getElementById('hudStage');
    if (stageEl) stageEl.textContent = this.stageIndex + 1;

    const livesEl = document.getElementById('hudLives');
    if (livesEl) {
      let hearts = '';
      for (let i = 0; i < this.lives; i++) hearts += '🐸 ';
      livesEl.textContent = hearts;
    }

    // Zuma progress bar (0% to 100%)
    const zumaFill = document.getElementById('zumaBarFill');
    if (zumaFill) {
      const pct = Math.min(100, Math.floor((this.zumaPoints / this.zumaTarget) * 100));
      zumaFill.style.width = `${pct}%`;
      const label = document.getElementById('zumaBarLabel');
      if (label) label.textContent = this.isZumaReached ? 'ZUMA!' : `${pct}%`;
    }
  }

  _loadAssets() {
    let toLoad = 3;
    const checkDone = () => {
      toLoad--;
      if (toLoad <= 0) {
        this.assets.loaded = true;
        console.log('[Assets] High-Res Aztec Graphics Loaded & Processed.');
      }
    };

    // 1. Temple Background
    const imgBg = new Image();
    imgBg.src = 'assets/bg_temple.jpg';
    imgBg.onload = () => {
      this.assets.bg = imgBg;
      checkDone();
    };
    imgBg.onerror = () => checkDone();

    // 2. Stone Frog Idol (Jade + Gold)
    const imgFrog = new Image();
    imgFrog.src = 'assets/frog_idol.jpg';
    imgFrog.onload = () => {
      this.assets.frog = this._removeBlackBackground(imgFrog, 20);
      checkDone();
    };
    imgFrog.onerror = () => checkDone();

    // 3. Golden Skull Gate
    const imgSkull = new Image();
    imgSkull.src = 'assets/golden_skull.jpg';
    imgSkull.onload = () => {
      this.assets.skull = this._removeBlackBackground(imgSkull, 20);
      checkDone();
    };
    imgSkull.onerror = () => checkDone();
  }

  // Chroma key helper to turn black background into clean transparent alpha
  _removeBlackBackground(img, threshold = 20) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const maxVal = Math.max(r, g, b);
      if (maxVal < threshold) {
        d[i + 3] = 0;
      } else if (maxVal < threshold + 30) {
        d[i + 3] = Math.floor(((maxVal - threshold) / 30) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // -------------------------------------------------------------
  // RENDERING PIPELINE
  // -------------------------------------------------------------
  render() {
    const ctx = this.ctx;

    // Apply Screen Shake
    const shake = this.fx.getScreenShake();
    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.rotate(shake.angle);

    // 1. Draw Aztec Temple Background
    this._drawBackground(ctx);

    // 2. Draw Spline Track / Stone Trench
    this.currentPath.drawTrack(ctx);

    // 3. Draw Golden Skull Gate at Terminus
    this._drawGoldenSkull(ctx);

    // 4. Draw Rolling Marbles
    this._drawMarbles(ctx);

    // 5. Draw Aiming Laser (if Accuracy buff active or in settings)
    this._drawAimingGuide(ctx);

    // 6. Draw Projectile
    this._drawProjectile(ctx);

    // 7. Draw Central Stone Frog Idol
    this._drawFrogIdol(ctx);

    // 8. Render Particles & Floating Texts
    this.fx.render(ctx);

    ctx.restore();
  }

  _drawBackground(ctx) {
    if (this.assets.bg) {
      // High-resolution realistic temple stone floor
      ctx.drawImage(this.assets.bg, 0, 0, this.width, this.height);

      // Subtle atmospheric vignette & dark ambient overlay
      const vig = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 200,
        this.width / 2, this.height / 2, 800
      );
      vig.addColorStop(0, 'rgba(0,0,0,0.15)');
      vig.addColorStop(1, 'rgba(5, 3, 2, 0.75)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Procedural fallback
      const grad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 80,
        this.width / 2, this.height / 2, 850
      );
      grad.addColorStop(0, '#24170d');
      grad.addColorStop(0.5, '#150d07');
      grad.addColorStop(1, '#080503');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Mystical Aztec glyph rings around frog clearing
    ctx.save();
    const pulse = Math.sin(Date.now() * 0.002) * 0.05 + 0.25;
    ctx.beginPath();
    ctx.arc(this.frog.x, this.frog.y, 82, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212, 175, 55, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.frog.x, this.frog.y, 108, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212, 175, 55, ${pulse * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.restore();
  }

  _drawGoldenSkull(ctx) {
    const samples = this.currentPath.samples;
    const endPt = samples[samples.length - 1];
    ctx.save();
    ctx.translate(endPt.x, endPt.y);
    ctx.rotate(this.currentPath.skullAngle + Math.PI / 2); // Align forward

    const isDanger = this.skull.isWarning;

    // Danger glow pulse
    if (isDanger) {
      const dangerPulse = 20 + Math.sin(Date.now() * 0.02) * 15;
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = dangerPulse;

      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 40, 0.25)';
      ctx.fill();
    } else {
      ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
      ctx.shadowBlur = 12;
    }

    if (this.assets.skull) {
      // High-res Aztec Golden Skull
      const size = 96;
      const shakeOffset = isDanger ? (Math.random() - 0.5) * 3 : 0;
      ctx.drawImage(this.assets.skull, -size / 2 + shakeOffset, -size / 2, size, size);

      // Glowing Ruby Eyes
      const eyeGlow = isDanger ? '#ff0044' : '#ffaa00';
      ctx.fillStyle = eyeGlow;
      ctx.shadowColor = eyeGlow;
      ctx.shadowBlur = isDanger ? 20 : 10;
      ctx.beginPath();
      ctx.arc(-13, -10, isDanger ? 6 : 4, 0, Math.PI * 2);
      ctx.arc(13, -10, isDanger ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Procedural Golden Skull Fallback
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#b8860b';
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.stroke();

      const jawY = this.skull.jawOpen * 14;
      ctx.beginPath();
      ctx.ellipse(0, 8 + jawY, 20, 16 + jawY, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0000';
      ctx.fill();

      const eyeColor = isDanger ? '#ff0033' : '#ffd700';
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(-11, -10, 6, 0, Math.PI * 2);
      ctx.arc(11, -10, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawMarbles(ctx) {
    for (const m of this.marbles) {
      // Roll angle directly proportional to path distance traveled
      const rollAngle = m.distance / MARBLE_RADIUS;
      this._renderSingleMarble(ctx, m.x, m.y, m.color, m.powerup, rollAngle);
    }
  }

  _renderSingleMarble(ctx, x, y, color, powerup = null, rollAngle = 0) {
    const R = MARBLE_RADIUS;
    ctx.save();
    ctx.translate(x, y);

    // 1. Ambient Drop Shadow on Track
    ctx.beginPath();
    ctx.arc(2.5, 3.5, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 2. Specialized Rendering for Power-Up Marbles (matching reference image)
    if (powerup && powerup.id === 'bomb') {
      this._renderBombMarble(ctx, R);
      ctx.restore();
      return;
    } else if (powerup && powerup.id === 'reverse') {
      this._renderReverseMarble(ctx, R, rollAngle);
      ctx.restore();
      return;
    } else if (powerup && powerup.id === 'slow') {
      this._renderSlowMarble(ctx, R, rollAngle);
      ctx.restore();
      return;
    } else if (powerup && powerup.id === 'accuracy') {
      this._renderAccuracyMarble(ctx, R, rollAngle);
      ctx.restore();
      return;
    }

    // 3. Regular Crystal Aztec Marbles (Red, Blue, Green, Yellow, Purple)
    // Spherical Clipping boundary for 3D realism
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    // A. Base 3D Spherical Diffuse Gradient (illuminated from upper-left)
    const baseGrad = ctx.createRadialGradient(
      -R * 0.35, -R * 0.35, 1,
      0, 0, R
    );
    baseGrad.addColorStop(0, '#ffffff');
    baseGrad.addColorStop(0.18, color.light);
    baseGrad.addColorStop(0.65, color.hex);
    baseGrad.addColorStop(1, color.dark);

    ctx.fillStyle = baseGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // B. Aztec Carved Relief Spiral Pattern (matches reference image)
    // Rotates as the marble rolls along the path!
    ctx.save();
    ctx.rotate(rollAngle);

    // Debossed Dark Groove (shadow offset down-right)
    ctx.save();
    ctx.translate(1.0, 1.0);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    this._renderAztecSpiralPattern(ctx, R);
    ctx.restore();

    // Embossed Bright Highlight (accent offset up-left)
    ctx.save();
    ctx.translate(-0.5, -0.5);
    ctx.strokeStyle = color.accent || '#ffffff';
    ctx.fillStyle = color.accent || '#ffffff';
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    this._renderAztecSpiralPattern(ctx, R);
    ctx.restore();

    ctx.restore(); // end rotate

    // C. Translucent Subsurface Caustic Reflection (lower-right glow)
    const causticGrad = ctx.createRadialGradient(
      R * 0.35, R * 0.35, 1,
      R * 0.35, R * 0.35, R * 0.7
    );
    causticGrad.addColorStop(0, color.light);
    causticGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    causticGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = causticGrad;
    ctx.beginPath();
    ctx.arc(R * 0.25, R * 0.25, R * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // D. Outer Perimeter 3D Glass Vignette
    const rimGrad = ctx.createRadialGradient(0, 0, R * 0.75, 0, 0, R);
    rimGrad.addColorStop(0, 'transparent');
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // E. Primary Glossy Specular Glare (curved high-shine reflection)
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.38, R * 0.42, R * 0.22, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    // Secondary tiny pinpoint reflection
    ctx.beginPath();
    ctx.arc(R * 0.32, R * 0.32, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.restore(); // end clip

    // Golden / Crystal Bevel Outline
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  // Draw the intricate bold Aztec spiral pattern with concentric rings & notched glyphs
  _renderAztecSpiralPattern(ctx, R) {
    // 1. Center Aztec Eye / Sun Core Dot
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Bold Archimedean Spiral Arm (winds across the sphere)
    ctx.beginPath();
    const a = 1.35;
    for (let th = 0.5; th <= Math.PI * 3.8; th += 0.12) {
      const r = a * th;
      const px = Math.cos(th) * r;
      const py = Math.sin(th) * r;
      if (th === 0.5) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 3. Middle Concentric Aztec Arc Ring
    const midR = R * 0.52;
    ctx.beginPath();
    ctx.arc(0, 0, midR, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Outer Concentric Ring with 6 Bold Carved Aztec Teeth
    const outerR = R * 0.78;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // 6 prominent carved teeth/notches around the perimeter
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const r1 = outerR - 3.5;
      const r2 = outerR + 3.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.stroke();
    }
  }

  // Authentic Black Iron Cannonball Bomb (matching reference image)
  _renderBombMarble(ctx, R) {
    ctx.save();
    // Sphere Clip
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    // Cast Iron Spherical Gradient
    const bombGrad = ctx.createRadialGradient(-R * 0.35, -R * 0.35, 1, 0, 0, R);
    bombGrad.addColorStop(0, '#555555');
    bombGrad.addColorStop(0.3, '#222222');
    bombGrad.addColorStop(0.8, '#111111');
    bombGrad.addColorStop(1, '#050505');
    ctx.fillStyle = bombGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Glowing Aztec Skull / Explosion Icon in center
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ff3300';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 15px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', 0, 2);

    // Specular Glare on iron
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.38, R * 0.38, R * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    ctx.restore();

    // Brass Fuse Collar at top
    ctx.beginPath();
    ctx.arc(0, -R + 2, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#d4af37';
    ctx.fill();

    // Burning Sparking Fuse Tip
    const sparkTime = Date.now() * 0.01;
    const sparkX = Math.sin(sparkTime) * 2;
    const sparkY = -R - 5;

    ctx.beginPath();
    ctx.moveTo(0, -R + 2);
    ctx.quadraticCurveTo(sparkX * 2, -R - 2, sparkX, sparkY);
    ctx.strokeStyle = '#8a6d1c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Burning Flame Sparks
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 3.5 + Math.sin(sparkTime * 3) * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffea00';
    ctx.shadowColor = '#ff3300';
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.restore();
  }

  // Reverse Powerup (Double Golden Rewind Arrows matching reference image)
  _renderReverseMarble(ctx, R, rollAngle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    const revGrad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    revGrad.addColorStop(0, '#60a5fa');
    revGrad.addColorStop(0.3, '#1d4ed8');
    revGrad.addColorStop(0.8, '#1e1b4b');
    revGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = revGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Glowing Golden Double Rewind Arrows
    ctx.save();
    ctx.rotate(rollAngle * 0.5);
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 18px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↺', 0, 0);
    ctx.restore();

    // Specular Glare
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.38, R * 0.4, R * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.restore();

    // Outer Energy Ring
    ctx.beginPath();
    ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.stroke();

    ctx.restore();
  }

  // Slow-Down Powerup (Crystalline Ice Snowflake matching reference image)
  _renderSlowMarble(ctx, R, rollAngle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    const slowGrad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    slowGrad.addColorStop(0, '#ffffff');
    slowGrad.addColorStop(0.2, '#67e8f9');
    slowGrad.addColorStop(0.7, '#0891b2');
    slowGrad.addColorStop(1, '#164e63');
    ctx.fillStyle = slowGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // 6-Pointed Frost Star
    ctx.save();
    ctx.rotate(rollAngle * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 17px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❄', 0, 0);
    ctx.restore();

    // Specular Glare
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.38, R * 0.4, R * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    ctx.restore();

    // Frost Aura
    ctx.beginPath();
    ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.restore();
  }

  // Accuracy Beam Powerup (Brilliant Golden Starburst)
  _renderAccuracyMarble(ctx, R, rollAngle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    const accGrad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    accGrad.addColorStop(0, '#ffffff');
    accGrad.addColorStop(0.25, '#fde047');
    accGrad.addColorStop(0.7, '#ca8a04');
    accGrad.addColorStop(1, '#713f12');
    ctx.fillStyle = accGrad;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Brilliant Crosshair / Diamond Star
    ctx.save();
    ctx.rotate(rollAngle * 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 17px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', 0, 0);
    ctx.restore();

    // Specular Glare
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.38, R * 0.4, R * 0.2, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    ctx.restore();

    // Golden Radiant Aura
    ctx.beginPath();
    ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.restore();
  }

  _drawAimingGuide(ctx) {
    const isLaserBuff = this.activeBuffs.accuracyTimer > 0;
    const isGuideEnabled = this.settings && this.settings.laserAimGuide;

    if (!isLaserBuff && !isGuideEnabled) return;

    ctx.save();
    const angle = this.frog.angle;
    const startX = this.frog.x + Math.cos(angle) * 54;
    const startY = this.frog.y + Math.sin(angle) * 54;

    const maxLaserLen = isLaserBuff ? 800 : 280;
    const endX = startX + Math.cos(angle) * maxLaserLen;
    const endY = startY + Math.sin(angle) * maxLaserLen;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);

    if (isLaserBuff) {
      // Intense Laser Beam with energy pulses
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffea00';
      ctx.shadowBlur = 18;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Laser Target Crosshair
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Subtle dashed aiming line with animated dash offset
      ctx.strokeStyle = 'rgba(255, 230, 140, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -Date.now() * 0.02;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawProjectile(ctx) {
    if (!this.projectile) return;
    this._renderSingleMarble(
      ctx,
      this.projectile.x,
      this.projectile.y,
      this.projectile.color,
      this.projectile.powerup
    );
  }

  _drawFrogIdol(ctx) {
    const frog = this.frog;
    ctx.save();
    ctx.translate(frog.x, frog.y);
    ctx.rotate(frog.angle);

    // 1. Soft Ambient Shadow Under Frog
    ctx.beginPath();
    ctx.ellipse(4, 6, 54, 48, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 16;
    ctx.fill();

    // 2. Aztec Sun Disk Pedestal
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.strokeStyle = '#8a6d1c';
    ctx.lineWidth = 4;
    ctx.stroke();

    if (this.assets.frog) {
      // High-Resolution Aztec Jade Stone Frog Idol
      // Note: The sprite faces right natively, exactly matching angle = 0!
      const size = 120;
      ctx.drawImage(this.assets.frog, -size / 2, -size / 2, size, size);

      // Glowing Jade Amber Eyes
      const eyePulse = 0.8 + Math.sin(Date.now() * 0.004) * 0.2;
      ctx.fillStyle = `rgba(255, 215, 0, ${eyePulse})`;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(14, -20, 5, 0, Math.PI * 2);
      ctx.arc(14, 20, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Procedural Frog Fallback
      const frogGrad = ctx.createRadialGradient(-6, -6, 10, 0, 0, frog.radius);
      frogGrad.addColorStop(0, '#38b000');
      frogGrad.addColorStop(0.7, '#007200');
      frogGrad.addColorStop(1, '#004b23');

      ctx.beginPath();
      ctx.ellipse(0, 0, frog.radius, frog.radius - 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = frogGrad;
      ctx.fill();
      ctx.strokeStyle = '#2d6a4f';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(12, -24, 10, 0, Math.PI * 2);
      ctx.arc(12, 24, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Current Ball Ready in Frog's Open Mouth
    if (frog.currentBall) {
      // Place right inside the open mouth jaw
      this._renderSingleMarble(ctx, 42, 0, frog.currentBall.color, frog.currentBall.powerup);
    }

    // 4. Reserve Ball on Frog's Back Jewel Socket
    if (frog.nextBall) {
      // Golden socket ring on back
      ctx.beginPath();
      ctx.arc(-24, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1006';
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Slightly scaled reserve ball
      ctx.save();
      ctx.translate(-24, 0);
      ctx.scale(0.8, 0.8);
      this._renderSingleMarble(ctx, 0, 0, frog.nextBall.color, frog.nextBall.powerup);
      ctx.restore();
    }

    ctx.restore();
  }
}

window.ZumaGame = ZumaGame;

