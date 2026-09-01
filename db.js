// db.js — database functionality (Supabase/PostgREST): config, headers, queries & logging.
// Depends on logger.js for device/session ids (logger.fp / logger.sid) — load logger.js first.
// Absolute src so external projects that <script src=https://gormb.github.io/_/db.js> can resolve it too.
if (!window.logger) document.write('<script src="https://gormb.github.io/_/logger.js"></script>');
const lg = window.logger;

window.SUPABASE = { url: "https://nlxtqmsghslwgbndxboe.supabase.co", publishableKey: "sb_publishable_H1UyOW06sr_Y6TkCai5OjQ_5rkdhfdO" };

// Shared event logging for index.html, loggable.html etc. Logs to the "log" table via the log_visit RPC.
// Creates/keeps a session id in sessionStorage (reused across pages in the same tab session).
window.logVisit = (k, u) => {
  if (!window.SUPABASE || window.SUPABASE.url.includes('YOUR-')) return;
  let s = sessionStorage.getItem('sid'); if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('sid', s); }
  const d = { sid: s, r: document.referrer, ua: navigator.userAgent, p: navigator.platform, l: navigator.language, z: Intl.DateTimeFormat().resolvedOptions().timeZone, s: [screen.width, screen.height], d: screen.colorDepth, x: devicePixelRatio, c: navigator.hardwareConcurrency, m: navigator.deviceMemory, t: navigator.maxTouchPoints };
  fetch(window.SUPABASE.url + "/rest/v1/rpc/log_visit", { method: "POST", keepalive: true, headers: { apikey: window.SUPABASE.publishableKey, 'Authorization': 'Bearer ' + window.SUPABASE.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ k, u, d }) }).catch(() => {});
};

// PostgREST REST headers — samme som logVisit.
const h = () => ({ apikey: window.SUPABASE.publishableKey, 'Authorization': 'Bearer ' + window.SUPABASE.publishableKey, 'Content-Type': 'application/json' });

window.db = {
  h,
  // felles hjelper: de nyeste `use_limit` distinkte enhetene som har aktivert koden (rullerende basert på use).
  async _active(code, use_limit) {
    const e = encodeURIComponent;
    const u = await fetch(window.SUPABASE.url + '/rest/v1/usage?code_id=eq.' + e(code) + '&event=eq.premium_activate&select=fingerprint&order=created_at.desc', { headers: h() });
    if (!u.ok) throw new Error('usage ' + u.status);
    const myFp = lg.fp(), active = [], seen = new Set();
    for (const x of (await u.json())) {
      if (seen.has(x.fingerprint)) continue;
      seen.add(x.fingerprint); active.push(x.fingerprint);
      if (use_limit != null && active.length >= use_limit) break;
    }
    return { myFp, active };
  },
  // codeValid (INNTASTING) – sier ALDRI «nei» for en gyldig kode:
  //   {ok:true}                            = gyldig (riktig bok, innenfor dtfrom..dtto)
  //   {ok:false, reason:'notfound'}        = koden finnes ikke for denne boken
  //   {ok:false, reason:'window'}          = koden finnes, men utenfor dtfrom..dtto
  //   {ok:false, reason:'error'}           = TEKNISK feil: serveren svarte med HTTP-feil (f.eks. PostgREST 4xx/5xx)
  //   {ok:false, reason:'connection'}      = TILKOBLINGSFEIL: fetch kastet (nettverk/offline/CORS) – ingen respons
  //   {ok:false, reason:'noconfig'}        = Supabase ikke konfigurert / ingen kode
  async codeValid(code, book) {
    if (!window.SUPABASE || window.SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const e = encodeURIComponent;
      const r = await fetch(window.SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto', { headers: h() });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status }; // serveren svarte med feil = teknisk feil
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      return { ok: true }; // gyldig kode → ALDRI avvist ved inntasting (samtidig-bruk håndteres av stillValid ved restore)
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; } // fetch kastet = tilkoblingsfeil
  },
  // stillValid (ETTER lasting fra localStorage) – «er jeg fortsatt OK?» (samme limit-sjekk som codeValid)
  // Rullerende bruk basert på USE: de nyeste `use_limit` enhetene er aktive; eldre ruller ut.
  //   {ok:true}   = fortsatt OK → premium gjenopprettes
  //   {ok:false}  = ikke OK (full av andre / utløpt) → be om koden igjen
  async stillValid(code, book) {
    if (!window.SUPABASE || window.SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const e = encodeURIComponent;
      const r = await fetch(window.SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto,use_limit', { headers: h() });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status };
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      if (row.use_limit == null) return { ok: true }; // ubegrenset
      const { myFp, active } = await this._active(row.code, row.use_limit);
      // Diagnostikk: unike åpnet (bok) / brukt (kode) / tillatt (use_limit)
      try {
        const p = await fetch(window.SUPABASE.url + '/rest/v1/usage?book=eq.' + e(book || '') + '&event=eq.page&select=fingerprint', { headers: h() });
        const opened = p.ok ? new Set((await p.json()).map(x => x.fingerprint)).size : 'feil';
        console.log('[stillValid]', code, 'opened:', opened, '| used:', active.length, '| permitted:', row.use_limit, '| this device OK:', active.includes(myFp));
      } catch (e2) { console.log('[stillValid]', code, 'opened: feil', e2?.message); }
      if (active.includes(myFp) || active.length < row.use_limit) return { ok: true };
      return { ok: false }; // full av andre → be om koden igjen
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; }
  },
  // hent premium-recheck-intervall (sek) for en bok – default 60.
  async bookInterval(book) {
    if (!window.SUPABASE || window.SUPABASE.url.includes('YOUR-')) return 60;
    try {
      const e = encodeURIComponent;
      const r = await fetch(window.SUPABASE.url + '/rest/v1/books?book=eq.' + e(book || '') + '&select=premiumCheckInterval', { headers: h() });
      if (!r.ok) return 60;
      const row = (await r.json())[0];
      const v = row && row.premiumCheckInterval;
      return (v == null || !(v > 0)) ? 60 : v;
    } catch (e) { return 60; }
  },
  // Logg hendelse til `usage` (fire-and-forget) – `code` (premium_activate) er grunnlaget for «maks N samtidige».
  logUsage(o = {}) {
    if (!window.SUPABASE || window.SUPABASE.url.includes('YOUR-')) return Promise.resolve();
    const body = {
      fingerprint: lg.fp(), session_id: lg.sid(),
      code_id: o.code || null, book: o.book || null, page: o.page ?? null, event: o.event || ''
    };
    return fetch(window.SUPABASE.url + '/rest/v1/usage', { method: 'POST', headers: h(), body: JSON.stringify(body) }).catch(() => {});
  }
};

// Backward-compat: old callers used db.fp / db.sid / db.hashString — keep them on window.db.
window.db.fp = lg.fp;
window.db.sid = lg.sid;
window.db.hashString = lg.hashString;