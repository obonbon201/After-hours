import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
def rep(a, b, n=1):
    global s
    c = s.count(a); assert c == n, (c, a[:90]); s = s.replace(a, b)

# ---------------------------------------------------------------- A) the arm solver, the limb outline, the debug view
rep("""  const circle = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, Math.max(0.01, r), 0, TAU); };""",
"""  // ---- arms (arm fix): shoulder -> upper arm -> elbow -> forearm -> wrist -> hand
  // Two-bone IK. Each bone is half the rig's armLen and keeps that length; a hand that reaches further stretches
  // both bones together a little (the cartoon licence, up to ARM.stretch), then stops. A hand pulled in closer than
  // ARM.minReach is held there, so the elbow never folds shut. Of the two possible elbows the solver takes the one
  // on the side of its pole (out and down from the shoulder, where a person's elbow goes); the follow-through sim
  // remembers how far the elbow is turned and turns it over smoothly (through depth) when a pose asks for the other
  // side. The outline is two bones joined by a rounded elbow, so the drawn arm is the solved arm.
  const ARM = { upper: 0.5, stretch: 1.18, minReach: 0.27, pole: [0.8, 0.6], round: 0.34 };
  // ?armdebug draws the joints (shoulder blue, elbow red, wrist green, the bones, the elbow angle). Off in the film.
  const ARMDBG = { on: (() => { try { return /[?&]armdebug\\b/.test(location.search); } catch (_) { return false; } })(), log: null };
  // > 0: the elbow belongs on the +normal side of the shoulder->wrist line (normal = direction rotated +90deg)
  function elbowPref(sh, wr, side) { const dx = wr[0] - sh[0], dy = wr[1] - sh[1], d = Math.hypot(dx, dy) || 1e-6; return (-dy / d) * ARM.pole[0] * side + (dx / d) * ARM.pole[1]; }
  // How far round the elbow is turned (sim): c = +1 / -1 is the elbow seen side-on on either side of the
  // shoulder-wrist line, 0 is the elbow pointing at the camera or away (the arm then reads foreshortened, not bent).
  // c follows the pole with a little inertia, so when a pose asks for the other side the elbow turns over through
  // depth in a few frames instead of jumping across.
  const elbowAim = (sh, wr, side) => clamp(elbowPref(sh, wr, side) * 2.4, -1, 1);
  function elbowTurn(prev, sh, wr, side, dt) {
    const aim = elbowAim(sh, wr, side); if (!prev) return { c: aim, v: 0 };
    const w = 26, a = w * w * (aim - prev.c) - 2 * w * prev.v, v = prev.v + a * dt;
    return { c: clamp(prev.c + v * dt, -1, 1), v };
  }
  function armIK(sh, hand, L, side, turn) {
    const dx = hand[0] - sh[0], dy = hand[1] - sh[1], d0 = Math.hypot(dx, dy) || 1e-6, ux = dx / d0, uy = dy / d0;
    const s = clamp(d0 / L, 1, ARM.stretch), A = L * ARM.upper * s, B = L * (1 - ARM.upper) * s;
    const d = clamp(d0, L * ARM.minReach, (A + B) * 0.9995);
    const x = (A * A - B * B + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A * A - x * x)), sg = turn ? turn.c : elbowAim(sh, hand, side);
    const el = [sh[0] + ux * x - uy * h * sg, sh[1] + uy * x + ux * h * sg], wr = [sh[0] + ux * d, sh[1] + uy * d];
    const v1 = [sh[0] - el[0], sh[1] - el[1]], v2 = [wr[0] - el[0], wr[1] - el[1]];
    const theta = Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1])) || 1), -1, 1)) * 180 / Math.PI;
    return { sh, el, wr, side, sign: sg, theta, reach: d0 / L, L };
  }
  // the drawn limb: shoulder, a straight upper arm, a rounded elbow, a straight forearm (pts = boiled [S, E, W])
  function armPoly(p) {
    const S = [p[0], p[1]], E = [p[2], p[3]], W = [p[4], p[5]], r = ARM.round, out = [S[0], S[1]];
    const P1 = [lerp(E[0], S[0], r), lerp(E[1], S[1], r)], P2 = [lerp(E[0], W[0], r), lerp(E[1], W[1], r)];
    out.push(P1[0], P1[1]);
    for (let k = 1; k < 8; k++) { const u = k / 8, q = qpt(P1, E, P2, u); out.push(q[0], q[1]); }
    out.push(P2[0], P2[1], W[0], W[1]);
    return out;
  }
  // the first fraction u (by length) of a polyline
  function polyCut(p, u) {
    let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    let want = L * u; const out = [p[0], p[1]];
    for (let i = 2; i < p.length; i += 2) {
      const l = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      if (l >= want) { const k = want / (l || 1); out.push(lerp(p[i - 2], p[i], k), lerp(p[i - 1], p[i + 1], k)); return out; }
      want -= l; out.push(p[i], p[i + 1]);
    }
    return out;
  }
  function hosePoly(g, p, w, fill, shade) {
    const o = 6 * boil.ink, path = () => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.save(); g.translate(1.0, 1.5); path(); g.strokeStyle = C.ink; g.lineWidth = w + o * 1.25; g.stroke(); g.restore();
    path(); g.strokeStyle = C.ink; g.lineWidth = w + o; g.stroke();
    if (shade) { g.strokeStyle = shade; g.lineWidth = w; g.stroke(); g.save(); g.translate(-w * 0.16, -w * 0.14); path(); g.strokeStyle = fill; g.lineWidth = w * 0.72; g.stroke(); g.restore(); }
    else { g.strokeStyle = fill; g.lineWidth = w; g.stroke(); }
  }
  function armNote(act, J) {
    if (!ARMDBG.on && !ARMDBG.log) return;
    (act.armJ || (act.armJ = [])).push(J);
    if (ARMDBG.log) { const S = act.toWorld(J.sh), E = act.toWorld(J.el), W = act.toWorld(J.wr); ARMDBG.log.push({ n: act.A.name, side: J.side, sh: J.sh, el: J.el, wr: J.wr, L: J.L, theta: J.theta, reach: J.reach, sign: J.sign, wW: W, sW: S, eW: E, holds: act.A.holds.map((h) => [h.side, h.partner || null, h.pside ?? null, h.w ? act.P[h.w] : 1]) }); }
  }
  function drawArmDebug(g, a, cam) {
    for (const J of a.armJ || []) {
      const S = a.toWorld(J.sh), E = a.toWorld(J.el), W = a.toWorld(J.wr);
      g.save(); g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.9)';
      g.beginPath(); g.moveTo(S[0] - cam, S[1]); g.lineTo(E[0] - cam, E[1]); g.lineTo(W[0] - cam, W[1]); g.stroke(); g.setLineDash([]);
      if (ARMDBG.screen) { const m = g.getTransform(); for (const p of [S, E, W]) { const q = m.transformPoint(new DOMPoint(p[0] - cam, p[1])); ARMDBG.screen.push([q.x, q.y, a.A.name]); } }
      for (const [p, c] of [[S, '#2f6fff'], [E, '#ff2a2a'], [W, '#18c23a']]) { g.beginPath(); g.arc(p[0] - cam, p[1], 6, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke(); }
      g.font = '700 15px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3.5; g.strokeStyle = '#000'; g.fillStyle = J.theta < 45 ? '#ff6a6a' : '#fff';
      const tx = E[0] - cam + (E[0] - (S[0] + W[0]) / 2) * 0.6, ty = E[1] - 12 + (E[1] - (S[1] + W[1]) / 2) * 0.6;
      g.strokeText(Math.round(J.theta) + '°', tx, ty); g.fillText(Math.round(J.theta) + '°', tx, ty);
      g.restore();
    }
  }
  const circle = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, Math.max(0.01, r), 0, TAU); };""")

