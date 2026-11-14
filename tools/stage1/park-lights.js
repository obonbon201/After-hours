
/* Stage 1 park lights after the power comes back (the distribution lever / turning point).
 *
 *  - Old street lamps from the gate along the main street and round the park: a dull honey light (#D6A46F) in the
 *    lamp head, a soft halo and a pool on the paving; dark stretches stay between them, the next lamp is in view.
 *  - Shop and building entrances: a small fixture above the door in a yellowish milk-white (#D8C8A8) that washes the
 *    door, its handle and the bottom edge of the sign, leaving the shutter and eaves in shadow.
 *  - The attraction signs keep a sparse row of small old bulbs, dull red (#A85548) and blue-green (#527B75), a few
 *    of them dead; the colour only bleeds round each bulb.
 *  - Back alleys, hedges and the perimeter stay dark (only the loading gate gets a weak lamp at the branch); the
 *    ambient light leans a little toward a dark blue-grey (#343E4A) so shadows read as night, not black.
 *
 * Everything is drawn with unlit glow geometry (no extra real lights, so no shader recompiles and no per-pixel
 * cost on phones), batched into a handful of draw calls. When the power comes on the lamps near the player light
 * first, then the farther ones, then the sign bulbs, each with a short start-up flicker, and then stay steady.
 * They dim with the red emergency state and go out during blackouts (world.parkFade from the stage lighting). */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { install(host); } catch (e) { console.warn('[park-lights]', e); }
    return result;
  };

  const HONEY = '#D6A46F', MILK = '#D8C8A8', RED = '#A85548', TEAL = '#527B75';
  const STREET = [[-5.6, 34], [5.6, 34], [-8, 17], [8, 2], [-12, -9], [12, -23], [23, -29], [40, -51], [-23, -36], [-23, -14], [-23, 13], [-23, 37]];
  // entrance: wall face point, outward normal, fixture height, wash width / height
  const ENTRIES = [
    { x: -9.81, z: 21.6, nx: 1, nz: 0, y: 2.45, w: 1.8, h: 2.7 },     // maintenance room staff door
    { x: -16, z: -4.28, nx: 0, nz: 1, y: 2.7, w: 3.0, h: 2.8 },       // REFRESHMENTS shutter
    { x: 17.84, z: -12, nx: -1, nz: 0, y: 2.5, w: 3.6, h: 2.9 },      // STARCADE doors
    { x: 29, z: -31.84, nx: 0, nz: 1, y: 2.7, w: 3.4, h: 3.0 },       // MIRROR HOUSE doors
    { x: -8, z: 41.52, nx: 0, nz: 1, y: 2.6, w: 2.6, h: 2.7 },        // ticket office (outside the gate)
    { x: 14, z: 23.42, nx: 0, nz: 1, y: 2.7, w: 3.0, h: 2.8 },        // restrooms (service yard side)
    { x: 10.96, z: 7, nx: -1, nz: 0, y: 2.25, w: 3.0, h: 2.3 },       // STAR SNACK stand on the main street
  ];
  // sign bulb rows: start, end, count
  const SIGNS = [
    { a: [17.66, 3.93, -15.4], b: [17.66, 3.93, -8.6], n: 9, dead: [3, 7] },    // STARCADE
    { a: [24.6, 4.23, -31.66], b: [33.4, 4.23, -31.66], n: 9, dead: [2, 6] },   // MIRROR HOUSE
    { a: [-2.2, 3.88, -3.42], b: [2.2, 3.88, -3.42], n: 7, dead: [4] },        // CAROUSEL
  ];
  const ALLEY = [{ x: 11.0, y: 2.9, z: 30.6, pool: [[12.3, 30.6], [9.7, 30.6]] }];   // a weak lamp on the loading gate header

  function install(host) {
    const T = host.THREE, world = host.world, story = host.story;
    if (!T || !world || !story || world.parkLights) return;
    const scene = host.scene || world.scene;
    const root = new T.Group(); root.name = 'park-lights'; scene.add(root);
    const col = (hex, k = 1) => { const c = new T.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

    // ------------------------------------------------------------------ textures
    const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); return t; };
    const glowTex = canvasTex(128, 128, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(0.6, 'rgba(255,255,255,.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    const poolTex = canvasTex(128, 128, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.62)'); r.addColorStop(0.7, 'rgba(255,255,255,.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    // a wash on a wall: brightest just under the fixture at the top, fading down and to the sides
    const washTex = canvasTex(128, 128, (g, w) => {
      g.save(); g.scale(1, 1.25);
      const r = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, w * 0.82);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.6)'); r.addColorStop(0.7, 'rgba(255,255,255,.16)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w); g.restore();
    });

    // ------------------------------------------------------------------ batches (vertex colours carry each fixture's level)
    class Batch {
      constructor() { this.pos = []; this.uv = []; this.idx = []; this.base = []; this.fix = []; this.n = 0; }
      add(geo, fixture, rgb) {
        const g = geo.index ? geo : geo;
        const p = g.attributes.position, uv = g.attributes.uv, off = this.n;
        for (let i = 0; i < p.count; i++) {
          this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
          this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          this.base.push(rgb[0], rgb[1], rgb[2]); this.fix.push(fixture);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(off + g.index.getX(i));
        else for (let i = 0; i < p.count; i++) this.idx.push(off + i);
        this.n += p.count;
      }
      point(x, y, z, fixture, rgb) { this.pos.push(x, y, z); this.base.push(rgb[0], rgb[1], rgb[2]); this.fix.push(fixture); this.n++; }
      geometry(points) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
        if (!points) { g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.setIndex(this.idx); }
        this.color = new T.Float32BufferAttribute(new Float32Array(this.n * 3), 3);
        this.color.setUsage(T.DynamicDrawUsage || 35048);
        g.setAttribute('color', this.color);
        g.computeBoundingSphere();
        return g;
      }
      apply(levels, floor = 0) {
        if (!this.color) return;
        const a = this.color.array;
        for (let v = 0; v < this.n; v++) { const k = Math.max(floor, levels[this.fix[v]]); a[v * 3] = this.base[v * 3] * k; a[v * 3 + 1] = this.base[v * 3 + 1] * k; a[v * 3 + 2] = this.base[v * 3 + 2] * k; }
        this.color.needsUpdate = true;
      }
    }
    const pools = new Batch(), washes = new Batch(), heads = new Batch(), bulbsB = new Batch();
    const haloL = new Batch(), haloM = new Batch(), haloS = new Batch();
    const fixtures = [];   // { kind, x, z, level, start }
    const addFixture = (kind, x, z) => { fixtures.push({ kind, x, z, level: 0, start: -1 }); return fixtures.length - 1; };
    const flat = (r, x, z, y = 0.086) => { const g = new T.PlaneGeometry(r * 2, r * 2); g.rotateX(-Math.PI / 2); g.translate(x, y, z); return g; };

    // street lamps
    for (const [x, z] of STREET) {
      const f = addFixture('street', x, z);
      pools.add(flat(5.0, x, z), f, col(HONEY, 0.55));
      const head = new T.CylinderGeometry(0.29, 0.29, 0.34, 12, 1); head.translate(x, 5.15, z); heads.add(head, f, col(HONEY, 1.0));
      haloL.point(x, 5.12, z, f, col(HONEY, 0.5));
    }
    // entrances
    const housingMat = new T.MeshStandardMaterial({ color: 0x2a2c2c, roughness: 0.6, metalness: 0.4 });
    const housings = [];
    for (const e of ENTRIES) {
      const f = addFixture('entry', e.x, e.z);
      const fx = e.x + e.nx * 0.22, fz = e.z + e.nz * 0.22;
      // housing on a short bracket
      const hg = new T.BoxGeometry(e.nx ? 0.3 : 0.26, 0.12, e.nx ? 0.26 : 0.3); hg.translate(e.x + e.nx * 0.15, e.y + 0.08, e.z + e.nz * 0.15); housings.push(hg);
      const bulb = new T.SphereGeometry(0.06, 10, 6); bulb.translate(fx, e.y - 0.02, fz); bulbsB.add(bulb, f, col(MILK, 1.0));
      haloM.point(fx, e.y - 0.04, fz, f, col(MILK, 0.42));
      // the wash on the door face
      const wg = new T.PlaneGeometry(e.w, e.h); wg.translate(0, -e.h / 2, 0);
      wg.rotateY(Math.atan2(e.nx, e.nz)); wg.translate(e.x + e.nx * 0.035, e.y + 0.05, e.z + e.nz * 0.035);
      washes.add(wg, f, col(MILK, 0.42));
      pools.add(flat(2.0, e.x + e.nx * 1.0, e.z + e.nz * 1.0, 0.088), f, col(MILK, 0.32));
    }
    if (housings.length) {
      const hm = new T.Mesh(mergeGeos(T, housings), housingMat); root.add(hm);
    }
    // weak lamp at the loading gate (the branch into the back alley)
    for (const a of ALLEY) {
      const f = addFixture('alley', a.x, a.z);
      const bulb = new T.SphereGeometry(0.05, 8, 6); bulb.translate(a.x, a.y, a.z); bulbsB.add(bulb, f, col(MILK, 0.8));
      haloM.point(a.x, a.y, a.z, f, col(MILK, 0.3));
      for (const [px, pz] of a.pool) pools.add(flat(2.3, px, pz, 0.089), f, col(MILK, 0.2));
    }
    // sign bulbs
    for (const s of SIGNS) {
      for (let i = 0; i < s.n; i++) {
        const k = s.n === 1 ? 0.5 : i / (s.n - 1);
        const x = s.a[0] + (s.b[0] - s.a[0]) * k, y = s.a[1] + (s.b[1] - s.a[1]) * k, z = s.a[2] + (s.b[2] - s.a[2]) * k;
        const dead = s.dead.includes(i), hex = i % 2 ? TEAL : RED;
        const f = addFixture(dead ? 'dead' : 'sign', x, z);
        const g = new T.SphereGeometry(0.065, 8, 6); g.translate(x, y, z); bulbsB.add(g, f, dead ? [0.07, 0.06, 0.05] : col(hex, 1.0));
        if (!dead) haloS.point(x, y, z, f, col(hex, 0.4));
      }
    }

    const additive = (map, extra = {}) => new T.MeshBasicMaterial({ map, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, ...extra });
    const poolMesh = new T.Mesh(pools.geometry(), additive(poolTex, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const washMesh = new T.Mesh(washes.geometry(), additive(washTex, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: T.DoubleSide }));
    const headMesh = new T.Mesh(heads.geometry(), new T.MeshBasicMaterial({ vertexColors: true }));
    const bulbMesh = new T.Mesh(bulbsB.geometry(), new T.MeshBasicMaterial({ vertexColors: true }));
    const pts = (b, size) => new T.Points(b.geometry(true), new T.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
    const halos = [pts(haloL, 1.5), pts(haloM, 0.8), pts(haloS, 0.5)];
    for (const m of [poolMesh, washMesh, headMesh, bulbMesh, ...halos]) { m.renderOrder = 2; m.frustumCulled = false; root.add(m); }
    headMesh.visible = false;

    // ------------------------------------------------------------------ power state and the start-up sequence
    const levels = new Float32Array(fixtures.length);
    const draw = (fade) => {
      const lv = levels.map((l) => l * fade);
      pools.apply(lv); washes.apply(lv); heads.apply(lv, 0.06); haloL.apply(lv); haloM.apply(lv); haloS.apply(lv);
      bulbsB.apply(lv, 0.07);   // a dead bulb still shows as dark glass
      headMesh.visible = lv.some((l) => l > 0);
    };
    draw(1);
    let powered = false, seqStart = -1, settled = false, lastFade = -1;
    const now = () => performance.now() / 1000;
    const powerOn = (instant) => {
      powered = true; settled = false;
      const p = host.player && host.player.position;
      const t0 = now();
      fixtures.forEach((f, i) => {
        if (f.kind === 'dead') { f.start = Infinity; return; }
        const d = p ? Math.hypot(f.x - p.x, f.z - p.z) : 20;
        const near = d < 20 ? 0.25 + d / 20 * 0.35 : 0.85 + Math.min(1.3, (d - 20) / 45);   // near lamps, then farther ones
        const sign = f.kind === 'sign' ? 2.3 + (i % 5) * 0.06 : 0;                        // signs last
        f.start = instant ? -100 : t0 + (sign || near) + ((i * 0.137) % 0.18);
      });
      seqStart = t0;
      if (instant) { fixtures.forEach((f, i) => { levels[i] = f.kind === 'dead' ? 0 : 1; }); settled = true; world.parkLit = 1; draw(fadeNow()); }
    };
    const fadeNow = () => (typeof world.parkFade === 'number' ? world.parkFade : 1);
    // start-up: a couple of blinks, then a quick warm-up to steady
    const ignite = (a) => (a < 0 ? 0 : a < 0.08 ? 0.7 : a < 0.16 ? 0.05 : a < 0.24 ? 0.55 : a < 0.3 ? 0.12 : Math.min(1, 0.55 + (a - 0.3) * 1.5));
    if (story.stage >= 2) powerOn(true);

    const tick = () => {
      requestAnimationFrame(tick);
      if (!powered) { if (story.stage >= 2) powerOn(story.tape && story.tape.active); return; }
      if (story.stage < 2) { powered = false; levels.fill(0); world.parkLit = 0; draw(1); return; }   // a new night
      const fade = fadeNow();
      if (!settled) {
        const t = now(); let all = true;
        fixtures.forEach((f, i) => { if (f.kind === 'dead') return; const l = ignite(t - f.start); levels[i] = l; if (l < 1) all = false; });
        world.parkLit = Math.min(1, (t - seqStart) / 3);
        draw(fade); lastFade = fade;
        if (all) { settled = true; world.parkLit = 1; }
        return;
      }
      if (Math.abs(fade - lastFade) > 0.015) { draw(fade); lastFade = fade; }
    };
    requestAnimationFrame(tick);
    world.parkLights = { fixtures, levels, powerOn, draw, root };
    if (/[?&]verify\b/.test(location.search)) window.__ahParkLights = world.parkLights;
  }

  function mergeGeos(T, geos) {
    const pos = [], nor = [], idx = []; let off = 0;
    for (const g0 of geos) {
      const g = g0.index ? g0 : g0;
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(off + g.index.getX(i)); else for (let i = 0; i < p.count; i++) idx.push(off + i);
      off += p.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setIndex(idx); out.computeBoundingSphere();
    return out;
  }
})();
