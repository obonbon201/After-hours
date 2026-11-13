
/* Stage 1 interaction reach: an object can be used only from within 50 cm of it.
   "50 cm" is measured from the edge of the player's body (collision radius) to the closest place the player can
   actually stand at that object, so wall-mounted boxes, lockers, counters and big machines all work the same way.
   For every target the closest standing distance is found once (and again only when the colliders change), by
   sampling rings of free positions around it that have a clear line to it. */
(() => {
  const REACH = 0.5;          // metres between the body edge and the object
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { install(host); } catch (e) { console.warn('[interact-reach]', e); }
    return result;
  };
  function install(host) {
    const player = host.player, world = host.world;
    if (!player || !world || player.__reach) return;
    player.__reach = true;
    const cache = new Map();   // target -> { x, z, rev, d }
    const approach = (t) => {
      const tx = t.position.x, tz = t.position.z, r = player.radius || 0.3, rev = world.collisionRevision | 0;
      const c = cache.get(t);
      if (c && c.x === tx && c.z === tz && c.rev === rev) return c.d;
      let d = Infinity;
      search: for (let rad = 0; rad <= 3.0001; rad += 0.05) {
        const n = rad === 0 ? 1 : Math.max(16, Math.ceil(rad * 40));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2, x = tx + Math.cos(a) * rad, z = tz + Math.sin(a) * rad;
          if (world.isFree(x, z, r) && world.interactClear(x, z, tx, tz)) { d = rad; break search; }
        }
      }
      cache.set(t, { x: tx, z: tz, rev, d });
      return d;
    };
    const reachOf = (t) => {
      const d = approach(t);
      // nowhere to stand within 3 m: keep the game's old rule for that object so nothing becomes unusable
      if (!isFinite(d)) return null;
      return Math.max(d, player.radius || 0.3) + REACH;
    };
    const look = new (player.position.constructor)();
    player.nearest = function () {
      const cam = this.camera, px = this.position.x, pz = this.position.z;
      cam.getWorldDirection(look);
      const lh = Math.hypot(look.x, look.z) || 1, lx = look.x / lh, lz = look.z / lh;
      let best = null, score = -Infinity;
      for (const t of world.interactables) {
        const dx = t.position.x - px, dz = t.position.z - pz, h = Math.hypot(dx, dz);
        if (h > 4) continue;
        const limit = reachOf(t);
        let facing;
        if (limit === null) {
          // old rule (3D distance from the eye, 0.6 facing) for the rare target nobody can stand near
          const v = t.position.clone().sub(cam.position), a = v.length();
          if (a > (t.radius || 3.35) || a < 0.01) continue;
          facing = v.normalize().dot(look);
          if (facing < 0.6) continue;
        } else {
          if (h > limit) continue;
          facing = h < 0.2 ? 1 : (dx * lx + dz * lz) / h;   // standing on top of it counts as facing it
          if (facing < 0.5) continue;
        }
        if (!world.interactClear(cam.position.x, cam.position.z, t.position.x, t.position.z)) continue;
        const s = facing - h * 0.5;
        if (s > score) { score = s; best = t; }
      }
      return best;
    };
    if (/[?&]verify\b/.test(location.search)) window.__ahInteractReach = { reachOf, approach, REACH };
  }
})();