# ---------------------------------------------------------------- B) the clown's arms
rep("""    const arm = (sh, hand, side, bend, open, rot, id, lag) => {
      const hx = hand[0] + lag[0], hy = hand[1] + lag[1], d = Math.hypot(hx - sh[0], hy - sh[1]), slack = Math.sqrt(Math.max(0, R.armLen * R.armLen - d * d)) * 0.5;
      const nx = -(hy - sh[1]) / (d || 1), ny = (hx - sh[0]) / (d || 1);
      const ex = (sh[0] + hx) / 2 + nx * slack * bend * side, ey = (sh[1] + hy) / 2 + ny * slack * bend * side;
      hose(g, boiled([sh[0], sh[1], ex, ey, hx, hy], id), 21, C.cream, C.creamSh);""",
"""    const arm = (sh, hand, side, bend, open, rot, id, lag, idx) => {
      const J = armIK(sh, [hand[0] + lag[0], hand[1] + lag[1]], R.armLen, side, act.el && act.el[idx]);
      const hx = J.wr[0], hy = J.wr[1], ex = J.el[0], ey = J.el[1];
      hosePoly(g, armPoly(boiled([sh[0], sh[1], ex, ey, hx, hy], id)), 21, C.cream, C.creamSh);
      armNote(act, J);""")
