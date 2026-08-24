window.SUPABASE={url:"https://nlxtqmsghslwgbndxboe.supabase.co",publishableKey:"sb_publishable_H1UyOW06sr_Y6TkCai5OjQ_5rkdhfdO"};
// Shared event logging for index.html, loggable.html etc. Logs to the "log" table via the log_visit RPC.
// Creates/keeps a session id in sessionStorage (reused across pages in the same tab session).
window.logVisit=(k,u)=>{
  if(!SUPABASE||SUPABASE.url.includes('YOUR-'))return
  let sid=sessionStorage.getItem('sid');if(!sid){sid=crypto.randomUUID();sessionStorage.setItem('sid',sid)}
  const d={sid,r:document.referrer,ua:navigator.userAgent,p:navigator.platform,l:navigator.language,z:Intl.DateTimeFormat().resolvedOptions().timeZone,s:[screen.width,screen.height],d:screen.colorDepth,x:devicePixelRatio,c:navigator.hardwareConcurrency,m:navigator.deviceMemory,t:navigator.maxTouchPoints}
  fetch(SUPABASE.url+"/rest/v1/rpc/log_visit",{method:"POST",keepalive:true,headers:{apikey:SUPABASE.publishableKey,'Authorization':'Bearer '+SUPABASE.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({k,u,d})}).catch(()=>{})
}
