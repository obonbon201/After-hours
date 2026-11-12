/* AFTER HOURS / Stage 1 — the area behind the entrance gate (v1.9.6).
 *
 * The walkable ground behind the gate is doubled (about 635 m2 -> about 1270 m2, counted on a 0.25 m grid):
 *  - BRANCH SQUARE  just inside the gate: the main street ahead, the service-yard gate to the right.
 *  - MAIN STREET    the existing avenue to the carousel: a closed snack stand with a striped awning, a shut
 *                   popcorn cart, two dying lamps, hedges, an old guide board, and bulbs on the far banner.
 *  - BACK ALLEY     through a delivery gate in the east fence: a service yard with a parked truck, then two
 *                   short alleys behind the kitchen block and the storage shed, with corners and clutter.
 *                   Halfway along, a staff gate leads back to the main street (turn back, or go on).
 *  - JUNCTION       both ways meet north of the snack stand, under a red revolving beacon, before the
 *                   carousel courtyard (the first objectives), so the story runs in the same order either way.
 * Everything is a physical collider (no invisible walls). The gate, its unlock, the objectives, Stage 2 and
 * saves are untouched; no new state is saved. Lighting is emissive surfaces and light pools (no new lights,
 * so nothing recompiles). Only Stage 1's world is changed.
 */