rep("""    act.hands = [arm(K.shL, K.handL, -1, P.lb, P.lo, P.lr, 600, lagL), arm(K.shR, K.handR, 1, P.rb, P.ro, P.rr, 700, lagR)];""",
"""    act.hands = [arm(K.shL, K.handL, -1, P.lb, P.lo, P.lr, 600, lagL, 0), arm(K.shR, K.handR, 1, P.rb, P.ro, P.rr, 700, lagR, 1)];""")

# ---------------------------------------------------------------- C) people's arms (father, mother, children, the extras)
rep("""      const hx = hand[0] + D.hand[0] * rel, hy = hand[1] + D.hand[1] * rel * 0.6, d = Math.hypot(hx - sh[0], hy - sh[1]), slack = Math.sqrt(Math.max(0, R.armLen * R.armLen - d * d)) * 0.5;
      const bend = sideIdx ? P.rb : P.lb, nx = -(hy - sh[1]) / (d || 1), ny = (hx - sh[0]) / (d || 1);
      const ex = (sh[0] + hx) / 2 + nx * slack * bend * side, ey = (sh[1] + hy) / 2 + ny * slack * bend * side, id = 600 + sideIdx * 100;
      const pts = boiled([sh[0], sh[1], ex, ey, hx, hy], id);
      hose(g, pts, R.armW, st.arms.fill, st.arms.shade);
      if (st.arms.sleeve) { const s = st.arms.sleeve, e = qpt([pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]], s.len); const m = qpt([pts[0], pts[1]], [pts[2], pts[3]], [pts[4], pts[5]], s.len * 0.5); hose(g, [pts[0], pts[1], m[0], m[1], e[0], e[1]], R.armW + s.extra, s.fill, s.shade); }""",
"""      const J = armIK(sh, [hand[0] + D.hand[0] * rel, hand[1] + D.hand[1] * rel * 0.6], R.armLen, side, act.el && act.el[sideIdx]);
      const hx = J.wr[0], hy = J.wr[1], ex = J.el[0], ey = J.el[1], id = 600 + sideIdx * 100;
      const poly = armPoly(boiled([sh[0], sh[1], ex, ey, hx, hy], id));
      hosePoly(g, poly, R.armW, st.arms.fill, st.arms.shade);
      if (st.arms.sleeve) { const s = st.arms.sleeve; hosePoly(g, polyCut(poly, s.len), R.armW + s.extra, s.fill, s.shade); }
      armNote(act, J);""")

# ---------------------------------------------------------------- D) the elbow side lives in the follow-through sim
rep("""    return { A, P, K, rootX, rootY, f, k, toWorld, toLocal, d, t };
  }""",
"""    return { A, P, K, rootX, rootY, f, k, toWorld, toLocal, d, t, el: s ? s.el : null };
  }""")
