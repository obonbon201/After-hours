
/* Stage 1 power restore (replaces the three fuse boxes and the carousel recovery panel):
 *  - two spare fuses lie in the park: on a crate in the corner of the service-yard car park just inside the
 *    loading gate, and on a bench;
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
    { id: 'fuse-bench', x: 6.35, y: 0.607, z: 9.98, ry: -0.25 },    // on the seat of the main-street bench
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

    // ---------------------------------------------------------------- the distribution lever beside it
    const lever = new T.Group(); lever.position.set(LEVER.x, LEVER.y, LEVER.z); root.add(lever);
    const lp = (w, h, d, mat, x, y, z, parent = lever) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    lp(0.06, 0.62, 0.34, M.steel, -0.06, 0, 0);                   // back plate on the wall
    lp(0.08, 0.5, 0.06, M.dark, -0.01, 0, -0.12); lp(0.08, 0.5, 0.06, M.dark, -0.01, 0, 0.12);   // guide cheeks
    // printed plate above
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#ddd6bf'; c2.fillRect(0, 0, 256, 96); c2.strokeStyle = '#2a2a2a'; c2.lineWidth = 6; c2.strokeRect(5, 5, 246, 86);
    c2.fillStyle = '#1e1e1e'; c2.textAlign = 'center'; c2.font = 'bold 36px "Hiragino Kaku Gothic ProN", sans-serif'; c2.fillText('配電レバー', 128, 46);
    c2.font = 'bold 20px sans-serif'; c2.fillStyle = '#b01e14'; c2.fillText('MAIN POWER  ↓ ON', 128, 78);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
    const plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.13), std({ map: tex, roughness: 0.85, metalness: 0 }));
    plate.position.set(-0.025, 0.42, 0); plate.rotation.y = Math.PI / 2; lever.add(plate);
    // the handle swings on a pivot across the wall: up = off, down = on
    const arm = new T.Group(); arm.position.set(0.02, 0, 0); lever.add(arm);
    lp(0.035, 0.3, 0.035, M.steel, 0, 0.15, 0, arm);
    const knob = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.16, 12), M.red); knob.rotation.x = Math.PI / 2; knob.position.set(0, 0.31, 0); arm.add(knob);
    const pivot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.2, 12), M.dark); pivot.rotation.x = Math.PI / 2; lever.add(pivot);
    const UP = -0.4, DOWN = -Math.PI + 0.4;
    arm.rotation.z = UP;
    addCollider(LEVER.x - 0.1, LEVER.x + 0.2, LEVER.z - 0.2, LEVER.z + 0.2, 'lever');
    const leverTarget = world.target('power-lever', '配電レバーを引く', LEVER.x + 0.14, LEVER.y, LEVER.z);
    world.collisionRevision = (world.collisionRevision | 0) + 1;

    // ---------------------------------------------------------------- state
    const picked = () => (story.fuses || []).filter((f) => f === 'fuse-yard' || f === 'fuse-bench').length;
    const installed = () => (story.fuses || []).includes('box') || story.stage >= 2;
    const s14 = () => story.ah14 && story.ah14.story;
    let leverAnim = null, pulling = false;
    const say = (t, d) => host.ui && host.ui.subtitle && host.ui.subtitle(t, d);
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
      if (id === 'fuse-box') {
        if (installed()) { say('ヒューズは2本とも差し込んである。', 2.5); return; }
        const n = picked();
        if (n < NEED) { say(`ヒューズが足りない。 ${n} / ${NEED}`, 2.5); return; }
        story.fuses.push('box');
        tone(260, 0.07); setTimeout(() => tone(200, 0.09), 160); setTimeout(() => tone(260, 0.07), 420); setTimeout(() => tone(200, 0.09), 580);
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

    const IDS = ['fuse-yard', 'fuse-bench', 'fuse-box', 'power-lever'];
    const origInteract = story.interact.bind(story);
    story.interact = function (t) {
      if (t && IDS.includes(t.id) && !(this.player && this.player.hidden)) { interact(t.id); return; }
      return origInteract(t);
    };
    const origEnabled = story.enabled.bind(story);
    story.enabled = function (id) {
      if (id === 'fuse-yard' || id === 'fuse-bench') return this.stage === 1 && !(this.fuses || []).includes(id);
      if (id === 'fuse-box' || id === 'power-lever') return this.stage >= 1 && this.stage <= 2;
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
      acc += dt; if (acc > 0.25) { acc = 0; sync(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    world.powerRestore = { pickups, sync, interact, lever: arm };
  }
})();
