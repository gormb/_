window.SUPABASE={url:"https://nlxtqmsghslwgbndxboe.supabase.co",publishableKey:"sb_publishable_H1UyOW06sr_Y6TkCai5OjQ_5rkdhfdO"};
// Shared event logging for index.html, loggable.html etc. Logs to the "log" table via the log_visit RPC.
// Creates/keeps a session id in sessionStorage (reused across pages in the same tab session).
window.logVisit=(k,u)=>{
  if(!SUPABASE||SUPABASE.url.includes('YOUR-'))return
  let sid=sessionStorage.getItem('sid');if(!sid){sid=crypto.randomUUID();sessionStorage.setItem('sid',sid)}
  const d={sid,r:document.referrer,ua:navigator.userAgent,p:navigator.platform,l:navigator.language,z:Intl.DateTimeFormat().resolvedOptions().timeZone,s:[screen.width,screen.height],d:screen.colorDepth,x:devicePixelRatio,c:navigator.hardwareConcurrency,m:navigator.deviceMemory,t:navigator.maxTouchPoints}
  fetch(SUPABASE.url+"/rest/v1/rpc/log_visit",{method:"POST",keepalive:true,headers:{apikey:SUPABASE.publishableKey,'Authorization':'Bearer '+SUPABASE.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({k,u,d})}).catch(()=>{})
}

// Shared Supabase helpers (window.db) — PostgREST REST, samme headers som logVisit.
window.db = {
  h() {
    return { apikey: SUPABASE.publishableKey, 'Authorization': 'Bearer ' + SUPABASE.publishableKey, 'Content-Type': 'application/json' };
  },
  // Vedvarende enhets-fingerprint = HASH av browser-egenskaper (stabil per enhet, på tvers av økter).
  // «hashing a lot of browser stuff»: userAgent/platform/språk/tidssone/skjerm osv.
  hashString(s, seed = 0) { // deterministisk 128-bit-hash (cyrb53-basert) formatert som UUID – synkron
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
  },
  fp() {
    let f = localStorage.getItem('LdD.fp');
    if (!f) {
      const parts = [navigator.userAgent, navigator.platform, navigator.language,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen.width, screen.height, screen.colorDepth, devicePixelRatio,
        navigator.hardwareConcurrency, navigator.maxTouchPoints];
      f = db.hashString(parts.join('|'));
      localStorage.setItem('LdD.fp', f);
    }
    return f;
  },
  sid() {
    let s = sessionStorage.getItem('LdD.sid');
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('LdD.sid', s); }
    return s;
  },
  // codeValid (INNTASTING) – sier ALDRI «nei» for en gyldig kode:
  //   {ok:true}                            = gyldig (riktig bok, innenfor dtfrom..dtto)
  //   {ok:false, reason:'notfound'}        = koden finnes ikke for denne boken
  //   {ok:false, reason:'window'}          = koden finnes, men utenfor dtfrom..dtto
  //   {ok:false, reason:'error'}           = TEKNISK feil: serveren svarte med HTTP-feil (f.eks. PostgREST 4xx/5xx)
  //   {ok:false, reason:'connection'}      = TILKOBLINGSFEIL: fetch kastet (nettverk/offline/CORS) – ingen respons
  //   {ok:false, reason:'noconfig'}        = Supabase ikke konfigurert / ingen kode
  async codeValid(code, book) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const h = db.h(), e = encodeURIComponent;
      const r = await fetch(SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto', { headers: h });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status }; // serveren svarte med feil = teknisk feil
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      return { ok: true }; // gyldig kode → ALDRI avvist ved inntasting (samtidig-bruk håndteres av stillValid)
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; } // fetch kastet = tilkoblingsfeil
  },
  // stillValid (ETTER lasting fra localStorage) – «er jeg fortsatt OK?»
  // Rullerende bruk basert på USE (ingen fast tidsvindu): de NYESTE `use_limit` distinkte
  // enhetene er aktive; eldre bruk ruller ut (blir ugyldig). Hvis ikke OK → be om koden igjen.
  //   {ok:true}   = denne enheten er fortsatt blant de nyeste brukerne av koden
  //   {ok:false}  = enheten er rullet ut (gammel) → be om koden igjen
  async stillValid(code, book) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const h = db.h(), e = encodeURIComponent;
      const r = await fetch(SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto,use_limit', { headers: h });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status };
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      if (row.use_limit == null) return { ok: true }; // ubegrenset
      // Rullerende bruk basert på use: hent bruksrader nyest først, behold de nyeste distinkte enhetene (opp til use_limit).
      const u = await fetch(SUPABASE.url + '/rest/v1/usage?code_id=eq.' + e(row.code) + '&event=eq.premium_activate&select=fingerprint&order=created_at.desc', { headers: h });
      if (!u.ok) return { ok: false, reason: 'error', status: u.status };
      const myFp = db.fp();
      const active = [], seen = new Set();
      for (const x of (await u.json())) {
        if (seen.has(x.fingerprint)) continue;
        seen.add(x.fingerprint); active.push(x.fingerprint);
        if (active.length >= row.use_limit) break; // bare de nyeste `use_limit` enhetene teller
      }
      // Diagnostikk: unike åpnet (bok) / brukt (kode) / tillatt (use_limit)
      try {
        const p = await fetch(SUPABASE.url + '/rest/v1/usage?book=eq.' + e(book || '') + '&event=eq.page&select=fingerprint', { headers: h });
        const opened = p.ok ? new Set((await p.json()).map(x => x.fingerprint)).size : 'feil';
        console.log('[stillValid]', code, 'opened:', opened, '| used:', active.length, '| permitted:', row.use_limit, '| this device OK:', active.includes(myFp));
      } catch (e2) { console.log('[stillValid]', code, 'opened: feil', e2?.message); }
      return { ok: active.includes(myFp) }; // er denne enheten blant de nyeste? Ellers → be om koden igjen
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; }
  },
  // Logg hendelse til `usage` (fire-and-forget) – `code` (premium_activate) er grunnlaget for «maks N samtidige».
  logUsage(o = {}) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-')) return Promise.resolve();
    const body = {
      fingerprint: db.fp(), session_id: db.sid(),
      code_id: o.code || null, book: o.book || null, page: o.page ?? null, event: o.event || ''
    };
    return fetch(SUPABASE.url + '/rest/v1/usage', { method: 'POST', headers: db.h(), body: JSON.stringify(body) }).catch(() => {});
  }
};