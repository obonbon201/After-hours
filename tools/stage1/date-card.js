
/* Stage 1: the moment the opening ends the screen cuts to black and the date fades in, white on black:
   "1997年", then "10月31日". It holds for 3 seconds and the lettering fades out; once it is gone the black cuts
   away at once and the game (staff memo) continues.
   Called from the opening's end callback as AH2.dateCard(done). The timing is pure CSS animation, so it stays
   steady even while the game is busy starting up behind the card. */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const FIRST = 0.4, FADE_IN = 1.1, GAP = 1.1, HOLD = 3.0, FADE_OUT = 1.0;
  const OUT_AT = FIRST + GAP + FADE_IN + HOLD;   // 3 s after "10月31日" is fully shown
  AH2.dateCard = function (done) {
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
