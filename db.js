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
  // Vedvarende enhets-fingerprint (localStorage) + økt-id (sessionStorage) – for usage-logg.
  fp() {
    let f = localStorage.getItem('LdD.fp');
    if (!f) { f = crypto.randomUUID(); localStorage.setItem('LdD.fp', f); }
    return f;
  },
  sid() {
    let s = sessionStorage.getItem('LdD.sid');
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('LdD.sid', s); }
    return s;
  },
  // Returnerer resultatobjekt (ikke bool), så kallere kan skille
  // "ugyldig kode" fra "tekniske feil" og "tilkoblingsfeil":
  //   {ok:true}                            = gyldig (riktig bok, innenfor dtfrom..dtto, under use_limit)
  //   {ok:false, reason:'notfound'}        = koden finnes ikke for denne boken
  //   {ok:false, reason:'window'}          = koden finnes, men utenfor dtfrom..dtto
  //   {ok:false, reason:'limit'}           = use_limit er nådd (koden er brukt opp)
  //   {ok:false, reason:'error'}           = TEKNISK feil: serveren svarte med HTTP-feil (f.eks. PostgREST 4xx/5xx)
  //   {ok:false, reason:'connection'}      = TILKOBLINGSFEIL: fetch kastet (nettverk/offline/CORS) – ingen respons
  //   {ok:false, reason:'noconfig'}        = Supabase ikke konfigurert / ingen kode
  async codeValid(code, book) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const h = db.h(), e = encodeURIComponent;
      const r = await fetch(SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto,use_limit', { headers: h });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status }; // serveren svarte med feil = teknisk feil
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      if (row.use_limit == null) return { ok: true }; // ubegrenset
      const u = await fetch(SUPABASE.url + '/rest/v1/usage?code_id=eq.' + e(row.code) + '&select=id', { headers: h });
      if (!u.ok) return { ok: false, reason: 'error', status: u.status };
      if ((await u.json()).length >= row.use_limit) return { ok: false, reason: 'limit' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; } // fetch kastet = tilkoblingsfeil
  },
  // Logg hendelse til `usage` (fire-and-forget) – `code` (premium_activate) teller mot use_limit.
  logUsage(o = {}) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-')) return Promise.resolve();
    const body = {
      fingerprint: db.fp(), session_id: db.sid(),
      code_id: o.code || null, book: o.book || null, page: o.page ?? null, event: o.event || ''
    };
    return fetch(SUPABASE.url + '/rest/v1/usage', { method: 'POST', headers: db.h(), body: JSON.stringify(body) }).catch(() => {});
  }
};