rep("""      for (const a of acts) { const tg = targetsOf(a.K, a.toWorld); sim.s[a.A.uid] = {}; for (const k of Object.keys(tg)) sim.s[a.A.uid][k] = { x: tg[k][0], y: tg[k][1], vx: 0, vy: 0 }; }""",
"""      for (const a of acts) { const tg = targetsOf(a.K, a.toWorld); sim.s[a.A.uid] = {}; for (const k of Object.keys(tg)) sim.s[a.A.uid][k] = { x: tg[k][0], y: tg[k][1], vx: 0, vy: 0 }; sim.s[a.A.uid].el = elbowSides(a, null, 0); }""")
rep("""        const tg = targetsOf(a.K, a.toWorld), S = sim.s[a.A.uid];""",
"""        const tg = targetsOf(a.K, a.toWorld), S = sim.s[a.A.uid];
        S.el = elbowSides(a, S.el, DT);""")
rep("""  // follow-through: springs towed by each character's head, hips and shoulders; balloons on their strings""",
"""  const elbowSides = (a, prev, dt) => [elbowTurn(prev && prev[0], a.K.shL, a.K.handL, -1, dt), elbowTurn(prev && prev[1], a.K.shR, a.K.handR, 1, dt)];
  // follow-through: springs towed by each character's head, hips and shoulders; balloons on their strings""")

# ---------------------------------------------------------------- E) held hands meet where both arms can reach
rep("""      if (h.partner) { const p = snap[h.partner]; if (!p) continue; const own = snap[a.A.name][h.side], q = p[h.pside], sh = h.share ?? 0.5; tw = [lerp(own[0], q[0], sh), lerp(own[1], q[1], sh)]; }""",
"""      if (h.partner) { const p = snap[h.partner]; if (!p) continue; const own = snap[a.A.name][h.side], q = p[h.pside], sh = h.share ?? 0.5; tw = [lerp(own[0], q[0], sh), lerp(own[1], q[1], sh)]; if (byName[h.partner]) tw = meetWithin(a, h.side, byName[h.partner], h.pside, tw); }""")
rep("""  // world position of a character's hand (L = 0, R = 1) as drawn (glove centre)""",
"""  // two hands that hold each other meet at a point both arms reach (both partners get the same point)
  function meetWithin(a, sa, b, sb, p) {
    const D = [[a, sa], [b, sb]].sort((x, y) => (x[0].A.name < y[0].A.name ? -1 : 1)).map(([q, s]) => { const c = q.toWorld(s ? q.K.shR : q.K.shL); return [c[0], c[1], q.A.st.rig.armLen * q.k * 0.97, q.A.st.rig.armLen * q.k * 0.55]; });
    const cd = Math.hypot(D[1][0] - D[0][0], D[1][1] - D[0][1]);
    if (cd > D[0][2] + D[1][2]) { const u = D[0][2] / (D[0][2] + D[1][2]); return [lerp(D[0][0], D[1][0], u), lerp(D[0][1], D[1][1], u)]; }
    let x = p[0], y = p[1];
    // inside both reaches, and not so close to either shoulder that the arm must fold up (a small child's hand is
    // taken lower, by the grown-up's arm, rather than pressed into the child's shoulder)
    for (let i = 0; i < 10; i++) for (const [cx, cy, r, r0] of D) { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1e-6; const q = clamp(d, r0, r); if (q !== d) { x = cx + (dx / d) * q; y = cy + (dy / d) * q; } }
    return [x, y];
  }
  // world position of a character's hand (L = 0, R = 1) as drawn (glove centre)""")

# ---------------------------------------------------------------- F) the debug view is drawn over each character
rep("""    a.A.st.draw(g, a);
    a.handsW = (a.hands || []).map((h) => (h ? a.toWorld(h) : null));
    g.restore(); boil.base = 0; boil.ink = 1;""",
"""    a.armJ = null; a.A.st.draw(g, a);
    a.handsW = (a.hands || []).map((h) => (h ? a.toWorld(h) : null));
    g.restore(); boil.base = 0; boil.ink = 1;
    if (ARMDBG.on) drawArmDebug(g, a, cam);""")