(function () {
  'use strict';
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { installDistrict(host); } catch (err) { console.warn('entrance district unavailable:', err); }
    return result;
  };

  // the new ground east of the avenue (world units = metres; +z is toward the gate)
  const D = { x0: 11.06, x1: 37.8, z0: 1.2, z1: 40.0 };
  // plaza-side fence on x = 11: openings for the service yard and the staff gate
  const YARD_GATE = { z0: 28.4, z1: 32.8 };
  const SIDE_GATE = { z0: 9.0, z1: 11.65 };
  const KEEP_FENCE_FROM = 32.8;      // the original fence collider is kept from here south (the outer forecourt)
  const JP = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans CJK JP","Noto Sans JP","Yu Gothic",sans-serif';

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function installDistrict(host) {
    const T = host.THREE, world = host.world, scene = host.scene, story = host.story;
    if (!T || !world || !scene || world.entranceDistrict || !Array.isArray(world.colliders)) return;
    const VM = world.visualMaterials || {};
    const env = world.surfaceEnvironment || VM.environment || null;
    const verify = new URLSearchParams(location.search).has('verify');

    // ------------------------------------------------------------------ textures
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const tex = (c, { repeat = false, color = true } = {}) => {
      const t = new T.CanvasTexture(c);
      if (color) t.colorSpace = T.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    };
    const speckle = (g, w, h, n, colors, r0, r1, r, alpha = 1) => {
      for (let i = 0; i < n; i++) {
        g.globalAlpha = alpha * (0.3 + r() * 0.7); g.fillStyle = colors[(r() * colors.length) | 0];
        g.beginPath(); g.arc(r() * w, r() * h, r0 + r() * (r1 - r0), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    };
    const text = (g, s, x, y, size, color, weight = 800, align = 'center', font = JP) => {
      g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.font = `${weight} ${size}px ${font}`; g.fillText(s, x, y);
    };
    // weathering shared by every painted board: sun-bleached top, grime and run marks, flakes
    const weather = (g, w, h, r, amount = 1) => {
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, `rgba(235,232,215,${0.25 * amount})`); lg.addColorStop(0.6, 'rgba(0,0,0,0)'); lg.addColorStop(1, `rgba(25,22,16,${0.38 * amount})`);
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14 * amount; i++) {
        const x = r() * w, ln = h * (0.2 + r() * 0.8), sg = g.createLinearGradient(0, 0, 0, ln);
        sg.addColorStop(0, 'rgba(30,26,18,0.32)'); sg.addColorStop(1, 'rgba(30,26,18,0)');
        g.fillStyle = sg; g.fillRect(x, 0, 2 + r() * 5, ln);
      }
      for (let i = 0; i < 10 * amount; i++) { g.fillStyle = 'rgba(120,118,104,0.85)'; g.beginPath(); g.ellipse(r() * w, r() * h, 2 + r() * 10, 2 + r() * 6, r() * 3, 0, 6.28); g.fill(); }
      speckle(g, w, h, 300 * amount, ['rgba(40,36,28,0.5)', 'rgba(220,216,200,0.4)'], 0.5, 1.8, r);
    };
    const board = (w, h, seed, bg, draw, amount = 1) => {
      const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
      g.fillStyle = bg; g.fillRect(0, 0, w, h); draw(g, w, h, r); weather(g, w, h, r, amount); return c;
    };
    // corrugated sheet (storage shed walls, truck box sides): vertical ridges, rust runs
    const corrCanvas = (() => {
      const c = canvas(256, 256), g = c.getContext('2d'), r = rng(301);
      for (let x = 0; x < 256; x += 16) {
        const lg = g.createLinearGradient(x, 0, x + 16, 0);
        lg.addColorStop(0, '#5d6862'); lg.addColorStop(0.45, '#8c958d'); lg.addColorStop(0.55, '#7a847d'); lg.addColorStop(1, '#4c5651');
        g.fillStyle = lg; g.fillRect(x, 0, 16, 256);
      }
      for (let i = 0; i < 40; i++) {
        const x = r() * 256, y = r() * 140, ln = 40 + r() * 160, lg = g.createLinearGradient(0, y, 0, y + ln);
        lg.addColorStop(0, 'rgba(118,62,32,0.75)'); lg.addColorStop(1, 'rgba(118,62,32,0)');
        g.fillStyle = lg; g.fillRect(x, y, 2 + r() * 4, ln);
      }
      speckle(g, 256, 256, 500, ['#3e4843', '#6b4632', '#98a199'], 0.5, 2.5, r, 0.6);
      return c;
    })();
    // rolling shutter: horizontal slats, a dent, a spray tag, grime at the foot
    const shutterCanvas = (() => {
      const c = canvas(256, 256), g = c.getContext('2d'), r = rng(311);
      for (let y = 0; y < 256; y += 10) {
        const lg = g.createLinearGradient(0, y, 0, y + 10);
        lg.addColorStop(0, '#9ea59c'); lg.addColorStop(0.5, '#848b83'); lg.addColorStop(1, '#5f665f');
        g.fillStyle = lg; g.fillRect(0, y, 256, 10);
      }
      const fg = g.createLinearGradient(0, 160, 0, 256); fg.addColorStop(0, 'rgba(40,34,26,0)'); fg.addColorStop(1, 'rgba(40,34,26,0.55)');
      g.fillStyle = fg; g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, 400, ['#4b524b', '#6d4b36', '#b0b6ac'], 0.5, 2, r, 0.5);
      return c;
    })();
    // awning cloth: faded red and cream stripes, scalloped hem (alpha)
    const stripeCanvas = (() => {
      const c = canvas(512, 256), g = c.getContext('2d'), r = rng(321);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e6dcc0' : '#a8352b'; g.fillRect(i * 64, 0, 64, 214); }
      for (let i = 0; i < 16; i++) { g.fillStyle = Math.floor(i / 2) % 2 ? '#e6dcc0' : '#a8352b'; g.beginPath(); g.arc(i * 32 + 16, 214, 16, 0, Math.PI); g.fill(); }
      g.globalCompositeOperation = 'source-atop'; weather(g, 512, 256, r, 0.8); g.globalCompositeOperation = 'source-over';
      return c;
    })();
    const glowCanvas = (() => {
      const c = canvas(128, 128), g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.4)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128); return c;
    })();
    const leafCanvas = (() => {
      const c = canvas(256, 256), g = c.getContext('2d'), r = rng(331);
      g.fillStyle = '#2f3f30'; g.fillRect(0, 0, 256, 256);
      speckle(g, 256, 256, 1500, ['#3d5240', '#26342a', '#4a6049', '#1d2820'], 2, 7, r, 0.9);
      return c;
    })();

    // ---- boards and signs (one atlas)
    const S = {};
    S.snack = board(1024, 176, 401, '#2f4a46', (g, w, h) => {
      g.strokeStyle = '#d9c99c'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
      text(g, 'スナック ほしぞら', w * 0.42, h * 0.5, 84, '#efe3c0', 900);
      text(g, 'STAR SNACK', w * 0.86, h * 0.5, 44, '#d8b25a', 800);
    });
    S.menu = board(320, 400, 403, '#e4dcc4', (g, w) => {
      g.fillStyle = '#7e3a2c'; g.fillRect(0, 0, w, 70); text(g, 'MENU', w / 2, 38, 44, '#f3ead2', 900);
      [['ホットドッグ', '300'], ['ポップコーン', '250'], ['ソフトクリーム', '280'], ['ラムネ', '150'], ['フランクフルト', '300']].forEach(([a, b], i) => {
        text(g, a, 24, 112 + i * 58, 30, '#2a2a22', 700, 'left'); text(g, b + '円', w - 22, 112 + i * 58, 30, '#7e3a2c', 800, 'right');
      });
    });
    S.hours = board(512, 160, 405, '#d6cfb6', (g, w, h) => {
      text(g, '営業時間 10:00 – 21:00', w / 2, h * 0.36, 38, '#2c3a36', 800);
      text(g, '本日の営業は終了しました', w / 2, h * 0.72, 32, '#7e3a2c', 800);
    });
    S.kitchen = board(896, 140, 407, '#d0c8ae', (g, w, h) => {
      text(g, '調理棟', w * 0.22, h * 0.52, 72, '#2c3a36', 900); text(g, 'CATERING KITCHEN', w * 0.66, h * 0.52, 52, '#4f5d58', 800);
    });
    S.staff = board(512, 150, 409, '#f0e9d2', (g, w, h) => {
      g.fillStyle = '#9c2a20'; g.fillRect(0, 0, w, 54); text(g, '関係者以外立入禁止', w / 2, 29, 38, '#f6eedb', 900);
      text(g, 'STAFF ONLY', w / 2, 102, 48, '#2a2a22', 900);
    });
    S.delivery = board(896, 150, 411, '#2c3a36', (g, w, h) => {
      g.strokeStyle = '#c8bc96'; g.lineWidth = 6; g.strokeRect(9, 9, w - 18, h - 18);
      text(g, '搬入口', w * 0.25, h * 0.52, 76, '#efe3c0', 900); text(g, 'SERVICE YARD', w * 0.68, h * 0.52, 56, '#d8c08a', 800);
    });
    S.storage = board(400, 400, 413, '#c9c5b2', (g, w, h) => {
      text(g, '3', w / 2, h * 0.44, 260, '#2a2a22', 900, 'center', 'Impact, "Arial Black", sans-serif');
      text(g, '資材倉庫  STORAGE', w / 2, h * 0.86, 40, '#2a2a22', 800);
    }, 1.4);
    S.fire = board(256, 128, 415, '#f0e9d2', (g, w, h) => {
      g.fillStyle = '#a2271d'; g.fillRect(8, 8, w - 16, h - 16); text(g, '火気厳禁', w / 2, h / 2, 54, '#f6eedb', 900);
    });
    S.north = board(768, 168, 417, '#2f4a46', (g, w, h) => {
      g.fillStyle = '#efe3c0'; g.beginPath(); g.moveTo(70, 18); g.lineTo(120, 84); g.lineTo(88, 84); g.lineTo(88, 150); g.lineTo(52, 150); g.lineTo(52, 84); g.lineTo(20, 84); g.closePath(); g.fill();
      text(g, '回転木馬広場', w * 0.55, h * 0.36, 60, '#efe3c0', 900); text(g, 'メインストリート  MAIN STREET', w * 0.55, h * 0.75, 34, '#d8c08a', 800);
    });
    S.east = board(768, 168, 419, '#3d3a33', (g, w, h) => {
      g.fillStyle = '#efe3c0'; g.beginPath(); g.moveTo(w - 18, h / 2); g.lineTo(w - 90, h / 2 - 52); g.lineTo(w - 90, h / 2 - 22); g.lineTo(w - 160, h / 2 - 22); g.lineTo(w - 160, h / 2 + 22); g.lineTo(w - 90, h / 2 + 22); g.lineTo(w - 90, h / 2 + 52); g.closePath(); g.fill();
      text(g, '搬入口・裏通路', w * 0.4, h * 0.38, 58, '#efe3c0', 900); text(g, 'SERVICE YARD  (STAFF)', w * 0.4, h * 0.76, 32, '#c8bc96', 800);
    });
    S.guide = board(640, 420, 421, '#6d8a62', (g, w, h, r) => {
      g.fillStyle = '#2f4a46'; g.fillRect(0, 0, w, 66); text(g, '園内案内  GUIDE', w / 2, 34, 40, '#efe3c0', 900);
      g.strokeStyle = '#d9cfae'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w * 0.5, h - 30); g.lineTo(w * 0.5, h * 0.42); g.lineTo(w * 0.3, h * 0.26); g.moveTo(w * 0.5, h * 0.42); g.lineTo(w * 0.75, h * 0.3); g.stroke();
      g.setLineDash([10, 12]); g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.62, h - 30); g.lineTo(w * 0.78, h * 0.7); g.lineTo(w * 0.62, h * 0.5); g.stroke(); g.setLineDash([]);
      const spot = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, 18, 0, 6.28); g.fill(); text(g, s, x, y + 34, 24, '#f2ead0', 800); };
      spot(w * 0.5, h * 0.42, '回転木馬', '#d3a24a'); spot(w * 0.3, h * 0.26, '観覧車', '#c97f5a'); spot(w * 0.75, h * 0.3, 'ゲームセンター', '#b8584a');
      text(g, '搬入口', w * 0.8, h * 0.74, 22, '#efe3c0', 800);
      g.fillStyle = '#b8584a'; g.beginPath(); g.arc(w * 0.5, h - 40, 12, 0, 6.28); g.fill(); text(g, '現在地', w * 0.5 + 56, h - 40, 22, '#f5e9c8', 800);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(30,24,18,0.5)'; g.fillRect(r() * w, 70 + r() * (h - 80), 30 + r() * 90, 3 + r() * 5); }   // scratches
    }, 1.5);
    S.livery = board(1024, 320, 423, '#c9c8bb', (g, w, h, r) => {
      g.fillStyle = '#2f4a46'; g.fillRect(0, h * 0.62, w, h * 0.16);
      text(g, 'STARLIGHT WONDER PARK', w * 0.47, h * 0.3, 78, '#2f4a46', 900);
      text(g, '園内物流  PARK SUPPLY', w * 0.47, h * 0.7, 40, '#efe3c0', 800);
      g.fillStyle = '#c99a3a'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 26 : 62; g.lineTo(w * 0.92 + Math.cos(a) * rr, h * 0.33 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(70,60,48,0.35)'; g.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 2); }
    }, 1.6);
    // emissive signs keep their own textures (they glow)
    const exitCanvas = (() => {
      const c = canvas(256, 112), g = c.getContext('2d');
      g.fillStyle = '#0fa34a'; g.fillRect(0, 0, 256, 112);
      g.fillStyle = '#eafff0'; g.fillRect(14, 14, 74, 84);
      g.fillStyle = '#0fa34a'; g.beginPath(); g.arc(52, 32, 9, 0, 6.28); g.fill(); g.fillRect(40, 44, 16, 26); g.fillRect(28, 66, 14, 8); g.fillRect(56, 66, 16, 8); g.fillRect(56, 48, 18, 7);
      text(g, '非常口', 170, 56, 46, '#eafff0', 900);
      return c;
    })();
    const junctionCanvas = (() => {
      const c = canvas(768, 220), g = c.getContext('2d'), r = rng(427);
      g.fillStyle = '#f1e7c8'; g.fillRect(0, 0, 768, 220);
      g.fillStyle = '#8f2a20'; g.fillRect(0, 0, 768, 64); text(g, '合流地点  JUNCTION', 384, 33, 40, '#fbf1da', 900);
      g.fillStyle = '#2a2a22'; g.beginPath(); g.moveTo(28, 142); g.lineTo(102, 92); g.lineTo(102, 122); g.lineTo(170, 122); g.lineTo(170, 162); g.lineTo(102, 162); g.lineTo(102, 192); g.closePath(); g.fill();
      text(g, '回転木馬広場', 470, 120, 64, '#2a2a22', 900); text(g, 'CAROUSEL COURTYARD', 470, 180, 34, '#5b4f3c', 800);
      weather(g, 768, 220, r, 0.6);
      return c;
    })();
    // pack the boards into one 2048 x 2048 atlas (shelf packing, sizes are fixed)
    const atlasRects = new Map();
    const atlasTex = (() => {
      const c = canvas(2048, 2048), g = c.getContext('2d');
      let x = 0, y = 0, row = 0;
      for (const [k, im] of Object.entries(S)) {
        if (x + im.width > 2048) { x = 0; y += row + 4; row = 0; }
        g.drawImage(im, x, y); atlasRects.set(k, [x / 2048, 1 - (y + im.height) / 2048, im.width / 2048, im.height / 2048]);
        x += im.width + 4; row = Math.max(row, im.height);
      }
      return tex(c);
    })();

    // ------------------------------------------------------------------ materials
    const std = (o) => new T.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: 0.3 }, o));
    const pick = (k, fallback) => VM[k] || std(fallback);
    const repeatTex = (c, rx, ry) => { const t = tex(c, { repeat: true }); t.repeat.set(rx, ry); return t; };
    const M = {
      plaster: pick('plaster', { color: '#a5b6a5', roughness: 0.95 }),
      peel: pick('peelingPaint', { color: '#b39b87', roughness: 0.95 }),
      concrete: pick('concrete', { color: '#c0c3b5', roughness: 0.95 }),
      tar: pick('tar', { color: '#3d4a47', roughness: 0.92 }),
      trim: pick('trim', { color: '#b4b3a0', roughness: 0.6, metalness: 0.6 }),
      wood: pick('wood', { color: '#a7a68d', roughness: 0.9 }),
      black: pick('blackMetal', { color: '#3b514e', roughness: 0.72, metalness: 0.38 }),
      painted: pick('paintedMetal', { color: '#b5c6b6', roughness: 0.87, metalness: 0.35 }),
      rust: pick('rust', { color: '#b2a291', roughness: 0.9, metalness: 0.35 }),
      roof: pick('roof', { color: '#91aaa3', roughness: 0.9 }),
      cream: pick('cream', { color: '#d8cfb2', roughness: 0.9 }),
      glass: std({ color: '#26302e', roughness: 0.18, metalness: 0.4, envMapIntensity: 0.8 }),
      metal: (world.mat && world.mat.metal) || std({ color: '#3e4b43', roughness: 0.7, metalness: 0.5 }),
      corr: std({ map: repeatTex(corrCanvas, 2, 1), roughness: 0.62, metalness: 0.55 }),
      corrTruck: std({ map: repeatTex(corrCanvas, 3, 1), color: '#c8c8bc', roughness: 0.6, metalness: 0.45 }),
      shutter: std({ map: repeatTex(shutterCanvas, 1, 1), roughness: 0.55, metalness: 0.55 }),
      stripes: std({ map: tex(stripeCanvas), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.95, metalness: 0 }),
      leaf: std({ map: repeatTex(leafCanvas, 2, 2), roughness: 1, metalness: 0, envMapIntensity: 0.05 }),
      tyre: std({ color: '#1d2220', roughness: 0.95 }),
      atlas: std({ map: atlasTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.12, side: T.DoubleSide }),
      exit: new T.MeshBasicMaterial({ map: tex(exitCanvas), toneMapped: false }),
      junction: std({ map: tex(junctionCanvas), emissiveMap: tex(junctionCanvas), emissive: new T.Color('#fff1d0'), emissiveIntensity: 0.55, roughness: 0.9 }),
      // light bodies (unlit; their brightness is animated)
      lantern: new T.MeshBasicMaterial({ color: new T.Color('#ffd9a0') }),
      sodium: new T.MeshBasicMaterial({ color: new T.Color('#f6c27a') }),
      sodium2: new T.MeshBasicMaterial({ color: new T.Color('#f6c27a') }),
      tube: new T.MeshBasicMaterial({ color: new T.Color('#e4f6ee') }),
      tube2: new T.MeshBasicMaterial({ color: new T.Color('#e4f6ee') }),
      bulb: new T.MeshBasicMaterial({ color: new T.Color('#ffe2a8') }),
      bulbDead: new T.MeshBasicMaterial({ color: new T.Color('#4a4438') }),
      amber: new T.MeshBasicMaterial({ color: new T.Color('#ffae42') }),
      beacon: new T.MeshBasicMaterial({ color: new T.Color('#ff2a18'), toneMapped: false }),
      redLamp: new T.MeshBasicMaterial({ color: new T.Color('#ff3a24'), toneMapped: false }),
      cone: std({ color: '#c5402c', roughness: 0.7 }),
      fence: new T.MeshBasicMaterial({ map: world.fenceTex || null, transparent: true, opacity: 0.3, side: T.DoubleSide, depthWrite: false }),
    };
    const glowTex = tex(glowCanvas);
    const glowMats = [];
    const glowMat = (color, opacity) => { const m = new T.MeshBasicMaterial({ map: glowTex, color: new T.Color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: true }); glowMats.push(m); return m; };

    // ------------------------------------------------------------------ geometry helpers
    const root = new T.Group(); root.name = 'AH entrance district v1.9.6'; scene.add(root);
    const statics = new T.Group(); statics.name = 'district statics'; root.add(statics);
    const live = new T.Group(); live.name = 'district lights'; root.add(live);
    const geoCache = new Map();
    const boxGeo = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!geoCache.has(k)) geoCache.set(k, new T.BoxGeometry(w, h, d)); return geoCache.get(k); };
    const box = (w, h, d, x, y, z, mat, rot, parent = statics) => {
      const m = new T.Mesh(boxGeo(w, h, d), mat); m.position.set(x, y, z);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      parent.add(m); return m;
    };
    // an axis-aligned block from its footprint (x0..x1, z0..z1) and height range (y0..y1)
    const block = (x0, x1, z0, z1, y0, y1, mat, parent = statics) => box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, mat, null, parent);
    const cyl = (r, h, x, y, z, mat, seg = 10, rot, parent = statics, r2 = r) => {
      const m = new T.Mesh(new T.CylinderGeometry(r, r2, h, seg), mat); m.position.set(x, y, z);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      parent.add(m); return m;
    };
    const plane = (w, h, x, y, z, mat, ry = 0, rx = 0, parent = statics) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
    };
    // a board from the atlas; ry turns it (0 = faces +z)
    const sign = (key, w, h, x, y, z, ry = 0, parent = statics) => {
      const m = plane(w, h, x, y, z, M.atlas, ry, 0, parent), [u0, v0, du, dv] = atlasRects.get(key), uv = m.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
      uv.needsUpdate = true; return m;
    };
    const glowPool = (w, d, x, z, color, opacity, y = 0.09) => { const m = plane(w, d, x, y, z, glowMat(color, opacity), 0, -Math.PI / 2, live); m.renderOrder = 3; return m; };
    const halos = [];
    const halo = (size, x, y, z, color, opacity) => { const m = plane(size, size, x, y, z, glowMat(color, opacity), 0, 0, live); m.renderOrder = 4; halos.push(m); return m; };

    // ------------------------------------------------------------------ colliders (physical; nothing invisible)
    const colliders = [];
    const collide = (x0, x1, z0, z1, tag) => { const c = { minX: x0, maxX: x1, minZ: z0, maxZ: z1, kind: 'district', tag: 'district:' + tag }; world.colliders.push(c); colliders.push(c); return c; };

    // ------------------------------------------------------------------ the plaza fence on x = 11
    // The original fence (one 46 m piece, merged into the static meshes) is removed by collapsing its triangles
    // and rebuilt as segments with two openings. Its collider is kept for the outer forecourt (z > 32.8).
    for (const c of world.colliders) {
      if (c.kind === 'fence' && Math.abs((c.minX + c.maxX) / 2 - 11) < 0.02 && c.maxZ > 50 && c.minZ < 7) { c.minZ = KEEP_FENCE_FROM; c.tag = 'district:fence-forecourt'; }
    }
    const OLD_FENCE = { x0: 10.955, x1: 11.045, y0: -0.02, y1: 1.86, z0: 5.9, z1: 52.1 };
    let oldFenceGone = false;
    const removeOldFence = () => {
      scene.updateMatrixWorld(true);
      const v = new T.Vector3(); let changedAny = 0;
      scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.parent !== scene || !o.geometry || !o.geometry.attributes.position) return;
        o.geometry.computeBoundingBox && !o.geometry.boundingBox && o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox; if (!bb) return;
        const b = bb.clone().applyMatrix4(o.matrixWorld), R = OLD_FENCE;
        if (b.max.x < R.x0 || b.min.x > R.x1 || b.max.z < R.z0 || b.min.z > R.z1 || b.min.y > R.y1) return;
        const P = o.geometry.attributes.position, I = o.geometry.index, m = o.matrixWorld, n = I ? I.count : P.count;
        const inside = (i) => { v.fromBufferAttribute(P, i).applyMatrix4(m); return v.x > R.x0 && v.x < R.x1 && v.y > R.y0 && v.y < R.y1 && v.z > R.z0 && v.z < R.z1; };
        let changed = 0;
        for (let k = 0; k < n; k += 3) {
          const a = I ? I.getX(k) : k, b2 = I ? I.getX(k + 1) : k + 1, c = I ? I.getX(k + 2) : k + 2;
          if (inside(a) && inside(b2) && inside(c)) {
            if (I) { I.setX(k + 1, a); I.setX(k + 2, a); } else { P.setXYZ(b2, P.getX(a), P.getY(a), P.getZ(a)); P.setXYZ(c, P.getX(a), P.getY(a), P.getZ(a)); }
            changed++;
          }
        }
        if (changed) { (I || P).needsUpdate = true; changedAny += changed; }
      });
      if (changedAny) oldFenceGone = true;
    };
    removeOldFence();
    // the park's fence pattern: posts every 2 m, two rails, a see-through mesh panel
    const fenceRun = (z0, z1) => {
      const len = z1 - z0, n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) box(0.08, 1.8, 0.08, 11, 0.9, z0 + (len * i) / n, M.metal);
      for (const y of [0.5, 1.4]) box(0.05, 0.05, len, 11, y, (z0 + z1) / 2, M.metal);
      const p = plane(len, 1.45, 11, 0.9, (z0 + z1) / 2, M.fence, Math.PI / 2, 0, root); p.renderOrder = 1;
    };
    fenceRun(KEEP_FENCE_FROM + 0.36, 52);
    fenceRun(SIDE_GATE.z1 + 0.35, 15.0); collide(10.94, 11.06, SIDE_GATE.z1, 15.0, 'fence-sidelot');
    fenceRun(23.0, YARD_GATE.z0 - 0.36); collide(10.94, 11.06, 23.0, YARD_GATE.z0, 'fence-yard');

    // gate posts, header with signs both ways, and the slid-open delivery gate
    for (const z of [YARD_GATE.z0 - 0.18, YARD_GATE.z1 + 0.18]) { block(10.82, 11.18, z - 0.18, z + 0.18, 0, 2.75, M.concrete); collide(10.82, 11.18, z - 0.18, z + 0.18, 'yard-post'); }
    block(10.9, 11.1, YARD_GATE.z0 - 0.36, YARD_GATE.z1 + 0.36, 2.6, 2.82, M.black);
    sign('delivery', 2.9, 0.48, 10.86, 2.36, (YARD_GATE.z0 + YARD_GATE.z1) / 2, -Math.PI / 2);
    sign('delivery', 2.9, 0.48, 11.14, 2.36, (YARD_GATE.z0 + YARD_GATE.z1) / 2, Math.PI / 2);
    {
      const z0 = 23.6, z1 = 27.9, x = 11.36;
      for (const z of [z0, z1]) block(x - 0.04, x + 0.04, z - 0.04, z + 0.04, 0.12, 1.98, M.metal);
      block(x - 0.03, x + 0.03, z0, z1, 1.95, 2.0, M.metal); block(x - 0.03, x + 0.03, z0, z1, 0.12, 0.17, M.metal);
      plane(z1 - z0, 1.8, x, 1.06, (z0 + z1) / 2, M.fence, Math.PI / 2, 0, root).renderOrder = 1;
      for (const z of [z0 + 0.3, z1 - 0.3]) cyl(0.07, 0.04, x, 0.07, z, M.black, 8, [Math.PI / 2, 0, 0]);
      collide(11.06, 11.45, z0 - 0.05, z1 + 0.05, 'yard-gate-leaf');
    }
    // staff gate: a post either side and the leaf swung back against the side lot
    block(10.82, 11.18, SIDE_GATE.z1, SIDE_GATE.z1 + 0.34, 0, 2.0, M.concrete); collide(10.82, 11.18, SIDE_GATE.z1, SIDE_GATE.z1 + 0.34, 'side-post');
    {
      const z = SIDE_GATE.z1 + 0.42, x0 = 11.2, x1 = 13.55;
      block(x0, x1, z - 0.03, z + 0.03, 0.12, 0.17, M.metal); block(x0, x1, z - 0.03, z + 0.03, 1.72, 1.77, M.metal);
      for (const x of [x0, x1]) block(x - 0.035, x + 0.035, z - 0.035, z + 0.035, 0.1, 1.8, M.metal);
      plane(x1 - x0, 1.55, (x0 + x1) / 2, 0.95, z, M.fence, 0, 0, root).renderOrder = 1;
      sign('staff', 0.92, 0.27, 12.4, 1.32, z - 0.05, Math.PI);
      sign('staff', 0.92, 0.27, 12.4, 1.32, z + 0.05, 0);
      collide(x0, x1 + 0.05, z - 0.08, z + 0.08, 'side-gate-leaf');
    }
    sign('staff', 0.92, 0.27, 10.84, 1.75, SIDE_GATE.z1 + 0.17, -Math.PI / 2);

    // ------------------------------------------------------------------ ground: asphalt, painted markings
    {
      const m = plane(D.x1 - D.x0, D.z1 - D.z0, (D.x0 + D.x1) / 2, 0.045, (D.z0 + D.z1) / 2, M.tar, 0, -Math.PI / 2);
      m.userData.keep = true;
      // kerb along the plaza fence and the building bases
      block(D.x0, D.x0 + 0.22, D.z0, D.z1, 0, 0.1, M.concrete);
      const W = 1024, H = Math.round((1024 * (D.z1 - D.z0)) / (D.x1 - D.x0)), c = canvas(W, H), g = c.getContext('2d'), r = rng(501);
      const X = (x) => ((x - D.x0) / (D.x1 - D.x0)) * W, Z = (z) => ((z - D.z0) / (D.z1 - D.z0)) * H, px = W / (D.x1 - D.x0);
      // patches, cracks, oil stains, puddles
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '20,22,20' : '120,122,112'},${0.08 + r() * 0.12})`; g.fillRect(r() * W, r() * H, 20 + r() * 120, 14 + r() * 80); }
      g.strokeStyle = 'rgba(12,14,12,0.55)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H, rr = 10 + r() * 40, rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(8,8,8,0.55)'); rg.addColorStop(1, 'rgba(8,8,8,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, rr, 0, 6.28); g.fill(); }
      // faded paint
      const paint = 'rgba(214,198,140,0.62)', white = 'rgba(222,222,206,0.55)';
      // loading bay with hatching in front of the kitchen shutter and the truck bay
      g.strokeStyle = paint; g.lineWidth = px * 0.12;
      g.strokeRect(X(21.6), Z(20.8), (26.8 - 21.6) * px, (23.4 - 20.8) * px);
      g.save(); g.beginPath(); g.rect(X(21.6), Z(20.8), (26.8 - 21.6) * px, (23.4 - 20.8) * px); g.clip();
      for (let k = -20; k < 30; k++) { g.beginPath(); g.moveTo(X(21.6) + k * px * 0.7, Z(20.8)); g.lineTo(X(21.6) + k * px * 0.7 + 3 * px, Z(23.4)); g.stroke(); }
      g.restore();
      g.strokeStyle = white; g.lineWidth = px * 0.1; g.strokeRect(X(24.0), Z(25.0), 7.8 * px, 3.8 * px);
      // the way through: arrows along the yard and the alleys toward the junction
      const arrow = (x, z, ang, s = 1) => {
        g.save(); g.translate(X(x), Z(z)); g.rotate(ang); g.scale(px * s, px * s); g.fillStyle = white;
        g.beginPath(); g.moveTo(0, -1.2); g.lineTo(0.7, -0.2); g.lineTo(0.25, -0.2); g.lineTo(0.25, 1.0); g.lineTo(-0.25, 1.0); g.lineTo(-0.25, -0.2); g.lineTo(-0.7, -0.2); g.closePath(); g.fill(); g.restore();
      };
      arrow(13.6, 30.6, Math.PI / 2); arrow(19.1, 21.5, 0); arrow(19.1, 10.3, 0); arrow(19.1, 4.0, -Math.PI / 2, 0.9);
      arrow(29.3, 22.0, 0); arrow(33.0, 6.5, -Math.PI / 2 - 0.3); arrow(24.5, 2.9, -Math.PI / 2);
      g.save(); g.translate(X(14.6), Z(34.4)); g.rotate(Math.PI / 2); g.font = `900 ${px * 1.0}px ${JP}`; g.fillStyle = paint; g.textAlign = 'center'; g.fillText('徐行', 0, 0); g.restore();
      g.save(); g.translate(X(14.2), Z(3.3)); g.font = `900 ${px * 0.62}px ${JP}`; g.fillStyle = white; g.textAlign = 'center'; g.fillText('止まれ', 0, 0); g.restore();
      g.strokeStyle = white; g.lineWidth = px * 0.14; g.beginPath(); g.moveTo(X(11.3), Z(4.4)); g.lineTo(X(17.8), Z(4.4)); g.stroke();
      // manholes
      for (const [x, z] of [[19.1, 15.9], [29.3, 9.8], [16.6, 27.0]]) { g.fillStyle = 'rgba(30,30,28,0.8)'; g.beginPath(); g.arc(X(x), Z(z), px * 0.42, 0, 6.28); g.fill(); g.strokeStyle = 'rgba(150,150,140,0.4)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(X(x) - px * 0.35, Z(z) + k * px * 0.12); g.lineTo(X(x) + px * 0.35, Z(z) + k * px * 0.12); g.stroke(); } }
      const dt = tex(c);
      const decal = new T.MeshStandardMaterial({ map: dt, transparent: true, depthWrite: false, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMap: env, envMapIntensity: 0.1 });
      const dm = plane(D.x1 - D.x0, D.z1 - D.z0, (D.x0 + D.x1) / 2, 0.06, (D.z0 + D.z1) / 2, decal, 0, -Math.PI / 2, root); dm.renderOrder = 2;
    }

    // ------------------------------------------------------------------ perimeter walls (south, east, north-east)
    const wall = (x0, x1, z0, z1, h, tag) => {
      block(x0, x1, z0, z1, 0, h, M.plaster);
      block(x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06, h, h + 0.14, M.trim);
      collide(x0, x1, z0, z1, tag);
    };
    wall(D.x0, D.x1, 39.7, 40.0, 3.0, 'wall-south');
    wall(37.5, 37.8, 1.0, 39.7, 3.0, 'wall-east');
    wall(36.0, 37.5, 0.82, 1.18, 3.0, 'wall-north-east');
    for (let z = 4; z < 39.4; z += 4.6) { block(37.22, 37.5, z - 0.22, z + 0.22, 0, 3.1, M.peel); collide(37.22, 37.5, z - 0.22, z + 0.22, 'pilaster'); }
    for (let x = 14; x < 37; x += 4.6) { block(x - 0.22, x + 0.22, 39.42, 39.7, 0, 3.1, M.peel); collide(x - 0.22, x + 0.22, 39.42, 39.7, 'pilaster'); }

    // ------------------------------------------------------------------ S1: the snack stand (front to the main street)
    {
      const x0 = 11.0, x1 = 17.0, z0 = 5.0, z1 = 9.0, h = 3.2;
      block(x0, x0 + 0.25, z0, 5.6, 0, h, M.cream); block(x0, x0 + 0.25, 8.4, z1, 0, h, M.cream);
      block(x0, x0 + 0.25, 5.6, 8.4, 0, 0.95, M.cream); block(x0, x0 + 0.25, 5.6, 8.4, 2.4, h, M.cream);
      block(x1 - 0.25, x1, z0, z1, 0, h, M.peel); block(x0, x1, z0, z0 + 0.25, 0, h, M.peel); block(x0, x1, z1 - 0.25, z1, 0, h, M.peel);
      block(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, h, h + 0.22, M.roof);
      block(x0 + 0.1, x0 + 0.16, 5.6, 8.4, 0.95, 2.4, M.shutter);                     // the closed shutter
      block(10.68, x0, 5.45, 8.55, 0.92, 1.02, M.wood);                              // counter
      block(10.74, x0, 5.45, 8.55, 0.05, 0.92, M.painted);
      collide(10.68, x0, 5.45, 8.55, 'snack-counter');
      collide(x0, x1, z0, z1, 'snack-stand');
      // the awning reaching over the street, and its striped valance
      // lies flat, then tilts down toward the street (12 cm per 40 cm)
      const aw = plane(1.16, 3.6, 10.45, 2.6, 7.0, M.stripes); aw.rotation.order = 'ZYX'; aw.rotation.set(-Math.PI / 2, 0, 0.27);
      const val = plane(3.6, 0.32, 9.82, 2.32, 7.0, M.stripes, -Math.PI / 2); val.userData.keep = true;
      for (const z of [5.25, 8.75]) block(9.8, 9.86, z - 0.03, z + 0.03, 2.3, 2.5, M.metal);
      sign('snack', 4.4, 0.75, 10.94, 3.0, 7.0, -Math.PI / 2);
      sign('menu', 0.42, 0.52, 10.95, 1.72, 8.82, -Math.PI / 2);
      sign('hours', 0.9, 0.28, 13.4, 1.65, 4.94, Math.PI);                           // to the junction
      sign('snack', 3.4, 0.58, 14.0, 2.75, 4.94, Math.PI);
      // the back: a door, a vent hood, a crate
      block(x1, x1 + 0.06, 6.6, 7.6, 0, 2.05, M.black); block(x1, x1 + 0.12, 6.5, 7.7, 2.05, 2.15, M.trim);
      block(x1, x1 + 0.45, 7.95, 8.6, 2.1, 2.55, M.painted);
      // a bin outside the junction face
      cyl(0.32, 0.9, 16.2, 0.45, 4.55, M.painted, 12); collide(15.85, 16.55, 4.2, 4.95, 'snack-bin');
    }

    // ------------------------------------------------------------------ S2: the kitchen block between the alleys
    {
      const x0 = 21.2, x1 = 27.2, z0 = 4.6, z1 = 20.5, h = 4.2;
      block(x0, x1, z0, z1, 0, h, M.plaster);
      block(x0 - 0.25, x1 + 0.25, z0 - 0.25, z1 + 0.25, h, h + 0.3, M.roof);
      block(x0 + 0.2, x1 - 0.2, z0 + 0.2, z1 - 0.2, h + 0.3, h + 0.75, M.peel);     // plant room on the roof
      collide(x0, x1, z0, z1, 'kitchen');
      // west face (the narrow back alley): back door + green exit sign, loading shutter, pipes, AC, gas cage
      block(x0 - 0.06, x0, 16.4, 17.5, 0, 2.1, M.black); block(x0 - 0.12, x0, 16.3, 17.6, 2.1, 2.2, M.trim);
      plane(0.62, 0.27, x0 - 0.13, 2.45, 16.95, M.exit, -Math.PI / 2);
      block(x0 - 0.08, x0, 9.2, 12.2, 0, 2.85, M.shutter); block(x0 - 0.2, x0, 9.05, 12.35, 2.85, 3.15, M.painted);
      for (const z of [6.0, 13.2, 19.4]) cyl(0.07, h, x0 - 0.12, h / 2, z, M.rust, 8);
      block(x0 - 0.12, x0, 5.0, 20.1, 3.55, 3.65, M.rust);
      block(20.25, x0, 13.05, 14.35, 0.1, 1.05, M.painted); block(20.22, 20.26, 13.15, 14.25, 0.2, 0.95, M.black);
      collide(20.2, x0, 13.0, 14.4, 'ac-unit');
      for (const [x, z] of [[20.4, 7.3], [20.75, 7.75], [20.4, 8.25]]) cyl(0.16, 1.3, x, 0.65, z, M.rust, 10);
      for (const z of [7.0, 8.6]) block(20.1, x0, z - 0.02, z + 0.02, 0, 1.6, M.metal);
      block(20.1, 20.14, 7.0, 8.6, 0.05, 1.6, M.fence);
      collide(20.1, x0, 7.0, 8.6, 'gas-cage');
      sign('fire', 0.5, 0.25, 20.08, 1.85, 7.8, -Math.PI / 2);
      sign('kitchen', 2.6, 0.4, x0 - 0.02, 3.2, 14.6, -Math.PI / 2);
      // south face (the yard): the big loading shutter and the kitchen name
      block(22.0, 26.4, z1, z1 + 0.08, 0, 3.0, M.shutter); block(21.85, 26.55, z1, z1 + 0.22, 3.0, 3.3, M.painted);
      sign('kitchen', 3.6, 0.56, 24.2, 3.7, z1 + 0.02, 0);
      // east face (the storage alley): a door and a hose reel; north face (the junction lane): vents
      block(x1, x1 + 0.06, 11.0, 12.0, 0, 2.05, M.black); sign('staff', 0.8, 0.24, x1 + 0.03, 2.35, 11.5, Math.PI / 2);
      cyl(0.32, 0.12, x1 + 0.08, 1.2, 15.5, M.cone, 14, [0, 0, Math.PI / 2]);
      for (const x of [22.4, 24.2, 26.0]) block(x - 0.45, x + 0.45, z0 - 0.08, z0, 2.4, 3.0, M.black);
      sign('kitchen', 2.4, 0.38, 24.2, 3.55, z0 - 0.02, Math.PI);
    }

    // ------------------------------------------------------------------ S3: the storage shed against the east wall
    {
      const x0 = 32.6, x1 = 37.5, z0 = 10.5, z1 = 22.0, h = 3.4;
      block(x0, x1, z0, z1, 0, h, M.corr);
      block(x0 - 0.3, x1, z0 - 0.3, z1 + 0.3, h, h + 0.2, M.roof);
      collide(x0, x1, z0, z1, 'storage');
      block(x0 - 0.08, x0, 13.2, 18.2, 0, 2.9, M.corr); block(x0 - 0.16, x0, 13.0, 18.4, 2.9, 3.0, M.black);   // sliding door
      for (const z of [15.55, 15.85]) block(x0 - 0.14, x0 - 0.08, z - 0.03, z + 0.03, 1.0, 1.3, M.black);
      for (let i = 0; i < 9; i++) { const t = i / 8; box(0.03, 0.06, 0.1, x0 - 0.18, 1.18 - Math.sin(t * Math.PI) * 0.18, 15.45 + t * 0.5, M.rust); }   // chain
      box(0.06, 0.1, 0.08, x0 - 0.22, 0.98, 15.7, M.trim);   // padlock
      sign('storage', 1.3, 1.3, x0 - 0.02, 2.0, 20.4, -Math.PI / 2);
      sign('storage', 1.3, 1.3, 35.0, 2.0, z1 + 0.02, 0);
      sign('fire', 0.5, 0.25, x0 - 0.02, 2.0, 11.6, -Math.PI / 2);
    }

    // ------------------------------------------------------------------ the delivery truck in the yard
    const truckHalos = [];
    {
      const x0 = 24.5, x1 = 31.3, z0 = 25.6, z1 = 28.2, zc = (z0 + z1) / 2;
      block(x0 + 0.2, x1 - 0.2, z0 + 0.3, z1 - 0.3, 0.45, 0.7, M.black);                          // chassis
      block(x0, 29.4, z0, z1, 0.7, 3.3, M.corrTruck);                                             // cargo box
      block(x0 - 0.04, x0, z0 + 0.05, z1 - 0.05, 0.75, 3.25, M.painted);                         // rear doors
      for (const z of [zc - 0.55, zc + 0.55]) block(x0 - 0.08, x0 - 0.04, z - 0.03, z + 0.03, 0.9, 3.1, M.metal);
      block(29.45, x1, z0 + 0.05, z1 - 0.05, 0.6, 2.6, M.cream);                                 // cab
      block(31.25, 31.32, z0 + 0.25, z1 - 0.25, 1.6, 2.45, M.glass);                             // windscreen
      for (const z of [z0 + 0.02, z1 - 0.02]) block(29.8, 30.9, z - 0.03, z + 0.03, 1.6, 2.35, M.glass);
      block(x1, x1 + 0.12, z0 + 0.1, z1 - 0.1, 0.5, 0.8, M.black);                              // bumper
      for (const x of [25.5, 28.5, 30.6]) for (const z of [z0 + 0.12, z1 - 0.12]) cyl(0.45, 0.32, x, 0.45, z, M.tyre, 14, [Math.PI / 2, 0, 0]);
      sign('livery', 4.4, 1.35, 26.95, 2.05, z1 + 0.01, 0);
      sign('livery', 4.4, 1.35, 26.95, 2.05, z0 - 0.01, Math.PI);
      collide(x0 - 0.1, x1 + 0.12, z0, z1, 'truck');
      // marker lamps (they blink slowly; the truck was left with its hazards on)
      for (const [x, z] of [[x0 + 0.05, z0 + 0.2], [x0 + 0.05, z1 - 0.2], [x1 + 0.1, z0 + 0.3], [x1 + 0.1, z1 - 0.3]]) box(0.06, 0.1, 0.16, x, x < 30 ? 3.15 : 0.9, z, M.amber, null, live);
      truckHalos.push(halo(0.9, x0 - 0.1, 3.15, z0 + 0.2, '#ffae42', 0.0), halo(0.9, x0 - 0.1, 3.15, z1 - 0.2, '#ffae42', 0.0));
    }

    // ------------------------------------------------------------------ clutter (each is solid)
    const pallet = (x, z, y) => { block(x - 0.6, x + 0.6, z - 0.5, z + 0.5, y, y + 0.03, M.wood); for (const dz of [-0.42, 0, 0.42]) block(x - 0.6, x + 0.6, z + dz - 0.06, z + dz + 0.06, y + 0.03, y + 0.14, M.wood); block(x - 0.6, x + 0.6, z - 0.5, z + 0.5, y + 0.14, y + 0.17, M.wood); };
    const crate = (x, z, s, y = 0) => block(x - s / 2, x + s / 2, z - s / 2, z + s / 2, y, y + s, M.wood);
    // pallets by the yard gate
    for (let i = 0; i < 4; i++) pallet(13.8, 31.5, i * 0.18);
    crate(13.6, 31.3, 0.6, 0.72); collide(13.0, 14.6, 30.8, 32.15, 'pallets');
    // roll cages
    for (const [x, z] of [[18.75, 24.6], [19.3, 24.6]]) {
      for (const dx of [-0.25, 0.25]) for (const dz of [-0.5, 0.5]) block(x + dx - 0.015, x + dx + 0.015, z + dz - 0.015, z + dz + 0.015, 0.1, 1.7, M.metal);
      for (const y of [0.15, 0.9, 1.68]) block(x - 0.26, x + 0.26, z - 0.51, z + 0.51, y, y + 0.03, M.metal);
      block(x - 0.2, x + 0.2, z - 0.4, z + 0.3, 0.18, 0.85, M.cream);
    }
    collide(18.4, 19.6, 24.0, 25.2, 'cages');
    // dumpster with its lid propped open
    { block(34.45, 36.85, 25.05, 26.65, 0.15, 1.35, M.painted); const lid = box(2.4, 0.06, 1.6, 35.65, 1.55, 25.6, M.black); lid.rotation.x = -0.45;
      for (const x of [34.7, 36.6]) for (const z of [25.25, 26.45]) cyl(0.1, 0.1, x, 0.1, z, M.tyre, 8, [Math.PI / 2, 0, 0]);
      collide(34.4, 36.9, 25.0, 26.7, 'dumpster'); }
    crate(33.0, 22.6, 0.9); crate(33.55, 22.55, 0.6, 0.9); collide(32.55, 34.0, 22.0, 23.15, 'crates-shed');
    // the back alley: a stack of crates, chairs in the side lot, drums and a cart in the storage alley
    crate(17.85, 18.85, 0.95); crate(17.75, 18.75, 0.6, 0.95); block(17.25, 18.45, 18.25, 19.45, 0, 0.3, M.cream); collide(17.2, 18.5, 18.2, 19.5, 'crates-alley');
    for (let i = 0; i < 7; i++) { const y = i * 0.11; block(15.7, 16.9, 12.75, 14.45, y + 0.45, y + 0.5, M.painted); }
    for (const x of [15.75, 16.85]) for (const z of [12.8, 14.4]) block(x - 0.02, x + 0.02, z - 0.02, z + 0.02, 0, 1.22, M.metal);
    collide(15.6, 17.0, 12.6, 14.6, 'chairs');
    for (const [x, z] of [[27.85, 14.35], [28.1, 14.95]]) cyl(0.29, 0.9, x, 0.45, z, M.rust, 12);
    collide(27.5, 28.5, 14.0, 15.3, 'drums');
    { // electric cart
      const x = 30.6, z0 = 17.9, z1 = 20.5;
      block(x - 0.55, x + 0.55, z0, z1, 0.3, 0.75, M.cream); block(x - 0.5, x + 0.5, z0 + 0.9, z0 + 1.5, 0.75, 1.05, M.black);
      block(x - 0.5, x + 0.5, z0 + 0.95, z0 + 1.05, 1.05, 1.5, M.black);
      for (const z of [z0 + 0.05, z1 - 0.9]) for (const dx of [-0.5, 0.5]) block(x + dx - 0.02, x + dx + 0.02, z - 0.02, z + 0.02, 0.75, 1.95, M.metal);
      block(x - 0.6, x + 0.6, z0 - 0.05, z1 - 0.8, 1.95, 2.0, M.roof);
      for (const z of [z0 + 0.35, z1 - 0.35]) for (const dx of [-0.55, 0.55]) cyl(0.22, 0.14, x + dx, 0.22, z, M.tyre, 10, [0, 0, Math.PI / 2]);
      collide(30.0, 31.2, 17.85, 20.6, 'cart');
    }
    // the dock: pallets beside the existing cover crate; cones
    for (let i = 0; i < 3; i++) pallet(34.5, 2.9, i * 0.18); crate(34.4, 2.8, 0.7, 0.54); collide(33.6, 35.4, 2.2, 3.6, 'dock-pallets');
    const cone = (x, z) => { cyl(0.04, 0.6, x, 0.32, z, M.cone, 10, null, statics, 0.17); block(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, 0.04, M.black); collide(x - 0.22, x + 0.22, z - 0.22, z + 0.22, 'cone'); };
    cone(24.0, 24.9); cone(31.9, 24.9); cone(31.9, 28.9); cone(17.4, 21.0);

    // ------------------------------------------------------------------ MAIN STREET dressing
    // the popcorn cart, shut
    {
      const x = -7.9, z = 12.5;
      block(x - 0.7, x + 0.7, z - 0.45, z + 0.45, 0.35, 1.05, M.painted); block(x - 0.62, x + 0.62, z - 0.38, z + 0.38, 1.05, 1.75, M.glass);
      for (const dx of [-0.66, 0.66]) block(x + dx - 0.02, x + dx + 0.02, z - 0.02, z + 0.02, 1.05, 2.25, M.metal);
      const roof = plane(1.6, 1.1, x, 2.3, z, M.stripes, 0, -Math.PI / 2); roof.userData.keep = true;
      for (const dx of [-0.5, 0.5]) cyl(0.22, 0.08, x + dx, 0.22, z + 0.48, M.tyre, 12, [0, 0, Math.PI / 2]);
      collide(-8.6, -7.2, 12.0, 13.0, 'popcorn');
    }
    // hedges in planters: they cut the long view down the street into pieces
    const hedge = (x0, x1, z0, z1) => {
      block(x0, x1, z0, z1, 0, 0.5, M.concrete);
      const n = Math.max(2, Math.round((x1 - x0) / 0.7)), r = rng(Math.round(x0 * 100 + z0));
      for (let i = 0; i < n; i++) { const m = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), M.leaf); m.position.set(x0 + ((i + 0.5) * (x1 - x0)) / n, 0.85 + r() * 0.12, (z0 + z1) / 2); m.scale.set(0.85, 0.7 + r() * 0.2, 0.75); statics.add(m); }
      collide(x0, x1, z0, z1, 'hedge');
    };
    hedge(-6.4, -4.0, 18.6, 19.5); hedge(3.6, 6.0, 13.0, 13.9);
    // two dying street lamps
    const lampHeads = [];
    const lamp = (x, z, mat, armDir) => {
      cyl(0.07, 4.4, x, 2.2, z, M.black, 8); cyl(0.16, 0.3, x, 0.15, z, M.black, 10);
      block(x, x + armDir * 0.9, z - 0.03, z + 0.03, 4.28, 4.34, M.black);
      box(0.42, 0.14, 0.26, x + armDir * 0.9, 4.2, z, M.black);
      box(0.34, 0.04, 0.2, x + armDir * 0.9, 4.12, z, mat, null, live);
      collide(x - 0.12, x + 0.12, z - 0.12, z + 0.12, 'lamp');
      lampHeads.push({ mat, pool: glowPool(6.5, 6.5, x + armDir * 0.9, z, '#f6c27a', 0.12), halo: halo(1.6, x + armDir * 0.9, 4.05, z, '#f6c27a', 0.3) });
    };
    lamp(8.9, 18.6, M.sodium, -1); lamp(-8.9, 9.6, M.sodium2, 1);
    // the old guide board
    {
      const x = -7.7, z = 6.8;
      for (const dx of [-0.85, 0.85]) block(x + dx - 0.04, x + dx + 0.04, z - 0.04, z + 0.04, 0, 2.3, M.black);
      block(x - 0.98, x + 0.98, z - 0.05, z + 0.05, 0.9, 2.2, M.painted);
      sign('guide', 1.86, 1.22, x, 1.55, z + 0.06, 0);
      collide(x - 0.95, x + 0.95, z - 0.12, z + 0.12, 'guide-board');
    }
    // the park's own banner over the north end of the street ("A MILLION LITTLE STARS", z = 8) gets a string of
    // bulbs along its top edge, a few dead or failing: it is what you see first, far ahead, from the gate
    const bulbs = [];
    {
      const z = 7.94, n = 24, r = rng(611), bulbGeo = new T.SphereGeometry(0.07, 8, 6);
      for (let i = 0; i < n; i++) {
        const x = -7.3 + (14.6 * i) / (n - 1), y = 4.5 + 0.75 - 0.65 * (1 - (x / 7.5) ** 2) + 0.1;
        const dead = r() < 0.22, flick = !dead && r() < 0.22;
        const m = new T.Mesh(bulbGeo, dead ? M.bulbDead : flick ? new T.MeshBasicMaterial({ color: new T.Color('#ffe2a8') }) : M.bulb);
        m.position.set(x, y, z); live.add(m); if (flick) bulbs.push({ m, rate: 3 + r() * 9, ph: r() * 6 });
      }
      block(-7.4, 7.4, z - 0.012, z + 0.012, 5.2, 5.23, M.black);
      glowPool(15, 4.5, 0, 8.4, '#ffe2a8', 0.07);
    }

    // ------------------------------------------------------------------ BACK ALLEY / SERVICE YARD lights
    const tubes = [];
    const tube = (x, y, z, ry, mat, poolAt, seed) => {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; live.add(g);
      box(1.3, 0.1, 0.16, 0, 0, 0, M.black, null, g); box(1.2, 0.05, 0.08, 0, -0.06, 0.02, mat, null, g);
      tubes.push({ mat, seed, pool: glowPool(5.2, 5.2, poolAt[0], poolAt[1], '#dff3ea', 0.1), halo: halo(1.5, x, y - 0.1, z, '#e4f6ee', 0.22) });
    };
    tube(24.2, 3.35, 20.75, 0, M.tube, [24.2, 22.4], 1.7);           // over the kitchen shutter (yard)
    tube(21.05, 2.75, 11.5, Math.PI / 2, M.tube2, [19.3, 11.5], 4.3); // caged lamp in the back alley
    box(0.12, 0.34, 1.0, 21.08, 2.75, 11.5, M.metal);                   // the cage over it (static)
    glowPool(2.0, 2.0, 20.4, 16.95, '#38ff7a', 0.08);                  // under the green exit sign
    // the storage shed's red warning lamp
    const redLamp = box(0.14, 0.14, 0.14, 32.5, 2.75, 12.6, M.redLamp, null, live);
    box(0.2, 0.06, 0.2, 32.5, 2.86, 12.6, M.black);
    const redPool = glowPool(3.2, 3.2, 31.6, 12.6, '#ff3a24', 0.09), redHalo = halo(0.8, 32.45, 2.75, 12.6, '#ff3a24', 0.35);

    // ------------------------------------------------------------------ JUNCTION: red revolving beacon and the sign on
    const beacon = {};
    {
      const x = 14.0, z = 1.5;   // against the back wall of the arcade: the lane stays clear for the chase
      cyl(0.08, 4.6, x, 2.3, z, M.black, 10); cyl(0.22, 0.3, x, 0.15, z, M.black, 10);
      cyl(0.17, 0.08, x, 4.62, z, M.black, 12);
      beacon.body = cyl(0.14, 0.26, x, 4.79, z, M.beacon, 12, null, live);
      cyl(0.16, 0.05, x, 4.95, z, M.black, 12);
      const sg = plane(2.1, 0.6, x, 2.85, z + 0.06, M.junction, 0); sg.userData.keep = true;
      const sb = plane(2.1, 0.6, x, 2.85, z - 0.06, M.junction, Math.PI); sb.userData.keep = true;
      block(x - 1.08, x + 1.08, z - 0.04, z + 0.04, 2.52, 2.55, M.black); block(x - 1.08, x + 1.08, z - 0.04, z + 0.04, 3.15, 3.18, M.black);
      collide(x - 0.18, x + 0.18, z - 0.18, z + 0.18, 'junction-post');
      // two beams turning on the pole: additive planes with the glow texture stretched out
      beacon.spin = new T.Group(); beacon.spin.position.set(x, 4.79, z); live.add(beacon.spin);
      const beamMat = glowMat('#ff3a24', 0.0); beacon.beamMat = beamMat;
      for (const s of [1, -1]) { const b = new T.Mesh(new T.PlaneGeometry(4.2, 0.9), beamMat); b.position.set(s * 2.1, 0, 0); b.rotation.x = Math.PI / 2; beacon.spin.add(b); const b2 = new T.Mesh(new T.PlaneGeometry(4.2, 0.9), beamMat); b2.position.set(s * 2.1, 0, 0); beacon.spin.add(b2); }
      beacon.pool = glowPool(9, 9, x, z, '#ff3a24', 0.06); beacon.halo = halo(1.6, x, 4.79, z, '#ff3a24', 0.4);
      beacon.signPool = glowPool(3.2, 2.0, x, z + 1.2, '#fff1d0', 0.06);
    }

    mergeStatics(T, statics);

    // ------------------------------------------------------------------ the rest of the game learns about the new ground
    world.collisionRevision = (world.collisionRevision || 0) + 1;
    // HUD place names: each part has its own, so the player can tell where they are in the dark
    const inDistrict = (p) => p.x > D.x0 - 0.01 && p.x < D.x1 && p.z > D.z0 && p.z < D.z1;
    const placeOf = (p) => {
      if (inDistrict(p)) return p.z < 5.2 && p.x < 18.2 ? 'JUNCTION' : p.z > 23.4 ? 'SERVICE YARD' : 'BACK ALLEY';
      if (p.x > -11 && p.x < 11 && p.z > 3 && p.z < 24.5) return 'MAIN STREET';
      return null;
    };
    if (typeof world.region === 'function') {
      const region = world.region.bind(world);
      world.region = (p) => placeOf(p) || region(p);
    }
    // the clown patrols the new ground too (and drops any waypoint a new wall now covers)
    const fitStalker = () => {
      const st = story && story.director && story.director.stalker;
      if (!st || !Array.isArray(st.points) || st.__district) return !!st;
      st.points = st.points.filter((q) => world.isFree(q[0], q[1], 0.45));
      for (const q of [[24.5, 31.8], [19.1, 15.6], [29.4, 11.2], [14.2, 11.0], [33.2, 7.6], [19.4, 21.6], [16.0, 26.4]]) if (world.isFree(q[0], q[1], 0.45)) st.points.push(q);
      if (st.nav) st.nav.revision = -1;
      st.__district = true; return true;
    };
    fitStalker();
    // the last chase: the hint names the right way out of the back alley
    const fitHint = () => {
      const s = story && story.ah14 && story.ah14.story;
      if (!s || typeof s.escapeHint !== 'function' || s.__district) return !!s;
      const hint = s.escapeHint.bind(s);
      s.escapeHint = () => (host.player && inDistrict(host.player.position) ? '3 / 3 — 走れ！ 北の合流地点から広場へ出て、西の非常通路を南の出口ゲートへ！' : hint());
      s.__district = true; return true;
    };
    fitHint();

    // ------------------------------------------------------------------ lights and life
    const stutter = (clock, seed, rate) => { const v = Math.sin(clock * rate + seed) * Math.sin(clock * rate * 2.71 + seed * 3.1); return v > 0.93 ? 0 : 1; };
    const tmp = new T.Vector3();
    let clock = 0;
    const update = (dt) => {
      clock += dt;
      const cam = host.camera && host.camera.position;
      if (cam) {
        const d = Math.hypot(cam.x - 14, cam.z - 20);
        root.visible = d < 95;
        for (const h of halos) h.quaternion.copy(host.camera.quaternion);
      }
      if (!oldFenceGone && clock < 20 && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) removeOldFence();
      if (clock < 30 && Math.floor(clock) !== Math.floor(clock - dt)) { fitStalker(); fitHint(); }
      // branch square lantern: steady, breathing a little
      const lan = 0.92 + Math.sin(clock * 1.3) * 0.05;
      M.lantern.color.setRGB(1.0 * lan, 0.85 * lan, 0.63 * lan);
      // dying sodium lamps: one stutters, one fades out for seconds at a time
      const a = stutter(clock, 2.1, 2.7) * (Math.sin(clock * 0.31) > 0.94 ? 0.25 : 1);
      const b = Math.max(0.05, Math.min(1, 0.55 + Math.sin(clock * 0.23 + 1) * 0.9)) * stutter(clock, 6.3, 5.1);
      [a, b].forEach((k, i) => { const L = lampHeads[i]; L.mat.color.setRGB(0.96 * k + 0.08, 0.76 * k + 0.07, 0.48 * k + 0.05); L.pool.material.opacity = 0.12 * k; L.halo.material.opacity = 0.3 * k; });
      for (const B of bulbs) B.m.material.color.set(Math.sin(clock * B.rate + B.ph) * Math.sin(clock * B.rate * 0.37 + B.ph) > -0.2 ? '#ffe2a8' : '#4a4438');
      // fluorescent tubes: a buzz and a stutter; the alley one goes out now and then
      tubes.forEach((t, i) => {
        let k = (0.9 + Math.sin(clock * 50 + i) * 0.05) * stutter(clock, t.seed, 3.3 + i);
        if (i === 1 && Math.sin(clock * 0.21 + 2) > 0.9) k *= Math.sin(clock * 31) > 0.3 ? 0.9 : 0.05;
        t.mat.color.setRGB(0.12 + 0.78 * k, 0.14 + 0.82 * k, 0.13 + 0.8 * k); t.pool.material.opacity = 0.1 * k; t.halo.material.opacity = 0.22 * k;
      });
      // truck hazards
      const hz = Math.sin(clock * 3.2) > 0.35 ? 1 : 0.08;
      M.amber.color.setRGB(1.0 * hz, 0.68 * hz, 0.26 * hz);
      for (const h of truckHalos) h.material.opacity = 0.35 * hz;
      // storage shed warning lamp: slow pulse
      const rp = 0.55 + 0.45 * Math.sin(clock * 2.0);
      M.redLamp.color.setRGB(1.0 * rp + 0.15, 0.23 * rp, 0.14 * rp); redPool.material.opacity = 0.09 * rp; redHalo.material.opacity = 0.35 * rp;
      // junction beacon: revolving
      beacon.spin.rotation.y = clock * 3.6;
      const face = cam ? Math.cos(Math.atan2(cam.z - 1.5, cam.x - 14) + beacon.spin.rotation.y) : 0;
      beacon.beamMat.opacity = 0.16;
      beacon.halo.material.opacity = 0.25 + 0.35 * Math.max(0, face);
      beacon.pool.material.opacity = 0.05 + 0.03 * Math.sin(clock * 3.6 * 2);
      M.beacon.color.setRGB(1.0, 0.16 + 0.1 * Math.max(0, face), 0.09);
    };
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      if (window.__ahStageRouter && window.__ahStageRouter.active) { root.visible = false; return; }
      update(dt);
    };
    requestAnimationFrame(frame);

    const api = {
      bounds: D, colliders, yardGate: YARD_GATE, sideGate: SIDE_GATE, placeOf, T,
      get oldFenceRemoved() { return oldFenceGone; },
      update: (dt) => update(dt),
    };
    world.entranceDistrict = api;
    if (verify) window.__ahEntranceDistrict = api;
  }

  // Merge static meshes that share a material into one mesh per material (positions/normals/uvs baked).
  function mergeStatics(T, group) {
    group.updateMatrixWorld(true);
    const byMat = new Map();
    group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(o);
    });
    const inv = new T.Matrix4().copy(group.matrixWorld).invert();
    const nm = new T.Matrix3();
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      let vCount = 0, iCount = 0;
      for (const m of list) { const g = m.geometry; vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
      const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
      let vo = 0, io = 0;
      const v = new T.Vector3(), n = new T.Vector3(), mtx = new T.Matrix4();
      for (const m of list) {
        const g = m.geometry;
        mtx.multiplyMatrices(inv, m.matrixWorld); nm.getNormalMatrix(mtx);
        const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(mtx); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          if (N) { n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = n.x; nor[(vo + i) * 3 + 1] = n.y; nor[(vo + i) * 3 + 2] = n.z; }
          if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
        else for (let i = 0; i < P.count; i++) idx[io + i] = vo + i;
        io += g.index ? g.index.count : P.count; vo += P.count;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geo.setIndex(new T.BufferAttribute(idx, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const merged = new T.Mesh(geo, mat);
      merged.renderOrder = list[0].renderOrder;
      for (const m of list) m.parent.remove(m);
      group.add(merged);
    }
  }
})();
