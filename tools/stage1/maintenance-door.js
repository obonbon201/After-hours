
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
  const SWING = 0.7;                             // seconds

  function install(host) {
    const world = host.world, story = host.story, player = host.player;
    if (!world || !story || world.maintenanceDoor) return;
    const col = world.colliders.find((c) => c.kind === 'door-leaf' && Math.abs(c.minX + 11.34) < 0.05 && Math.abs(c.minZ - 21.96) < 0.05);
    if (!col || !col.mesh) return;
    const leaf = col.mesh;
    const door = { open: false, angle: 0, from: 0, to: 0, t: 1, pending: null };
    world.maintenanceDoor = door;
    const setBox = (b) => { col.minX = b.minX; col.maxX = b.maxX; col.minZ = b.minZ; col.maxZ = b.maxZ; col.disabled = false; world.collisionRevision = (world.collisionRevision | 0) + 1; };
    const overlaps = (b) => {
      const r = (player.radius || 0.3) + 0.02, p = player.position;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      return Math.hypot(p.x - cx, p.z - cz) < r;
    };
    leaf.rotation.y = 0;
    setBox(CLOSED);

    const target = world.target('maint-door', 'メンテナンス室の扉を開ける', -10, 1.2, 21.6);
    const say = (text, sec) => host.ui && host.ui.subtitle && host.ui.subtitle(text, sec);

    // --- sound: synthesized handle click + hinge creak, routed through the game's master gain
    const sound = (opening) => {
      const a = host.audio;
      if (!a || !a.ctx || !a.master || a.ctx.state === 'closed') return;
      const c = a.ctx, now = c.currentTime;
      const cam = host.camera, dx = -10 - cam.position.x, dz = 21.6 - cam.position.z, d = Math.hypot(dx, dz);
      const out = c.createGain(); out.gain.value = 0.9 / (1 + d / 4); out.connect(a.master);
      const click = (t, f, g) => {
        const o = c.createOscillator(), e = c.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.05);
        e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(e).connect(out); o.start(t); o.stop(t + 0.07);
      };
      const creak = (t, f0, f1, dur, g) => {
        const o = c.createOscillator(), e = c.createGain(), bp = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
        bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 6;
        e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.06); e.gain.linearRampToValueAtTime(g * 0.6, t + dur * 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(bp).connect(e).connect(out); o.start(t); o.stop(t + dur + 0.02);
      };
      if (opening) { click(now, 1800, 0.05); creak(now + 0.05, 210, 160, 0.55, 0.045); }
      else { creak(now, 170, 220, 0.45, 0.035); click(now + SWING - 0.05, 900, 0.09); click(now + SWING, 260, 0.12); }
    };

    const toggle = () => {
      if (door.t < 1) return;
      if (door.open) {
        if (overlaps(CLOSED)) { say('扉の前から少し離れてください。', 2); return; }
        door.open = false; door.from = door.angle; door.to = 0; door.t = 0;
        setBox(CLOSED); door.pending = null;
      } else {
        door.open = true; door.from = door.angle; door.to = OPEN_ANGLE; door.t = 0;
        // the doorway is free at once; the leaf's own box waits until the player is clear of it
        if (overlaps(OPEN)) { col.disabled = true; world.collisionRevision = (world.collisionRevision | 0) + 1; door.pending = OPEN; }
        else setBox(OPEN);
      }
      target.label = door.open ? 'メンテナンス室の扉を閉める' : 'メンテナンス室の扉を開ける';
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
        door.t = Math.min(1, door.t + dt / SWING);
        const e = door.t < 0.5 ? 2 * door.t * door.t : 1 - Math.pow(-2 * door.t + 2, 2) / 2;
        door.angle = door.from + (door.to - door.from) * e;
        leaf.rotation.y = door.angle;
      }
      if (door.pending && !overlaps(door.pending)) { setBox(door.pending); door.pending = null; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    door.toggle = toggle;
  }
})();
