
/* Subtitle line breaks: long lines are broken at a natural place (after 、。！？, otherwise after a particle such
   as が・で・を・に) so each line stays short and clear of the touch buttons. Used as AH2.subBreak(text). */
(() => {
  const AH2 = (window.AH2 = window.AH2 || {});
  const MAX = 18;                                   // characters per line before a break is wanted
  const STRONG = '、。！？!?…」';
  const PARTICLE = 'はがをにでへもの';
  const split = (s) => {
    const n = [...s].length;
    if (n <= MAX) return [s];
    const ch = [...s];
    let best = -1, bestCost = Infinity;
    for (let i = 3; i < n - 3; i++) {               // break after ch[i]; keep at least 4 characters on each side
      const c = ch[i], next = ch[i + 1];
      let w;
      if (STRONG.includes(c) && !STRONG.includes(next)) w = 0;
      else if (c === ' ' && next !== ' ') w = 1;
      else if (PARTICLE.includes(c) && !/[ぁ-ゖー、。]/.test(next)) w = 7;   // a particle followed by a new word
      else continue;
      const left = i + 1, right = n - left;
      const cost = Math.abs(left - right) + w + (Math.max(left, right) > MAX ? 4 : 0);
      if (cost < bestCost) { bestCost = cost; best = left; }
    }
    if (best < 0) return [s];
    const a = ch.slice(0, best).join('').trim(), b = ch.slice(best).join('').trim();
    return [...split(a), ...split(b)];
  };
  AH2.subBreak = (text) => {
    if (typeof text !== 'string' || !text || text.includes('\n')) return text;
    return split(text).join('\n');
  };
})();
