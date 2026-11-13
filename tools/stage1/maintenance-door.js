
/* Stage 1: the staff door of the maintenance room (east wall, x = -10, z 20.95..22.25) now starts closed and is
   opened / closed by interacting with it. The red door leaf that used to stand open is reused; its collider is
   switched between the doorway (closed) and the leaf lying against the inner south wall (open). */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { install(host); } catch (e) { console.warn('[maintenance-door]', e); }
    return result;
  };

  const HINGE = { x: -10.08, z: 22.22 };
  const OPEN_ANGLE = 1.52;                       // leaf flat against the inner south wall
  const CLOSED = { minX: -10.175, maxX: -9.825, minZ: 20.95, maxZ: 22.25 };
  const OPEN = { minX: -11.36, maxX: -10.02, minZ: 22.1, maxZ: 22.27 };
  const OPEN_SWING = 1.1, CLOSE_SWING = 0.7;     // seconds (the opening matches the recording's stop at ~1.1 s)

  function install(host) {
    const world = host.world, story = host.story, player = host.player;
    if (!world || !story || world.maintenanceDoor) return;
    const col = world.colliders.find((c) => c.kind === 'door-leaf' && Math.abs(c.minX + 11.34) < 0.05 && Math.abs(c.minZ - 21.96) < 0.05);
    if (!col || !col.mesh) return;
    const leaf = col.mesh;
    const door = { open: false, angle: 0, from: 0, to: 0, t: 1, pending: null, dur: OPEN_SWING };
    world.maintenanceDoor = door;
    const setBox = (b) => { col.minX = b.minX; col.maxX = b.maxX; col.minZ = b.minZ; col.maxZ = b.maxZ; col.disabled = false; world.collisionRevision = (world.collisionRevision | 0) + 1; };
    const overlaps = (b) => {
      const r = (player.radius || 0.3) + 0.02, p = player.position;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      return Math.hypot(p.x - cx, p.z - cz) < r;
    };
    leaf.rotation.y = 0;
    setBox(CLOSED);

    const target = world.target('maint-door', '開ける', -10.08, 1.2, 21.59);
    // the interaction point rides on the middle of the leaf, so the door itself is what you use, open or closed
    const mid = new (target.position.constructor)();
    const placeTarget = () => { leaf.updateMatrixWorld(true); mid.set(0, 1.2, -0.63); leaf.localToWorld(mid); target.position.copy(mid); };
    placeTarget();
    const say = (text, sec) => host.ui && host.ui.subtitle && host.ui.subtitle(text, sec);

    // --- sound: the supplied door recordings (open: latch, creak and the stop at ~1.1 s; close: the slam peaks at
    // 0.15 s, so it is started early enough to land as the leaf meets the frame); synthesized clicks as a fallback
    const FILES = { open: './assets/audio/sfx/door-open.mp3', close: './assets/audio/sfx/door-close.mp3' };
    const bytes = {}, buffers = {};
    const decode = () => {
      const a = host.audio; if (!a || !a.ctx) return;
      for (const k of Object.keys(bytes)) {
        if (buffers[k] || !bytes[k]) continue;
        const b = bytes[k]; bytes[k] = null;
        a.ctx.decodeAudioData(b, (buf) => { buffers[k] = buf; }, () => {});
      }
    };
    for (const [k, url] of Object.entries(FILES)) fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (b) { bytes[k] = b; decode(); } }).catch(() => {});
    const sound = (opening) => {
      const a = host.audio;
      if (!a || !a.ctx || !a.master || a.ctx.state === 'closed') return;
      decode();
      const c = a.ctx, now = c.currentTime;
      const cam = host.camera, d = Math.hypot(target.position.x - cam.position.x, target.position.z - cam.position.z);
      const out = c.createGain(); out.gain.value = 1.0 / (1 + d / 4); out.connect(a.master);
      const buf = buffers[opening ? 'open' : 'close'];
      if (buf) {
        const src = c.createBufferSource(); src.buffer = buf; src.connect(out);
        src.start(opening ? now : now + Math.max(0, CLOSE_SWING - 0.15));
        return;
      }
      const click = (t, f, g) => {
        const o = c.createOscillator(), e = c.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.05);
        e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(e).connect(out); o.start(t); o.stop(t + 0.07);
      };
      if (opening) click(now, 1800, 0.05);
      else { click(now + CLOSE_SWING - 0.05, 900, 0.09); click(now + CLOSE_SWING, 260, 0.12); }
    };

    const toggle = () => {
      if (door.t < 1) return;
      if (door.open) {
        if (overlaps(CLOSED)) { say('扉の前から少し離れてください。', 2); return; }
        door.open = false; door.from = door.angle; door.to = 0; door.t = 0; door.dur = CLOSE_SWING;
        setBox(CLOSED); door.pending = null;
      } else {
        door.open = true; door.from = door.angle; door.to = OPEN_ANGLE; door.t = 0; door.dur = OPEN_SWING;
        // the doorway is free at once; the leaf's own box waits until the player is clear of it
        if (overlaps(OPEN)) { col.disabled = true; world.collisionRevision = (world.collisionRevision | 0) + 1; door.pending = OPEN; }
        else setBox(OPEN);
      }
      target.label = door.open ? '閉める' : '開ける';
      sound(door.open);
    };

    const origInteract = story.interact.bind(story);
    story.interact = function (t) {
      if (t && t.id === 'maint-door') { if (this.tape && this.tape.active) return; toggle(); return; }
      return origInteract(t);
    };
    if (story.enabled) {
      const origEnabled = story.enabled.bind(story);
      story.enabled = function (id) { return id === 'maint-door' ? !(window.__ahStageRouter && window.__ahStageRouter.active) : origEnabled(id); };
    }

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (door.t < 1) {
        door.t = Math.min(1, door.t + dt / door.dur);
        const e = door.t < 0.5 ? 2 * door.t * door.t : 1 - Math.pow(-2 * door.t + 2, 2) / 2;
        door.angle = door.from + (door.to - door.from) * e;
        leaf.rotation.y = door.angle;
        placeTarget();
      }
      if (door.pending && !overlaps(door.pending)) { setBox(door.pending); door.pending = null; }
      if ((!buffers.open || !buffers.close) && (now | 0) % 1000 < 20) decode();   // the audio context may start after load
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    door.toggle = toggle;
  }
})();
