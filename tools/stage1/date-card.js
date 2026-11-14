
/* Stage 1: the moment the opening ends the screen cuts to black and the date fades in, white on black:
   "1997年", then "10月31日". It holds for 3 seconds and the lettering fades out; once it is gone the black cuts
   away at once and the game (staff memo) continues.
   Called from the opening's end callback as AH2.dateCard(done). The timing is pure CSS animation, so it stays
   steady even while the game is busy starting up behind the card.
   Sound over the black: an old telephone rings into its second call, the receiver is picked up and a voice speaks
   down the line (phone-voice.mp3, if present); the date waits ~3 s for the pickup and the card holds until the
   voice has finished. */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const RING_AT = 1.0;                                 // a moment of silence in the black before the phone rings
  const RING_END = RING_AT + 2.62, VOICE_AT = RING_END + 0.4;   // the ring is cut mid second call; the voice follows the pickup
  const FIRST = RING_AT + 3.4, FADE_IN = 1.1, GAP = 1.1, HOLD = 3.0, FADE_OUT = 1.0;

  // --- the telephone: buffers decoded on the game's audio context as soon as there is one
  let host = null;
  const FILES = { ring: './assets/audio/sfx/phone-ring.mp3', pickup: './assets/audio/sfx/phone-pickup.mp3', voice: './assets/audio/sfx/phone-voice.mp3' };
  const bytes = {}, buf = {};
  const decode = () => {
    const a = host && host.audio; if (!a || !a.ctx) return;
    for (const k of Object.keys(bytes)) { if (buf[k] || !bytes[k]) continue; const b = bytes[k]; bytes[k] = null; a.ctx.decodeAudioData(b, (x) => { buf[k] = x; }, () => {}); }
  };
  for (const [k, url] of Object.entries(FILES)) fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (b) { bytes[k] = b; decode(); } }).catch(() => {});
  const previousMount = AH2.mount;
  AH2.mount = function (h) { const r = previousMount ? previousMount.apply(this, arguments) : undefined; host = h; decode(); const iv = setInterval(() => { decode(); if (buf.ring && buf.pickup) clearInterval(iv); }, 1000); return r; };
  const play = (k, at, gain) => {
    const a = host && host.audio; if (!a || !a.ctx || !a.master || !buf[k]) return 0;
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    const s = a.ctx.createBufferSource(), g = a.ctx.createGain(); g.gain.value = gain; s.buffer = buf[k]; s.connect(g).connect(a.master); s.start(a.ctx.currentTime + at);
    return buf[k].duration;
  };

  AH2.dateCard = function (done) {
    decode();
    play('ring', RING_AT, 0.5); play('pickup', RING_END, 0.9);
    const voiceLen = play('voice', VOICE_AT, 1.0);
    // 3 s after "10月31日" is fully shown, or once the voice on the line has finished
    const OUT_AT = Math.max(FIRST + GAP + FADE_IN + HOLD, voiceLen ? VOICE_AT + voiceLen + 0.6 : 0);
    let finished = false;
    const finish = () => { if (finished) return; finished = true; try { done && done(); } catch (e) { console.warn('[date-card]', e); } };
    try {
      const css = document.createElement('style');
      css.textContent =
        '@keyframes ahDateIn{from{opacity:0}to{opacity:1}}@keyframes ahDateOut{from{opacity:1}to{opacity:0}}' +
        '#ah-date-card{position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center;' +
        'pointer-events:auto}' +
        '#ah-date-card .row{animation:ahDateOut ' + FADE_OUT + 's ease ' + OUT_AT + 's both;display:flex;gap:.9em;align-items:baseline;color:#fff;font-family:"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif;' +
        'font-size:clamp(22px,5.2vmin,44px);letter-spacing:.18em;font-weight:500;text-shadow:0 0 12px rgba(255,255,255,.18)}' +
        '#ah-date-card span{opacity:0;animation:ahDateIn ' + FADE_IN + 's ease both}' +
        '#ah-date-card span.a{animation-delay:' + FIRST + 's}#ah-date-card span.b{animation-delay:' + (FIRST + GAP) + 's}';
      const card = document.createElement('div');
      card.id = 'ah-date-card';
      card.setAttribute('aria-live', 'polite');
      card.innerHTML = '<div class="row"><span class="a">1997年</span><span class="b">10月31日</span></div>';
      // only the lettering fades out; the black cuts away the moment it has gone
      card.addEventListener('animationend', (e) => {
        if (e.animationName !== 'ahDateOut') return;
        card.remove(); css.remove(); finish();
      });
      document.head.appendChild(css);
      document.body.appendChild(card);
      // safety net in case animation events never arrive (e.g. the tab was hidden)
      setTimeout(() => { if (!finished) { card.remove(); css.remove(); finish(); } }, (OUT_AT + FADE_OUT + 4) * 1000);
    } catch (e) {
      console.warn('[date-card]', e);
      finish();
    }
  };
})();
