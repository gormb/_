// logger.js — id stuff & tracing: stable device/session identifiers.
// Exposed as window.logger. Purely local (no Supabase/db calls) — database
// functionality lives in db.js (window.db), which uses these ids.
window.logger = (() => {
  // Vedvarende enhets-fingerprint = HASH av browser-egenskaper (stabil per enhet, på tvers av økter).
  // «hashing a lot of browser stuff»: userAgent/platform/språk/tidssone/skjerm osv.
  const hashString = (s, seed = 0) => { // deterministisk 128-bit-hash (cyrb53-basert) formatert som UUID – synkron
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < s.length; i++) {
      ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex = n => (n >>> 0).toString(16).padStart(8, '0');
    const a = hex(h1) + hex(h1 >>> 16) + hex(h2) + hex(h2 >>> 16);
    return (a.slice(0, 8) + '-' + a.slice(8, 12) + '-4' + a.slice(13, 16) + '-' + ((8 + (a.charCodeAt(16) % 4)).toString(16)) + a.slice(17, 20) + '-' + a.slice(20, 32)).toLowerCase();
  };

  // Stable per-device fingerprint (id) — localStorage.
  const fp = () => {
    let f = localStorage.getItem('LdD.fp');
    if (!f) {
      const parts = [navigator.userAgent, navigator.platform, navigator.language,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen.width, screen.height, screen.colorDepth, devicePixelRatio,
        navigator.hardwareConcurrency, navigator.maxTouchPoints];
      f = hashString(parts.join('|'));
      localStorage.setItem('LdD.fp', f);
    }
    return f;
  };

  // Session id — sessionStorage (per tab session).
  const sid = () => {
    let s = sessionStorage.getItem('LdD.sid');
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('LdD.sid', s); }
    return s;
  };

  return { hashString, fp, sid };
})();
