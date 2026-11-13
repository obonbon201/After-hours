
/* Stage 1 power restore (replaces the three fuse boxes and the carousel recovery panel):
 *  - two spare fuses lie in the park: on a crate in the corner of the service-yard car park just inside the
 *    loading gate, and on the bench behind the carousel; a note on a crate by the fuse box says where to look;
 *  - both go into the fuse box in the maintenance room;
 *  - the power comes back only when the distribution lever beside the fuse box is pulled (the old turning point:
 *    the carousel starts, the park wakes up and the night goes on as before).
 * Progress is kept in story.fuses ("fuse-yard", "fuse-bench" and "box" once installed), so it is saved and resumed
 * with the rest of the night. The fuses are a touch bright, with a red band, so they do not melt into the dark. */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { install(host); } catch (e) { console.warn('[power-restore]', e); }
    return result;
  };

  const PICKUPS = [
    // id, position of the fuse, its turn on the surface
    { id: 'fuse-yard', x: 11.33, y: 0.535, z: 39.43, ry: 0.6 },     // on a crate, corner of the car park by the loading gate
    { id: 'fuse-bench', x: 3.3, y: 0.607, z: -26.48, ry: -0.25 },   // on the seat of the bench behind the carousel
  ];
  const BOX = { x: -15.45, y: 1.4, z: 19 };                          // maintenance room fuse box (west wall)
  const LEVER = { x: -15.74, y: 1.42, z: 17.98 };                    // distribution lever, just left of the box
  const NEED = 2;

  function install(host) {
    const T = host.THREE, world = host.world, story = host.story;
    if (!T || !world || !story || world.powerRestore) return;
    const scene = host.scene || world.scene;
    const root = new T.Group(); root.name = 'power-restore'; scene.add(root);
    const std = (o) => new T.MeshStandardMaterial(o);

    // ---------------------------------------------------------------- fuse model (shared)
    const M = {
      body: std({ color: 0xf3ecd8, emissive: 0x4a4436, roughness: 0.45, metalness: 0 }),
      cap: std({ color: 0xe0c060, emissive: 0x3a2e10, roughness: 0.32, metalness: 0.55 }),
      band: std({ color: 0xd0261a, emissive: 0x4a0a06, roughness: 0.5, metalness: 0 }),
      wood: std({ color: 0x7a6040, roughness: 0.9, metalness: 0 }),
      woodDark: std({ color: 0x4a3a28, roughness: 0.95, metalness: 0 }),
      steel: std({ color: 0x8a9090, roughness: 0.45, metalness: 0.6 }),
      dark: std({ color: 0x1a1c1c, roughness: 0.7, metalness: 0.3 }),
      red: std({ color: 0xc81e14, emissive: 0x2a0402, roughness: 0.45, metalness: 0.1 }),
      plate: std({ color: 0xd8d2bc, roughness: 0.8, metalness: 0 }),
    };
    const gBody = new T.CylinderGeometry(0.03, 0.03, 0.17, 14);
    const gCap = new T.CylinderGeometry(0.034, 0.034, 0.04, 14);
    const gBand = new T.CylinderGeometry(0.0315, 0.0315, 0.055, 14);
    const makeFuse = () => {
      const g = new T.Group();
      const add = (geo, mat, y) => { const m = new T.Mesh(geo, mat); m.position.y = y; g.add(m); return m; };
      add(gBody, M.body, 0); add(gBand, M.band, 0); add(gCap, M.cap, 0.1); add(gCap, M.cap, -0.1);
      return g;
    };
    const lying = (g, x, y, z, ry) => { g.rotation.set(0, ry, Math.PI / 2, 'YXZ'); g.position.set(x, y, z); return g; };

    // ---------------------------------------------------------------- the two spare fuses
    const addCollider = (minX, maxX, minZ, maxZ, kind) => { const c = { minX, maxX, minZ, maxZ, kind }; world.colliders.push(c); return c; };
    // the crate in the car-park corner
    const crate = new T.Group();
    const box = (w, h, d, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); crate.add(m); return m; };
    box(0.5, 0.48, 0.5, M.wood, 0, 0.24, 0);
    for (const y of [0.08, 0.4]) { box(0.52, 0.05, 0.52, M.woodDark, 0, y, 0); }
    crate.position.set(11.33, 0, 39.43); crate.rotation.y = 0.08; root.add(crate);
    addCollider(11.07, 11.6, 39.17, 39.7, 'crate');

    const fuseMeshes = world.fuseMeshes || (world.fuseMeshes = {});
    const pickups = PICKUPS.map((p) => {
      const mesh = lying(makeFuse(), p.x, p.y, p.z, p.ry); root.add(mesh);
      fuseMeshes[p.id] = mesh;   // the game hides picked fuses itself when a save is resumed
      const target = world.target(p.id, 'ヒューズを拾う', p.x, p.y + 0.05, p.z);
      return { ...p, mesh, target };
    });

    // ---------------------------------------------------------------- the fuse box: two fuses go in
    const oldFuse = fuseMeshes['fuse-a'];       // the cartridge that used to sit in the box (row 1.29)
    const inBox = [];
    if (oldFuse) {
      inBox.push(oldFuse);
      const second = oldFuse.clone(); second.position.y = 1.46; second.userData.keepDynamic = true; scene.add(second); inBox.push(second);
      delete fuseMeshes['fuse-a'];
    }
    const boxTarget = world.target('fuse-box', 'ヒューズボックス', BOX.x, BOX.y, BOX.z);

    // ---------------------------------------------------------------- a crate by the fuse box with a scribbled note on it
    const NOTE = '誰かが夜中にヒューズを抜いてやがる、くだらねーイタズラだぜ。\n　いつも搬入口の駐車場とカルーセルの近くに捨ててある。\n　朝に施設の電源を入れる時はそこを探して見てくれ';
    const noteCrate = new T.Group();
    const nb = (w, h, d, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); noteCrate.add(m); return m; };
    nb(0.56, 0.52, 0.56, M.wood, 0, 0.26, 0);
    for (const y of [0.09, 0.44]) nb(0.58, 0.05, 0.58, M.woodDark, 0, y, 0);
    noteCrate.position.set(-15.42, 0, 16.62); noteCrate.rotation.y = -0.12; root.add(noteCrate);
    addCollider(-15.72, -15.12, 16.32, 16.92, 'crate');
    // the note: a grubby white sheet with a hurried scrawl, a little bright so it reads in the dark
    const nc = document.createElement('canvas'); nc.width = 256; nc.height = 352;
    const nx = nc.getContext('2d');
    nx.fillStyle = '#f1ede2'; nx.fillRect(0, 0, 256, 352);
    // grime: speckles, a couple of brown blotches, a crease and darker, handled edges
    let gs = 3; const gr = () => ((gs = (gs * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { nx.fillStyle = `rgba(${90 + gr() * 40 | 0},${70 + gr() * 30 | 0},${40 + gr() * 20 | 0},${0.05 + gr() * 0.12})`; nx.fillRect(gr() * 256, gr() * 352, 1 + gr() * 2, 1 + gr() * 2); }
    for (const [x, y, r, a] of [[60, 50, 70, 0.14], [210, 150, 55, 0.1], [120, 300, 80, 0.12]]) { const g = nx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(140,105,55,${a})`); g.addColorStop(1, 'rgba(140,105,55,0)'); nx.fillStyle = g; nx.fillRect(0, 0, 256, 352); }
    nx.strokeStyle = 'rgba(70,55,35,.12)'; nx.lineWidth = 1.5; nx.beginPath(); nx.moveTo(0, 176); nx.lineTo(256, 172); nx.stroke();
    const edge = nx.createRadialGradient(128, 176, 120, 128, 176, 230); edge.addColorStop(0, 'rgba(100,80,50,0)'); edge.addColorStop(1, 'rgba(100,80,50,.35)'); nx.fillStyle = edge; nx.fillRect(0, 0, 256, 352);
    nx.strokeStyle = '#2b2b33'; nx.lineWidth = 2.2; nx.lineCap = 'round';
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 9; row++) {      // scribbled lines of handwriting
      const y = 46 + row * 26, len = row === 8 ? 90 : 160 + rnd() * 50; let x = 30;
      nx.beginPath(); nx.moveTo(x, y);
      while (x < 30 + len) { x += 4 + rnd() * 5; nx.lineTo(x, y - 3 - rnd() * 9); x += 3 + rnd() * 4; nx.lineTo(x, y - rnd() * 3); }
      nx.stroke();
    }
    const ntex = new T.CanvasTexture(nc); ntex.colorSpace = T.SRGBColorSpace || ntex.colorSpace;
    const note = new T.Mesh(new T.PlaneGeometry(0.21, 0.29), std({ map: ntex, color: 0xffffff, emissive: 0x2c2a24, roughness: 0.9, metalness: 0 }));
    note.rotation.set(-Math.PI / 2, 0, 0.35); note.position.set(-15.42, 0.527, 16.62); root.add(note);
    const noteTarget = world.target('fuse-note', 'メモを読む', -15.42, 0.55, 16.62);

    // ---------------------------------------------------------------- the distribution lever: a wall-mounted knife switch
    // (grey moulded housing with an arched cover in three ribs and a warning band, a dark grey base, and a dark grey
    // T-shaped handle that swings over the arch: up = off, down = on). Local +x points out of the wall.
    const WALL_X = -15.825;
    const lever = new T.Group(); lever.position.set(WALL_X, LEVER.y, LEVER.z); root.add(lever);
    const KS = {
      body: std({ color: 0x8e8c86, roughness: 0.5, metalness: 0.05 }),
      base: std({ color: 0x5a5e5c, roughness: 0.55, metalness: 0.1 }),
      slot: std({ color: 0x1a1412, roughness: 0.8, metalness: 0 }),
      blue: std({ color: 0xa4a8a6, roughness: 0.35, metalness: 0.6 }),
    };
    const kb = (w, h, d, mat, x, y, z, parent = lever) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const hole = (x, y, z, r = 0.014) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, 0.012, 12), KS.slot); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); lever.add(m); };
    // green base on the wall, and the orange blocks with screw holes above and below the arch
    kb(0.05, 0.5, 0.34, KS.base, 0.025, 0, 0);
    kb(0.07, 0.13, 0.3, KS.body, 0.085, -0.17, 0); kb(0.07, 0.13, 0.3, KS.body, 0.085, 0.17, 0);
    for (const z of [-0.09, 0, 0.09]) { hole(0.121, -0.17, z); }
    for (const z of [-0.09, 0.09]) { hole(0.121, 0.17, z); }
    // the arched cover: three ribs (half cylinders on a horizontal axis along the wall) with dark gaps between
    const AX = 0.12, R = 0.15, RIB = 0.072, GAP = 0.012;
    const half = (r, len) => { const g = new T.CylinderGeometry(r, r, len, 28, 1, false, 0, Math.PI); g.rotateX(Math.PI / 2); return g; };   // axis along the wall, the half facing +x (out of the wall)
    for (const i of [-1, 0, 1]) { const m = new T.Mesh(half(R, RIB), KS.body); m.position.set(AX, 0, i * (RIB + GAP)); lever.add(m); }
    const gapCore = new T.Mesh(half(R - 0.025, (RIB + GAP) * 3), KS.slot); gapCore.position.set(AX, 0, 0); lever.add(gapCore);
    // white warning band with red print over the middle rib
    const wc = document.createElement('canvas'); wc.width = 512; wc.height = 96;
    const w2 = wc.getContext('2d');
    w2.fillStyle = '#f4f1ea'; w2.fillRect(0, 0, 512, 96); w2.strokeStyle = '#c8301e'; w2.lineWidth = 3; w2.strokeRect(4, 6, 504, 84);
    w2.fillStyle = '#c8301e'; w2.font = 'bold 22px serif'; w2.textAlign = 'left';
    w2.fillText('Important Warning:', 26, 34); w2.font = '16px serif'; w2.fillText('Do not open the cover when connecting.', 26, 58); w2.fillText('通電中は カバーを開けないこと', 26, 80);
    w2.beginPath(); w2.moveTo(460, 30); w2.lineTo(460, 62); w2.lineTo(450, 52); w2.moveTo(460, 62); w2.lineTo(470, 52); w2.lineWidth = 4; w2.stroke();
    const wtex = new T.CanvasTexture(wc); wtex.colorSpace = T.SRGBColorSpace || wtex.colorSpace;
    const band = new T.Mesh(half(R + 0.002, RIB * 0.82), std({ map: wtex, roughness: 0.6, metalness: 0 })); band.position.set(AX, 0, 0); lever.add(band);
    // round inspection sticker on the end of the arch
    const sc = document.createElement('canvas'); sc.width = 128; sc.height = 128;
    const s2 = sc.getContext('2d');
    s2.fillStyle = '#f6f2e8'; s2.beginPath(); s2.arc(64, 64, 62, 0, Math.PI * 2); s2.fill();
    s2.strokeStyle = '#e07a20'; s2.lineWidth = 9; s2.beginPath(); s2.ellipse(64, 64, 46, 30, -0.5, 0, Math.PI * 2); s2.stroke();
    s2.fillStyle = '#e07a20'; s2.font = 'bold 15px sans-serif'; s2.textAlign = 'center'; s2.save(); s2.translate(64, 64); s2.rotate(-0.5); s2.fillText('QUALIFIED', 0, 5); s2.restore();
    const stex = new T.CanvasTexture(sc); stex.colorSpace = T.SRGBColorSpace || stex.colorSpace;
    const sticker = new T.Mesh(new T.CircleGeometry(0.045, 24), std({ map: stex, roughness: 0.6, metalness: 0 }));
    sticker.position.set(AX + 0.07, 0.03, 1.5 * RIB + GAP + 0.001); lever.add(sticker);
    // printed plate above the switch
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#ddd6bf'; c2.fillRect(0, 0, 256, 96); c2.strokeStyle = '#2a2a2a'; c2.lineWidth = 6; c2.strokeRect(5, 5, 246, 86);
    c2.fillStyle = '#1e1e1e'; c2.textAlign = 'center'; c2.font = 'bold 36px "Hiragino Kaku Gothic ProN", sans-serif'; c2.fillText('配電レバー', 128, 46);
    c2.font = 'bold 20px sans-serif'; c2.fillStyle = '#b01e14'; c2.fillText('MAIN POWER  ↓ ON', 128, 78);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
    const plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.13), std({ map: tex, roughness: 0.85, metalness: 0 }));
    plate.position.set(0.004, 0.36, 0); plate.rotation.y = Math.PI / 2; lever.add(plate);
    // the green T-handle: a cross bar outside the arch, carried by two side arms on the arch's axis
    const arm = new T.Group(); arm.position.set(AX, 0, 0); lever.add(arm);
    const HR = R + 0.05, HALFW = 1.5 * RIB + GAP + 0.018;
    kb(0.05, 0.045, HALFW * 2 + 0.03, KS.base, HR, 0, 0, arm);                 // cross bar
    kb(0.07, 0.03, 0.09, KS.base, HR + 0.05, 0, 0, arm);                       // the grip
    for (const zs of [-1, 1]) {
      kb(HR, 0.03, 0.014, KS.base, HR / 2, 0, zs * HALFW, arm);                // side arm
      const d = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.012, 10), KS.blue); d.rotation.z = Math.PI / 2; d.position.set(HR + 0.026, 0, zs * (HALFW - 0.005)); arm.add(d);
    }
    const UP = 0.95, DOWN = -0.95;
    arm.rotation.z = UP;
    addCollider(WALL_X - 0.02, WALL_X + 0.36, LEVER.z - 0.2, LEVER.z + 0.2, 'lever');
    const leverTarget = world.target('power-lever', '配電レバーを引く', WALL_X + 0.28, LEVER.y, LEVER.z);
    world.collisionRevision = (world.collisionRevision | 0) + 1;

    // ---------------------------------------------------------------- state
    const picked = () => (story.fuses || []).filter((f) => f === 'fuse-yard' || f === 'fuse-bench').length;
    const installed = () => (story.fuses || []).includes('box') || story.stage >= 2;
    const s14 = () => story.ah14 && story.ah14.story;
    let leverAnim = null, pulling = false;
    const say = (t, d) => host.ui && host.ui.subtitle && host.ui.subtitle(t, d);
    // the supplied click for a fuse going into its holder
    let insertBuf = null, insertBytes = null;
    fetch('./assets/audio/sfx/fuse-insert.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { insertBytes = b; decodeInsert(); }).catch(() => {});
    const decodeInsert = () => { const a = host.audio; if (insertBuf || !insertBytes || !a || !a.ctx) return; const b = insertBytes; insertBytes = null; a.ctx.decodeAudioData(b, (buf) => { insertBuf = buf; }, () => {}); };
    const playInsert = (delay) => {
      const a = host.audio; decodeInsert();
      if (!insertBuf || !a || !a.ctx || !a.master || a.ctx.state === 'closed') return false;
      const src = a.ctx.createBufferSource(), g = a.ctx.createGain(); g.gain.value = 0.9;
      src.buffer = insertBuf; src.connect(g).connect(a.master); src.start(a.ctx.currentTime + delay); return true;
    };
    const tone = (f, d) => { try { host.audio && host.audio.tone && host.audio.tone(f, d); } catch (e) {} };
    const removeTarget = (t) => { const i = world.interactables.indexOf(t); if (i >= 0) world.interactables.splice(i, 1); };
    const addTarget = (t) => { if (!world.interactables.includes(t)) world.interactables.push(t); };

    const sync = () => {
      // fuses from the old procedure mean nothing now
      if (story.stage === 1 && story.fuses && story.fuses.some((f) => /^fuse-[abc]$/.test(f))) story.fuses = story.fuses.filter((f) => !/^fuse-[abc]$/.test(f));
      for (const p of pickups) {
        const have = (story.fuses || []).includes(p.id) || story.stage >= 2 || installed();
        p.mesh.visible = !have;
        if (have || story.stage !== 1) removeTarget(p.target); else addTarget(p.target);
      }
      const ins = installed();
      for (const m of inBox) m.visible = ins;
      boxTarget.label = ins ? 'ヒューズボックス' : picked() >= NEED ? 'ヒューズを入れる' : 'ヒューズボックス';
      leverTarget.label = story.stage >= 2 ? '配電レバー' : '配電レバーを引く';
      if (!leverAnim && !pulling) arm.rotation.z = story.stage >= 2 ? DOWN : UP;
    };
    sync();

    const interact = (id) => {
      const p = pickups.find((q) => q.id === id);
      if (p) {
        if (story.stage !== 1 || (story.fuses || []).includes(id)) return;
        story.fuses.push(id);
        tone(320, 0.1); setTimeout(() => tone(480, 0.08), 90);
        const n = picked();
        say(n >= NEED ? `ヒューズを手に入れた。 ${n} / ${NEED}　メンテナンス室のヒューズボックスへ。` : `ヒューズを手に入れた。 ${n} / ${NEED}`, 3.5);
        sync(); story.save && story.save(); story.objective && story.objective();
        return;
      }
      if (id === 'fuse-note') {
        tone(520, 0.04);
        if (host.ui && host.ui.dialog) {
          host.ui.dialog('MEMO', '走り書きのメモ', NOTE);
          const dlg = document.getElementById('dialog');
          if (dlg) {
            dlg.classList.add('ah-paper');   // the sheet itself (style in the page head)
            const off = () => { if (dlg.hidden) { dlg.classList.remove('ah-paper'); mo.disconnect(); } };
            const mo = new MutationObserver(off); mo.observe(dlg, { attributes: true, attributeFilter: ['hidden'] });
          }
        }
        return;
      }
      if (id === 'fuse-box') {
        if (installed()) { say('ヒューズは2本とも差し込んである。', 2.5); return; }
        const n = picked();
        if (n < NEED) { say(`ヒューズが足りない。 ${n} / ${NEED}`, 2.5); return; }
        story.fuses.push('box');
        // one click per fuse
        if (!(playInsert(0) && playInsert(0.62))) { tone(260, 0.07); setTimeout(() => tone(200, 0.09), 160); setTimeout(() => tone(260, 0.07), 420); setTimeout(() => tone(200, 0.09), 580); }
        say('ヒューズを2本、差し込んだ。横の配電レバーを引けば、電源が戻るはずだ。', 4.5);
        sync(); story.save && story.save(); story.objective && story.objective();
        return;
      }
      if (id === 'power-lever') {
        if (story.stage >= 2) { say('電源は戻っている。', 2); return; }
        if (!installed()) { say('ヒューズボックスが空だ。先にヒューズを入れる。', 3); return; }
        if (pulling) return;
        pulling = true;
        leverAnim = { t: 0, from: arm.rotation.z, to: DOWN, dur: 0.45 };
        const s = s14();
        try { s && s.sfx && s.sfx.clunk ? s.sfx.clunk(new T.Vector3(LEVER.x, LEVER.y, LEVER.z), 'lever') : tone(140, 0.2); } catch (e) { tone(140, 0.2); }
        setTimeout(() => {
          try { if (s && s.turningPoint) s.turningPoint(); else story.setStage && story.setStage(2); } catch (e) { console.warn('[power-restore]', e); }
          pulling = false; sync();
        }, 520);
        return;
      }
    };

    const IDS = ['fuse-yard', 'fuse-bench', 'fuse-box', 'power-lever', 'fuse-note'];
    const origInteract = story.interact.bind(story);
    story.interact = function (t) {
      if (t && IDS.includes(t.id) && !(this.player && this.player.hidden)) { interact(t.id); return; }
      return origInteract(t);
    };
    const origEnabled = story.enabled.bind(story);
    story.enabled = function (id) {
      if (id === 'fuse-yard' || id === 'fuse-bench') return this.stage === 1 && !(this.fuses || []).includes(id);
      if (id === 'fuse-box' || id === 'power-lever') return this.stage >= 1 && this.stage <= 2;
      if (id === 'fuse-note') return this.stage >= 1;
      return origEnabled(id);
    };

    let last = performance.now(), acc = 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (leverAnim) {
        leverAnim.t = Math.min(1, leverAnim.t + dt / leverAnim.dur);
        const e = 1 - Math.pow(1 - leverAnim.t, 3);
        arm.rotation.z = leverAnim.from + (leverAnim.to - leverAnim.from) * e;
        if (leverAnim.t >= 1) leverAnim = null;
      }
      acc += dt; if (acc > 0.25) { acc = 0; sync(); if (!insertBuf) decodeInsert(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    world.powerRestore = { pickups, sync, interact, lever: arm };
  }
})();
