
/* Temporary development aid: shows the player's position and facing in the top-right corner of the HUD
   so objects in the area can be pointed at by coordinates. Remove this script to hide it again. */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const previousMount = AH2.mount;
  AH2.mount = function (host) {
    const result = previousMount ? previousMount.apply(this, arguments) : undefined;
    try { install(host); } catch (e) { console.warn('[coords-hud]', e); }
    return result;
  };
  function install(host) {
    const hud = document.getElementById('hud');
    if (!hud || document.getElementById('ah-coords')) return;
    const style = document.createElement('style');
    style.textContent = '#ah-coords{position:absolute;top:calc(max(14px,env(safe-area-inset-top)) + 54px);right:var(--safe-right,16px);' +
      'padding:5px 8px;background:#050a0cb3;border:1px solid #b7c1af43;color:#f2ead2;font-size:11px;line-height:1.5;letter-spacing:.5px;' +
      'text-align:right;font-variant-numeric:tabular-nums;white-space:pre;pointer-events:none}';
    document.head.appendChild(style);
    const box = document.createElement('div');
    box.id = 'ah-coords';
    hud.appendChild(box);
    const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    let last = '';
    setInterval(() => {
      const p = host.player;
      if (!p || !p.position || hud.hidden) return;
      // yaw 0 looks toward -Z (north); the heading grows clockwise toward +X (east)
      const deg = (((-p.yaw * 180) / Math.PI) % 360 + 360) % 360;
      const text = `X ${p.position.x.toFixed(1)}  Z ${p.position.z.toFixed(1)}\n向き ${Math.round(deg)}° ${dirs[Math.round(deg / 45) % 8]}`;
      if (text !== last) { box.textContent = text; last = text; }
    }, 100);
  }
})();
