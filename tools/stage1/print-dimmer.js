
/* Printed surfaces (signs, posters, notices, banners) were so bright in the torch beam that they washed out to
   white. Their base colour is scaled down so the print stays readable under the torch. Flat textured boards are
   found before the static meshes are merged (AH2.beforeMerge, called by the game), and once more after start
   for boards that are added later. Glowing / emissive boards, mirrors, screens and floor decals are left alone. */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const K = 0.5;                                   // albedo scale for printed boards
  const done = new WeakSet();
  const isPrint = (o) => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'PlaneGeometry') return false;
    const m = o.material;
    if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || !m.map) return false;
    if (m.name && /^AH11\//.test(m.name)) return false;               // surface materials (plaster, fabric …)
    if (m.emissiveMap || (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05)) return false;
    if (m.blending && m.blending !== 1) return false;                // additive glows
    if (m.userData && m.userData.noDim) return false;
    // skip boards lying flat (floor decals, markings)
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements, ny = Math.abs(e[9]) / Math.hypot(e[8], e[9], e[10]);
    return ny < 0.7;
  };
  const dim = (root) => {
    let n = 0;
    root.traverse((o) => {
      if (!isPrint(o)) return;
      const m = o.material;
      if (done.has(m)) return;
      done.add(m); m.color.multiplyScalar(K); n++;
    });
    return n;
  };
  const previous = AH2.beforeMerge;
  AH2.beforeMerge = function (world) {
    try { if (previous) previous.apply(this, arguments); } catch (e) { console.warn(e); }
    try {
      if (!world || !world.scene) return;
      // screens, mirrors and lit words keep their brightness
      const keep = [world.monitor, world.mirrorPlane, world.lockerFace, world.lockerPanel, world.exitWord, ...(world.arcadeScreens || []), ...(world.mirrorMarks || [])];
      for (const o of keep) if (o && o.material && !Array.isArray(o.material)) o.material.userData.noDim = true;
      AH2.printDimmed = dim(world.scene);
    } catch (e) { console.warn('[print-dimmer]', e); }
  };
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try {
      const scene = host.scene || (host.world && host.world.scene);
      if (scene) { dim(scene); setTimeout(() => dim(scene), 3000); setTimeout(() => dim(scene), 12000); }
    } catch (e) { console.warn('[print-dimmer]', e); }
    return result;
  };
})();
