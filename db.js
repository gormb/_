window.SUPABASE={url:"https://nlxtqmsghslwgbndxboe.supabase.co",publishableKey:"sb_publishable_H1UyOW06sr_Y6TkCai5OjQ_5rkdhfdO"};
// Visit logging → log_visit RPC (log table); session id reused across pages.
window.logVisit=(k,u)=>{
  if(!SUPABASE||SUPABASE.url.includes('YOUR-'))return
  let sid=sessionStorage.getItem('sid');if(!sid){sid=crypto.randomUUID();sessionStorage.setItem('sid',sid)}
  const d={sid,r:document.referrer,ua:navigator.userAgent,p:navigator.platform,l:navigator.language,z:Intl.DateTimeFormat().resolvedOptions().timeZone,s:[screen.width,screen.height],d:screen.colorDepth,x:devicePixelRatio,c:navigator.hardwareConcurrency,m:navigator.deviceMemory,t:navigator.maxTouchPoints}
  fetch(SUPABASE.url+"/rest/v1/rpc/log_visit",{method:"POST",keepalive:true,headers:{apikey:SUPABASE.publishableKey,'Authorization':'Bearer '+SUPABASE.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({k,u,d})}).catch(()=>{})
}

// Supabase helpers (window.db) — PostgREST REST.
window.db = {
  h() {
    return { apikey: SUPABASE.publishableKey, 'Authorization': 'Bearer ' + SUPABASE.publishableKey, 'Content-Type': 'application/json' };
  },
  // Device fingerprint = hash of browser properties (stable per device).
  hashString(s, seed = 0) { // deterministic 128-bit hash (cyrb53) → UUID, sync
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
  // Rolling: newest `use_limit` distinct devices that activated the code.
  async _active(code, use_limit) {
    const h = db.h(), e = encodeURIComponent;
    const u = await fetch(SUPABASE.url + '/rest/v1/usage?code_id=eq.' + e(code) + '&event=eq.premium_activate&select=fingerprint&order=created_at.desc', { headers: h });
    if (!u.ok) throw new Error('usage ' + u.status);
    const myFp = db.fp(), active = [], seen = new Set();
    for (const x of (await u.json())) {
      if (seen.has(x.fingerprint)) continue;
      seen.add(x.fingerprint); active.push(x.fingerprint);
      if (use_limit != null && active.length >= use_limit) break;
    }
    return { myFp, active };
  },
  // Valid: {ok:true}. Invalid: {ok:false, reason:'notfound'|'window'|'error'|'connection'|'noconfig'}.
  async codeValid(code, book) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-') || !code) return { ok: false, reason: 'noconfig' };
    try {
      const h = db.h(), e = encodeURIComponent;
      const r = await fetch(SUPABASE.url + '/rest/v1/codes?code=eq.' + e(code) + '&book=eq.' + e(book || '') + '&select=code,dtfrom,dtto', { headers: h });
      if (!r.ok) return { ok: false, reason: 'error', status: r.status }; // HTTP error = technical failure
      const row = (await r.json())[0];
      if (!row) return { ok: false, reason: 'notfound' };
      const n = Date.now();
      if (new Date(row.dtfrom).getTime() > n || n > new Date(row.dtto).getTime()) return { ok: false, reason: 'window' };
      return { ok: true }; // never reject a valid code on entry; concurrency handled by stillValid
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; } // fetch threw = connection failure
  },
  // Restore check: {ok:true} if still within window/limit (rolling), else {ok:false}.
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
      if (row.use_limit == null) return { ok: true }; // unlimited
      const { myFp, active } = await this._active(row.code, row.use_limit);
      // Debug: opened (book) vs used (code) vs permitted (use_limit)
      try {
        const p = await fetch(SUPABASE.url + '/rest/v1/usage?book=eq.' + e(book || '') + '&event=eq.page&select=fingerprint', { headers: h });
        const opened = p.ok ? new Set((await p.json()).map(x => x.fingerprint)).size : 'feil';
        console.log('[stillValid]', code, 'opened:', opened, '| used:', active.length, '| permitted:', row.use_limit, '| this device OK:', active.includes(myFp));
      } catch (e2) { console.log('[stillValid]', code, 'opened: feil', e2?.message); }
      if (active.includes(myFp) || active.length < row.use_limit) return { ok: true };
      return { ok: false }; // full → ask for code again
    } catch (e) { return { ok: false, reason: 'connection', error: e?.message }; }
  },
  // Premium recheck interval (s) for a book — default 60.
  async bookInterval(book) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-')) return 60;
    try {
      const h = db.h(), e = encodeURIComponent;
      const r = await fetch(SUPABASE.url + '/rest/v1/books?book=eq.' + e(book || '') + '&select=premiumCheckInterval', { headers: h });
      if (!r.ok) return 60;
      const row = (await r.json())[0];
      const v = row && row.premiumCheckInterval;
      return (v == null || !(v > 0)) ? 60 : v;
    } catch (e) { return 60; }
  },
  // Log event to usage table (fire-and-forget).
  logUsage(o = {}) {
    if (!SUPABASE || SUPABASE.url.includes('YOUR-')) return Promise.resolve();
    const body = {
      fingerprint: db.fp(), session_id: db.sid(),
      code_id: o.code || null, book: o.book || null, page: o.page ?? null, event: o.event || ''
    };
    return fetch(SUPABASE.url + '/rest/v1/usage', { method: 'POST', headers: db.h(), body: JSON.stringify(body) }).catch(() => {});
  }
};