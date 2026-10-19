/**
 * Particle and Visual FX System for Zuma Deluxe
 * Handles crystal debris, spark rings, explosion bursts, floating floating texts, and screen shake trauma.
 */

class ParticleFXManager {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeTrauma = 0; // 0 to 1
    this.shakeMaxOffset = 18;
    this.shakeMaxAngle = 0.05; // radians
  }

  // Trigger Screen Shake (trauma from 0 to 1)
  addTrauma(amount = 0.4) {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  getScreenShake() {
    if (this.shakeTrauma <= 0.001) {
      return { x: 0, y: 0, angle: 0 };
    }
    // Shake is proportional to trauma squared for natural feel
    const shake = this.shakeTrauma * this.shakeTrauma;
    const offsetX = (Math.random() * 2 - 1) * this.shakeMaxOffset * shake;
    const offsetY = (Math.random() * 2 - 1) * this.shakeMaxOffset * shake;
    const angle = (Math.random() * 2 - 1) * this.shakeMaxAngle * shake;

    // Decay trauma smoothly
    this.shakeTrauma = Math.max(0, this.shakeTrauma - 0.035);

    return { x: offsetX, y: offsetY, angle: angle };
  }

  // Spawn crystal shards on marble burst
  spawnMarbleBurst(x, y, colorHex, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      const size = 3 + Math.random() * 6;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        color: colorHex,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        type: 'crystal'
      });
    }

    // Expanding shockwave ring
    this.particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      radius: 8,
      maxRadius: 45,
      color: colorHex,
      alpha: 0.9,
      decay: 0.05,
      type: 'ring'
    });
  }

  // Bomb powerup explosion
  spawnBombExplosion(x, y, radius = 90) {
    this.addTrauma(0.7);

    // Blast rings
    for (let r = 0; r < 3; r++) {
      this.particles.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        radius: 10 + r * 15,
        maxRadius: radius + r * 20,
        color: r === 0 ? '#ffea00' : (r === 1 ? '#ff5500' : '#ff0055'),
        alpha: 1.0,
        decay: 0.04,
        type: 'ring'
      });
    }

    // Fiery embers & smoke
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 10;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 8,
        color: Math.random() > 0.5 ? '#ffcc00' : (Math.random() > 0.5 ? '#ff4400' : '#ffffff'),
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.03,
        rotation: 0,
        rotSpeed: 0,
        type: 'flame'
      });
    }
  }

  // Floating score or combo message
  addFloatingText(x, y, text, color = '#ffd700', size = 26, isCombo = false) {
    this.floatingTexts.push({
      x: x,
      y: y,
      vy: -1.6,
      text: text,
      color: color,
      alpha: 1.0,
      decay: 0.016,
      scale: isCombo ? 1.4 : 1.0,
      isCombo: isCombo
    });
  }

  // Golden Zuma particles shower
  spawnZumaCelebration(cx, cy) {
    this.addTrauma(0.5);
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 7,
        color: Math.random() > 0.5 ? '#ffd700' : '#fff380',
        alpha: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        rotation: 0,
        rotSpeed: 0.1,
        type: 'spark'
      });
    }
  }

  update() {
    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.rotation !== undefined && p.rotSpeed) {
        p.rotation += p.rotSpeed;
      }
      if (p.type === 'ring') {
        p.radius += (p.maxRadius - p.radius) * 0.2 + 1;
      }
      if (p.type === 'flame') {
        p.size *= 0.96;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= ft.decay;
      if (ft.isCombo) {
        ft.scale = Math.max(1.0, ft.scale * 0.98);
      }
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();

    // Draw Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
      } else if (p.type === 'flame') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
      } else {
        // Shard / Crystal / Spark
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    // Draw Floating Texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.save();
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.font = ft.isCombo ? 'bold 30px "Tajawal", "Segoe UI", sans-serif' : 'bold 22px "Tajawal", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text stroke for readability
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, 0, 0);

      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 14;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }
}

window.ParticleFXManager = ParticleFXManager;
