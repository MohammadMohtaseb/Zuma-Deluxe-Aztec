/**
 * 2D Spline Path System for Zuma Deluxe
 * Arc-Length Parameterization with Equidistant Distance Lookups
 */

class SplinePath {
  constructor(name, description, controlPoints, frogPos, skullAngle = 0) {
    this.name = name;
    this.description = description;
    this.controlPoints = controlPoints;
    this.frogPos = frogPos; // {x, y}
    this.skullAngle = skullAngle;

    this.samples = []; // Array of {x, y, distance, tangentX, tangentY, angle}
    this.totalLength = 0;
    this.dangerRatio = 0.82; // 82% along the path triggers warning skull

    this._generateEquidistantSamples();
  }

  // Precompute equidistant arc-length points
  _generateEquidistantSamples() {
    const rawPoints = [];
    const pts = this.controlPoints;

    // Use Catmull-Rom interpolation through control points
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i === 0 ? pts[0] : pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

      const steps = 60; // Fine resolution
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const pt = this._catmullRom(p0, p1, p2, p3, t);
        rawPoints.push(pt);
      }
    }
    rawPoints.push(pts[pts.length - 1]);

    // Compute cumulative distances
    this.samples = [];
    let cumDist = 0;
    this.samples.push({
      x: rawPoints[0].x,
      y: rawPoints[0].y,
      distance: 0,
      tangentX: 1,
      tangentY: 0,
      angle: 0
    });

    for (let i = 1; i < rawPoints.length; i++) {
      const prev = rawPoints[i - 1];
      const curr = rawPoints[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segLen = Math.hypot(dx, dy);

      if (segLen > 0.001) {
        cumDist += segLen;
        const angle = Math.atan2(dy, dx);
        this.samples.push({
          x: curr.x,
          y: curr.y,
          distance: cumDist,
          tangentX: dx / segLen,
          tangentY: dy / segLen,
          angle: angle
        });
      }
    }

    this.totalLength = cumDist;
  }

  _catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    const f0 = -0.5 * t3 + t2 - 0.5 * t;
    const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const f3 = 0.5 * t3 - 0.5 * t2;

    return {
      x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
      y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3
    };
  }

  // Lookup point by arc-length distance in pixels
  getPointAtDistance(d) {
    if (d <= 0) {
      const s0 = this.samples[0];
      return { x: s0.x, y: s0.y, angle: s0.angle, tangentX: s0.tangentX, tangentY: s0.tangentY };
    }
    if (d >= this.totalLength) {
      const sEnd = this.samples[this.samples.length - 1];
      return { x: sEnd.x, y: sEnd.y, angle: sEnd.angle, tangentX: sEnd.tangentX, tangentY: sEnd.tangentY };
    }

    // Binary search in samples array
    let low = 0;
    let high = this.samples.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.samples[mid].distance < d) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.max(1, low);
    const pPrev = this.samples[idx - 1];
    const pNext = this.samples[idx];
    const span = pNext.distance - pPrev.distance;
    const ratio = span > 0 ? (d - pPrev.distance) / span : 0;

    return {
      x: pPrev.x + (pNext.x - pPrev.x) * ratio,
      y: pPrev.y + (pNext.y - pPrev.y) * ratio,
      angle: pPrev.angle + (pNext.angle - pPrev.angle) * ratio,
      tangentX: pPrev.tangentX,
      tangentY: pPrev.tangentY
    };
  }

  // Render path groove / Aztec stone tracks with realistic depth and golden glyph inlays
  drawTrack(ctx) {
    if (this.samples.length < 2) return;

    ctx.save();

    // 1. Outer Deep Ambient Occlusion Drop Shadow
    ctx.beginPath();
    ctx.moveTo(this.samples[0].x, this.samples[0].y);
    for (let i = 1; i < this.samples.length; i += 2) {
      ctx.lineTo(this.samples[i].x, this.samples[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 54;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 2. Weathered Stone Bevel Border
    ctx.strokeStyle = '#2b1b10';
    ctx.lineWidth = 48;
    ctx.stroke();

    // 3. Inner Carved Stone Trench Wall
    ctx.strokeStyle = '#140c06';
    ctx.lineWidth = 42;
    ctx.stroke();

    // 4. Smooth Trench Bed (where marbles roll)
    ctx.strokeStyle = '#0c0704';
    ctx.lineWidth = 36;
    ctx.stroke();

    // 5. Golden Aztec Runic Rail (center guidance rail)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dashed glowing gold runic inlays
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 14]);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // 6. Danger Zone Fiery Warning Glow (from dangerRatio to 100%)
    const dangerStartIdx = Math.floor(this.samples.length * this.dangerRatio);
    const dangerPulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.3;

    ctx.beginPath();
    ctx.moveTo(this.samples[dangerStartIdx].x, this.samples[dangerStartIdx].y);
    for (let i = dangerStartIdx + 1; i < this.samples.length; i++) {
      ctx.lineTo(this.samples[i].x, this.samples[i].y);
    }
    ctx.strokeStyle = `rgba(255, 30, 0, ${dangerPulse})`;
    ctx.lineWidth = 6;
    ctx.shadowColor = '#ff2200';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.restore();
  }
}

