/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║        Fel7o — Global Atmospheric Background             ║
 * ║  Initialized ONCE. Persists across ALL navigation.       ║
 * ║  Aurora gradients + floating orbs + noise texture.       ║
 * ╚══════════════════════════════════════════════════════════╝
 */
(function FelHoGlobalBg() {
  'use strict';

  const BG_ID     = 'fel7o-global-bg';
  const CANVAS_ID = 'fel7o-bg-canvas';

  // ── Guard: run only once per page lifetime ────────────────
  if (document.getElementById(BG_ID)) return;

  /* ═════════════════════════════════════════════════════════
     1.  CSS  — injected into <head> once
  ═════════════════════════════════════════════════════════ */
  const CSS = `
    /* ── Root background layer ─────────────────────────── */
    #${BG_ID} {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: -1;
      overflow: hidden;
      background: #0c1321;
      pointer-events: none;
      isolation: isolate;
    }

    /* ── Aurora blobs ──────────────────────────────────── */
    #${BG_ID} .fgb-aurora {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      will-change: transform;
    }

    /* Top-right: violet */
    #${BG_ID} .fgb-a1 {
      width: 72vw; height: 72vw;
      top: -22%; right: -14%;
      background: radial-gradient(circle at 45% 45%,
        rgba(124, 58, 237, 0.32) 0%,
        rgba(124, 58, 237, 0.14) 32%,
        transparent 68%);
      filter: blur(55px);
      animation: fgb-drift-1 24s ease-in-out infinite;
    }

    /* Bottom-left: cyan */
    #${BG_ID} .fgb-a2 {
      width: 62vw; height: 62vw;
      bottom: -22%; left: -14%;
      background: radial-gradient(circle at 55% 55%,
        rgba(0, 212, 255, 0.26) 0%,
        rgba(0, 212, 255, 0.10) 32%,
        transparent 68%);
      filter: blur(55px);
      animation: fgb-drift-2 30s ease-in-out infinite;
    }

    /* Center: deep violet accent */
    #${BG_ID} .fgb-a3 {
      width: 52vw; height: 52vw;
      top: 28%; left: 22%;
      background: radial-gradient(circle at center,
        rgba(109, 40, 217, 0.16) 0%,
        transparent 65%);
      filter: blur(90px);
      animation: fgb-drift-3 38s ease-in-out infinite;
    }

    /* Top-left: subtle teal warmth */
    #${BG_ID} .fgb-a4 {
      width: 38vw; height: 38vw;
      top: -8%; left: -8%;
      background: radial-gradient(circle at center,
        rgba(0, 180, 200, 0.12) 0%,
        transparent 70%);
      filter: blur(70px);
      animation: fgb-drift-4 44s ease-in-out infinite;
    }

    /* ── Noise texture overlay ──────────────────────────── */
    #${BG_ID} .fgb-noise {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      opacity: 0.038;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 200px 200px;
      pointer-events: none;
    }

    /* ── Particle canvas ────────────────────────────────── */
    #${CANVAS_ID} {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: block;
    }

    /* ── Aurora keyframe animations ────────────────────── */
    @keyframes fgb-drift-1 {
      0%,100% { transform: translate(0,   0  ) scale(1);    }
      20%     { transform: translate(-4%, 3% ) scale(1.06); }
      45%     { transform: translate(-2%,-5% ) scale(0.95); }
      70%     { transform: translate( 4%, 2% ) scale(1.03); }
    }
    @keyframes fgb-drift-2 {
      0%,100% { transform: translate(0,   0  ) scale(1);    }
      25%     { transform: translate( 5%,-3% ) scale(1.08); }
      55%     { transform: translate( 2%, 5% ) scale(0.93); }
      80%     { transform: translate(-4%, 1% ) scale(1.04); }
    }
    @keyframes fgb-drift-3 {
      0%,100% { transform: translate(0,   0  ) scale(1);    }
      33%     { transform: translate(-7%,-4% ) scale(1.10); }
      66%     { transform: translate( 5%, 6% ) scale(0.90); }
    }
    @keyframes fgb-drift-4 {
      0%,100% { transform: translate(0,   0  ) scale(1);    }
      50%     { transform: translate( 6%, 5% ) scale(1.12); }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.id    = 'fel7o-global-bg-style';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ═════════════════════════════════════════════════════════
     2.  DOM  — single container, prepended to <body>
  ═════════════════════════════════════════════════════════ */
  const bgEl = document.createElement('div');
  bgEl.id = BG_ID;
  bgEl.setAttribute('aria-hidden', 'true');
  bgEl.innerHTML =
    '<div class="fgb-aurora fgb-a1"></div>' +
    '<div class="fgb-aurora fgb-a2"></div>' +
    '<div class="fgb-aurora fgb-a3"></div>' +
    '<div class="fgb-aurora fgb-a4"></div>' +
    '<div class="fgb-noise"></div>'         +
    '<canvas id="' + CANVAS_ID + '"></canvas>';

  function mount() {
    document.body.insertBefore(bgEl, document.body.firstChild);
    initCanvas();
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }

  /* ═════════════════════════════════════════════════════════
     3.  CANVAS  — lightweight particle & orb system
         • ~50 elements max
         • Pure rAF loop, no setInterval
         • Graceful resize
  ═════════════════════════════════════════════════════════ */
  function initCanvas() {
    const canvas = document.getElementById(CANVAS_ID);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;

    const CYAN   = '0,212,255';
    const VIOLET = '124,58,237';
    const COLORS = [CYAN, VIOLET];

    /* ── Particle factory ─────────────────────────────── */
    function mkParticle(yOverride) {
      const big = Math.random() > 0.78;          // ~22% are orbs
      return {
        x:     Math.random() * W,
        y:     (yOverride !== undefined) ? yOverride : Math.random() * H,
        r:     big ? (Math.random() * 4.5 + 3)   // orb radius 3–7.5
                   : (Math.random() * 1.4 + 0.4), // dot radius 0.4–1.8
        vx:    (Math.random() - 0.5) * 0.22,
        vy:    big ? -(Math.random() * 0.28 + 0.07)   // orbs drift upward
                   : (Math.random() - 0.5) * 0.18,
        alpha: Math.random() * 0.55 + 0.20,
        phase: Math.random() * Math.PI * 2,
        spd:   Math.random() * 0.016 + 0.005,
        col:   COLORS[Math.random() > 0.5 ? 0 : 1],
        big,
      };
    }

    const pool = [];

    /* ── Resize & replenish ───────────────────────────── */
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;

      // Target count: ~1 particle per 20 000px², capped 28–56
      const target = Math.min(56, Math.max(28, Math.floor((W * H) / 20000)));

      while (pool.length < target) pool.push(mkParticle());
      if   (pool.length > target)  pool.length = target;
    }

    /* ── Render loop ──────────────────────────────────── */
    function frame() {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.spd;

        // Wrap at edges
        if      (p.x < -25)   p.x = W + 25;
        else if (p.x > W + 25) p.x = -25;
        if      (p.y < -25)   { p.y = H + 25; p.x = Math.random() * W; }
        else if (p.y > H + 25) { p.y = -25;   p.x = Math.random() * W; }

        // Pulsed values
        const s   = Math.sin(p.phase);
        const a   = +(p.alpha  * (0.65 + 0.35 * s)).toFixed(3);
        const r   = p.r * (0.88 + 0.12 * Math.sin(p.phase + 1));

        if (p.big) {
          // ── Glowing orb: radial gradient ──────────────
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5.5);
          g.addColorStop(0,   `rgba(${p.col},${a})`);
          g.addColorStop(0.28,`rgba(${p.col},${+(a * 0.50).toFixed(3)})`);
          g.addColorStop(0.70,`rgba(${p.col},${+(a * 0.12).toFixed(3)})`);
          g.addColorStop(1,   `rgba(${p.col},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 5.5, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        } else {
          // ── Star dot ──────────────────────────────────
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.col},${a})`;
          ctx.fill();

          // Soft halo around dot
          const h = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.5);
          h.addColorStop(0, `rgba(${p.col},${+(a * 0.18).toFixed(3)})`);
          h.addColorStop(1, `rgba(${p.col},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = h;
          ctx.fill();
        }
      }

      requestAnimationFrame(frame);
    }

    // Boot
    resize();
    frame();

    // Debounced resize handler
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
  }

}());