rep("""    _debug: { SHOTS, evalAll, cues: () => animationCues() },""",
"""    _debug: { SHOTS, evalAll, cues: () => animationCues(), arms: ARMDBG },""")

# ---------------------------------------------------------------- G) the sim lands exactly on the picture's time
# (it stepped in whole 1/48 s steps from the shot's start, so it could trail the frame by up to 1/48 s; on a fast
# move that made the hands' follow-through jitter from frame to frame)
rep("""  function stepSim(shot, sim, t) {
    const DT = 1 / 48;""", """  function stepSim(shot, sim, t) {
    const DT0 = 1 / 48;""")
rep("""    while (sim.t + DT <= t + 1e-9) {
      sim.t += DT;
      const { acts, byName } = evalAll(shot, sim.t, null);""", """    while (sim.t < t - 1e-6) {
      const DT = Math.min(DT0, t - sim.t); sim.t += DT;
      const { acts, byName } = evalAll(shot, sim.t, null);""")

# ---------------------------------------------------------------- H) clapping happens in front of the chest, at a height the arms reach
rep("""      const c = K.sp(0.72), nn = K.nm(0.72), rate = A.clapHz || 4.2, o = (0.5 + 0.5 * Math.cos(t * rate * TAU + A.ph)) * 20 * A.armK + 3, w = P.clap;
      const cx = c[0] + nn[0] * 26 * A.armK, cy = c[1] + nn[1] * 26 * A.armK - 6;""",
"""      const nn = K.nm(0.72), rate = A.clapHz || 4.2, o = (0.5 + 0.5 * Math.cos(t * rate * TAU + A.ph)) * 20 * A.armK + 3, w = P.clap;
      // (arm fix) the hands meet ~0.62 of an arm's length from each shoulder: the elbows bend about 80 degrees
      const mid = [(K.shL[0] + K.shR[0]) / 2, (K.shL[1] + K.shR[1]) / 2], hw = Math.hypot(K.shR[0] - K.shL[0], K.shR[1] - K.shL[1]) / 2;
      const dn = [K.hip[0] - K.top[0], K.hip[1] - K.top[1]], dl = Math.hypot(dn[0], dn[1]) || 1, drop = Math.sqrt(Math.max(0, (0.62 * R.armLen) ** 2 - hw * hw));
      const cx = mid[0] + (dn[0] / dl) * drop + nn[0] * 26 * A.armK, cy = mid[1] + (dn[1] / dl) * drop;""")

# ---------------------------------------------------------------- I) a hand that holds something does not trail behind (no follow-through lag)
rep("""  function armNote(act, J) {""", """  const heldW = (act, idx) => { let w = 0; for (const h of act.A.holds) if (h.side === idx) w = Math.max(w, h.w ? act.P[h.w] || 0 : 1); return clamp(w); };
  function armNote(act, J) {""")
rep("""    const lagL = [D.hand[0] * P.relL, D.hand[1] * P.relL * 0.6], lagR = [D.hand[0] * P.relR, D.hand[1] * P.relR * 0.6];""",
"""    const fL = P.relL * (1 - heldW(act, 0)), fR = P.relR * (1 - heldW(act, 1)), lagL = [D.hand[0] * fL, D.hand[1] * fL * 0.6], lagR = [D.hand[0] * fR, D.hand[1] * fR * 0.6];""")
rep("""      const side = sideIdx ? 1 : -1, sh = sideIdx ? K.shR : K.shL, hand = sideIdx ? K.handR : K.handL, rel = sideIdx ? P.relR : P.relL;""",
"""      const side = sideIdx ? 1 : -1, sh = sideIdx ? K.shR : K.shL, hand = sideIdx ? K.handR : K.handL, rel = (sideIdx ? P.relR : P.relL) * (1 - heldW(act, sideIdx));""")

open(dst, 'w').write(s)
print('patched', dst)