// Stage Definitions (Built for 1280 x 720 canvas resolution)
const STAGE_PATHS = [
  // Stage 1: Classic Spiral of Quetzalcoatl
  new SplinePath(
    'مسار كيتزالكواتل الحلزوني (Spiral of Quetzalcoatl)',
    'مسار حلزوني آزتيكي كلاسيكي يلتف برفق نحو عرش الجمجمة الذهبية.',
    [
      { x: 90,  y: 60 },
      { x: 380, y: 70 },
      { x: 740, y: 80 },
      { x: 1120, y: 110 },
      { x: 1190, y: 320 },
      { x: 1180, y: 560 },
      { x: 960,  y: 650 },
      { x: 580,  y: 655 },
      { x: 200,  y: 620 },
      { x: 100,  y: 420 },
      { x: 130,  y: 220 },
      { x: 340,  y: 170 },
      { x: 700,  y: 180 },
      { x: 990,  y: 260 },
      { x: 1010, y: 460 },
      { x: 880,  y: 540 },
      { x: 500,  y: 545 },
      { x: 310,  y: 460 },
      { x: 320,  y: 330 },
      { x: 490,  y: 280 },
      { x: 760,  y: 310 },
      { x: 840,  y: 420 },
      { x: 740,  y: 480 },
      { x: 640,  y: 450 } // Terminates right before the central frog
    ],
    { x: 560, y: 390 }, // Frog position
    Math.PI * 0.85
  ),

  // Stage 2: Temple of the Sun (Double S-Curve)
  new SplinePath(
    'معبد الشمس الأكبر (Temple of the Sun)',
    'مسار مزدوج يمر عبر أعمدة الآزتيك الحجرية المنقوشة برياح النار.',
    [
      { x: 80,   y: 120 },
      { x: 360,  y: 100 },
      { x: 680,  y: 140 },
      { x: 980,  y: 90 },
      { x: 1180, y: 220 },
      { x: 1120, y: 400 },
      { x: 850,  y: 350 },
      { x: 420,  y: 320 },
      { x: 160,  y: 380 },
      { x: 110,  y: 560 },
      { x: 320,  y: 640 },
      { x: 680,  y: 620 },
      { x: 990,  y: 630 },
      { x: 1140, y: 550 },
      { x: 1100, y: 460 },
      { x: 880,  y: 460 },
      { x: 720,  y: 440 }
    ],
    { x: 640, y: 260 }, // Frog position
    Math.PI
  ),

  // Stage 3: Mythic Serpent Labyrinth
  new SplinePath(
    'أفعى الغابة المطيرة (Mythic Serpent)',
    'مسار أفعواني عملاق يلتف بسرعة فائقة مع زوايا حادة تتطلب دقة متناهية.',
    [
      { x: 1180, y: 80 },
      { x: 900,  y: 110 },
      { x: 550,  y: 90 },
      { x: 180,  y: 140 },
      { x: 90,   y: 360 },
      { x: 260,  y: 480 },
      { x: 650,  y: 460 },
      { x: 1040, y: 420 },
      { x: 1190, y: 560 },
      { x: 1060, y: 650 },
      { x: 680,  y: 640 },
      { x: 320,  y: 610 },
      { x: 190,  y: 440 },
      { x: 340,  y: 260 },
      { x: 720,  y: 240 },
      { x: 960,  y: 300 },
      { x: 850,  y: 400 },
      { x: 750,  y: 380 }
    ],
    { x: 500, y: 350 }, // Frog position
    Math.PI * 0.95
  )
];

window.SplinePath = SplinePath;
window.STAGE_PATHS = STAGE_PATHS;
