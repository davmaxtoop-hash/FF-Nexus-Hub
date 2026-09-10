function showToast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.style.display="block";clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.style.display="none",2800)}

/* ===== PUBLIC PAID LISTING APPLICATIONS / PAYSTACK ===== */
const PUBLIC_ADMIN_DATA_KEY="ff_nexus_hub_admin_data";
let PAYSTACK_PUBLIC_KEY="pk_test_aa24b40e2dc0408ac5cdc038b117f6dd191d5a3c";
let SERVER_LISTING_FEE=null;
async function loadServerConfig(){try{const r=await fetch('/api/config');if(!r.ok)return;const d=await r.json();if(Number.isFinite(Number(d.listingFee))&&Number(d.listingFee)>0)SERVER_LISTING_FEE=Number(d.listingFee);if(d.paystackPublicKey)PAYSTACK_PUBLIC_KEY=String(d.paystackPublicKey)}catch(e){}}
function publicAdminData(){try{return JSON.parse(localStorage.getItem(PUBLIC_ADMIN_DATA_KEY)||"{}")}catch(e){return {}}}
function publicListingFee(){
  if(SERVER_LISTING_FEE) return SERVER_LISTING_FEE;
  const d=publicAdminData(), raw=d.siteSettings?.listingFee;
  const n=Number(String(raw??"").replace(/[^0-9.]/g,""));
  return Number.isFinite(n) && n>0 ? n : 10000;
}
function formatNaira(amount){return "₦"+Number(amount||0).toLocaleString("en-NG");}
function openListingApplication(type){
  const listingFee=publicListingFee();
  const isPaid=type!=="player";
  const labels={creator:"Creator",vendor:"Vendor",player:"Player"};
  const label=labels[type]||"Listing";
  const fields= type==="creator" ? `
    <label>Full Name *<input name="name" required></label>
    <label>Email Address *<input name="email" type="email" required placeholder="you@example.com"></label>
    <label>Free Fire UID *<input name="uid" required></label>
    <label>In-game Name<input name="ign"></label>
    <label>Main Platform<input name="platform" placeholder="TikTok / YouTube / Instagram"></label>
    <label>Content Type<input name="category" placeholder="Rush, tips, highlights..."></label>
    <label>Bio / Useful Information<textarea name="details" required></textarea></label>
    <label>Social Media Link<input name="social"></label>
    <label>Profile Picture *<input name="image" type="file" accept="image/*" required></label>` : type==="vendor" ? `
    <label>Business / Vendor Name *<input name="name" required></label>
    <label>Contact Person *<input name="contact" required></label>
    <label>Email Address *<input name="email" type="email" required placeholder="business@example.com"></label>
    <label>Phone Number *<input name="phone" required></label>
    <label>WhatsApp Number<input name="whatsapp"></label>
    <label>Business Category<input name="category" placeholder="Top-up, accounts, gaming services..."></label>
    <label>Business Location<input name="location"></label>
    <label>Business Description *<textarea name="details" required></textarea></label>
    <label>Website / Social Link<input name="social"></label>
    <label>Business Logo *<input name="image" type="file" accept="image/*" required></label>` : `
    <label>Full Name *<input name="name" required></label>
    <label>Email Address *<input name="email" type="email" required></label>
    <label>Free Fire UID *<input name="uid" required></label>
    <label>In-game Name *<input name="ign" required></label>
    <label>Playstyle<input name="style" placeholder="Rush / Passive"></label>
    <label>Preferred Mode<input name="mode" placeholder="Ranked / Clash Squad"></label>
    <label>About You / Useful Information<textarea name="details" required></textarea></label>
    <label>Contact / Social Link<input name="social"></label>
    <label>Profile Picture<input name="image" type="file" accept="image/*"></label>`;
  const paymentFields=isPaid?`
      <div class="payment-business-box">
        <div class="payment-business-head"><div><span class="payment-eyebrow">SECURE PAYSTACK PAYMENT</span><h3>Listing fee: ${escapePublic(formatNaira(listingFee))}</h3><p>You'll be taken to secure Paystack Checkout. No account number or receipt upload is required.</p></div><span class="payment-step">PAYSTACK</span></div>
        <div class="payment-instruction"><strong>Automatic payment</strong><span>1. Submit your application details.</span><span>2. Pay ${escapePublic(formatNaira(listingFee))} securely on Paystack.</span><span>3. Paystack confirms the payment automatically and your application moves to admin review.</span></div>
      </div>`:"<div class=\"player-free-box\"><strong>FREE PLAYER REGISTRATION</strong><span>No payment is required for player registration. Your application will be reviewed by an admin before it is published.</span></div>";
  const overlay=document.createElement("div"); overlay.className="public-apply-overlay";
  overlay.innerHTML=`<div class="public-apply-modal"><button type="button" class="public-apply-close">×</button>
    <h2>Apply as ${label}</h2><p>${isPaid?`Complete your details, then you'll be sent to secure Paystack Checkout for ${escapePublic(formatNaira(listingFee))}.`:`Complete your details. Player registration is free and will be reviewed by an admin before publishing.`}</p>
    <form id="publicApplyForm">${fields}${paymentFields}
      <button class="btn primary full" type="submit">${isPaid?"Continue to Paystack":"Submit Player Application"}</button>
    </form><p class="public-apply-note">${isPaid?"Your listing is not published until payment is confirmed and an admin approves it.":"Your information is not published until an admin reviews and approves it."}</p></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".public-apply-close").onclick=()=>overlay.remove();
  overlay.querySelector("form").addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.target, fd=new FormData(form), imageFile=form.elements.image?.files?.[0];
    if(imageFile && imageFile.size>3*1024*1024)return alert("Profile/logo image must be under 3 MB.");
    const read=file=>new Promise((resolve,reject)=>{if(!file)return resolve("");const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const submitBtn=form.querySelector('button[type="submit"]');
    submitBtn.disabled=true; submitBtn.textContent=isPaid?"Opening Paystack…":"Submitting…";
    try{
      const image=await read(imageFile);
      const item={type,name:fd.get("name")||"",email:fd.get("email")||"",uid:fd.get("uid")||"",ign:fd.get("ign")||"",details:fd.get("details")||"",category:fd.get("category")||"",phone:fd.get("phone")||"",whatsapp:fd.get("whatsapp")||"",location:fd.get("location")||"",social:fd.get("social")||"",platform:fd.get("platform")||"",style:fd.get("style")||"",mode:fd.get("mode")||"",contact:fd.get("contact")||"",image,paymentAmount:isPaid?listingFee:0};
      const r=await fetch(isPaid?"/api/paystack/initialize":"/api/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});
      const x=await r.json(); if(!r.ok)throw new Error(x.error||"Could not submit application.");
      if(isPaid){
        if(!x.authorization_url)throw new Error("Paystack did not return a checkout URL.");
        window.location.href=x.authorization_url;
        return;
      }
      overlay.remove();showToast("Player application submitted. It will be added after admin approval.");
    }catch(err){
      console.error(err); submitBtn.disabled=false; submitBtn.textContent=isPaid?"Continue to Paystack":"Submit Player Application";
      showToast(err.message||"Something went wrong.");
    }
  });
}
function escapePublic(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}

/* ===== PLAYER ACCOUNTS / NEON DATABASE ===== */
const PLAYER_TOKEN_KEY="ff_nexus_player_token";
const PLAYER_PROFILE_KEY="ff_nexus_player_profile";
function playerToken(){return localStorage.getItem(PLAYER_TOKEN_KEY)||""}
function playerLoggedIn(){return !!playerToken()}
function playerHeaders(){return {"Content-Type":"application/json","Authorization":"Bearer "+playerToken()}}
function playerApi(path,options={}){return fetch(path,{...options,headers:{...(options.headers||{}),...(options.body?{"Content-Type":"application/json"}:{}),...(playerToken()?{"Authorization":"Bearer "+playerToken()}: {})}}).then(async r=>{let d={};try{d=await r.json()}catch(e){}if(!r.ok)throw new Error(d.error||"Something went wrong.");return d})}
function playerModal(html){const o=document.createElement("div");o.className="player-account-overlay";o.innerHTML=`<div class="player-account-modal"><button class="player-account-close" type="button">×</button>${html}</div>`;document.body.appendChild(o);o.querySelector(".player-account-close").onclick=()=>o.remove();return o}
function openPlayerAccount(){
  if(playerLoggedIn()) return openPlayerProfile();
  const o=playerModal(`<span class="eyebrow">FREE PLAYER ACCOUNT</span><h2>Create your Player Account</h2><p>Join the Nexus for free. No payment is required.</p><form id="playerSignup"><label>Full Name *<input name="fullName" required></label><label>Email Address *<input name="email" type="email" required></label><label>Password *<input name="password" type="password" minlength="6" required></label><label>Free Fire UID *<input name="uid" required></label><label>In-game Name *<input name="ign" required></label><label>WhatsApp Number *<input name="whatsapp" type="tel" required></label><label>Playstyle<input name="playstyle" placeholder="Rush / Passive"></label><label>Preferred Mode<input name="preferredMode" placeholder="Ranked / Clash Squad"></label><button class="btn primary full" type="submit">Create Free Account</button></form><div class="account-message">Already have an account? <button type="button" class="mini" onclick="openPlayerLogin()">Login</button></div><div id="playerAccountMsg"></div>`);
  o.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=e.target;const msg=o.querySelector("#playerAccountMsg");msg.textContent="Creating your account...";try{const body=Object.fromEntries(new FormData(f).entries());const d=await playerApi("/api/players/register",{method:"POST",body:JSON.stringify(body)});localStorage.setItem(PLAYER_TOKEN_KEY,d.token);localStorage.setItem(PLAYER_PROFILE_KEY,JSON.stringify(d.player));o.remove();showToast("Player account created successfully!");refreshPlayerCount();openPlayerProfile();}catch(err){msg.textContent=err.message+" If you are testing locally, make sure DATABASE_URL is configured.";}};
}
function openPlayerLogin(){
  if(playerLoggedIn()) return openPlayerProfile();
  const o=playerModal(`<span class="eyebrow">PLAYER ACCOUNT</span><h2>Welcome back</h2><p>Login to register for tournaments and manage your player profile.</p><form id="playerLogin"><label>Email Address *<input name="email" type="email" required></label><label>Password *<input name="password" type="password" required></label><button class="btn primary full" type="submit">Login</button></form><div class="account-message">New player? <button type="button" class="mini" onclick="openPlayerAccount()">Create Free Account</button></div><div id="playerAccountMsg"></div>`);
  o.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=e.target,msg=o.querySelector("#playerAccountMsg");msg.textContent="Signing in...";try{const d=await playerApi("/api/players/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(f).entries()))});localStorage.setItem(PLAYER_TOKEN_KEY,d.token);localStorage.setItem(PLAYER_PROFILE_KEY,JSON.stringify(d.player));o.remove();showToast("Welcome back!");openPlayerProfile();}catch(err){msg.textContent=err.message;}};
}
async function openPlayerProfile(){
  let p={};try{p=JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)||"{}")}catch(e){}
  const o=playerModal(`<span class="eyebrow">MY NEXUS ACCOUNT</span><h2>Player Dashboard</h2><div id="playerDashboardData"><div class="player-account-card"><b>${escapePublic(p.ign||"Player")}</b><small>${escapePublic(p.full_name||"")} • UID ${escapePublic(p.uid||"")}</small><p>${escapePublic(p.email||"")}<br>WhatsApp: ${escapePublic(p.whatsapp||"")}</p></div><p>Loading your stats...</p></div><button class="btn primary full" type="button" onclick="document.querySelector('.player-account-overlay')?.remove();location.hash='tournaments'">Find Tournaments</button><button class="btn ghost full account-logout" type="button" onclick="playerLogout()">Logout</button>`);
  try{const [stats,notes]=await Promise.all([playerApi('/api/players/me/stats'),playerApi('/api/players/me/notifications')]);const st=stats.stats||{};const regs=stats.registrations||[];const unread=(notes.notifications||[]).filter(n=>!n.is_read);o.querySelector('#playerDashboardData').innerHTML=`<div class="player-account-card"><b>${escapePublic(p.ign||"Player")} ${st.verified?'<span class="badge verified">✓ VERIFIED</span>':''}</b><small>${escapePublic(p.full_name||"")} • UID ${escapePublic(p.uid||"")}</small><div class="account-stat-grid"><div><b>${Number(st.points||0)}</b><small>Points</small></div><div><b>${Number(st.wins||0)}</b><small>Wins</small></div><div><b>${Number(st.tournaments_played||0)}</b><small>Tournaments</small></div></div></div><h3>Notifications ${unread.length?`(${unread.length})`:''}</h3>${(notes.notifications||[]).slice(0,5).map(n=>`<div class="account-notification ${n.is_read?'':'unread'}"><b>${escapePublic(n.title)}</b><span>${escapePublic(n.message)}</span></div>`).join('')||'<p>No notifications yet.</p>'}<h3>My Tournament Registrations</h3>${regs.map(r=>`<div class="account-notification"><b>${escapePublic(r.tournament_name)}</b><span>Registered ${new Date(r.created_at).toLocaleDateString()}</span></div>`).join('')||'<p>No tournament registrations yet.</p>'}`;}catch(e){o.querySelector('#playerDashboardData').insertAdjacentHTML('beforeend',`<p class="account-message">Could not load your live stats. ${escapePublic(e.message)}</p>`);}
}
function playerLogout(){localStorage.removeItem(PLAYER_TOKEN_KEY);localStorage.removeItem(PLAYER_PROFILE_KEY);document.querySelectorAll(".player-account-overlay").forEach(x=>x.remove());showToast("Logged out.")}
async function refreshPlayerCount(){const el=document.getElementById("livePlayerCount");if(!el)return;try{const d=await fetch("/api/stats").then(r=>r.ok?r.json():Promise.reject());el.textContent=Number(d.players||0).toLocaleString("en-NG");}catch(e){el.textContent="0";} }

function tournamentData(){const d=publicAdminData();d.tournamentRegistrations=Array.isArray(d.tournamentRegistrations)?d.tournamentRegistrations:[];return d}
function tournamentRegistrationCount(id,baseCount){const d=tournamentData();return Number(baseCount||0)+d.tournamentRegistrations.filter(r=>r.tournamentId===id).length}
async function openTournamentRegistration(tournamentId,tournamentName,maxSlots,baseCount){
  if(!playerLoggedIn()){showToast("Please create a free Player Account or login before registering.");openPlayerLogin();return;}
  let current=tournamentRegistrationCount(tournamentId,baseCount), max=Number(maxSlots||48);
  try{const c=await playerApi(`/api/tournaments/${encodeURIComponent(tournamentId)}/registrations/count`);current=Number(baseCount||0)+Number(c.count||0);}catch(e){}
  if(current>=max){showToast("Registration closed — all tournament slots are full. Keep an eye on the Nexus for the next tournament!");updateTournamentCards();return;}
  let p={};try{p=JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)||"{}")}catch(e){}
  const overlay=document.createElement("div");overlay.className="public-apply-overlay";
  overlay.innerHTML=`<div class="public-apply-modal tournament-register-modal"><button type="button" class="public-apply-close">×</button><span class="eyebrow">TOURNAMENT REGISTRATION</span><h2>${escapePublic(tournamentName)}</h2><p>You're registering as <b>${escapePublic(p.ign||"Player")}</b>. <b>${max-current} slot${max-current===1?'':'s'} remaining.</b></p><form id="tournamentRegisterForm"><label>In-game Name *<input name="ign" value="${escapePublic(p.ign||"")}" required></label><label>WhatsApp Number *<input name="whatsapp" value="${escapePublic(p.whatsapp||"")}" type="tel" required></label><label>Free Fire UID *<input name="uid" value="${escapePublic(p.uid||"")}" required></label><button class="btn primary full" type="submit">Confirm Registration</button></form><div id="tournamentRegisterResult"></div><p class="public-apply-note">Your player account is free. Tournament entry fees, if any, are handled separately by the tournament organizer.</p></div>`;
  document.body.appendChild(overlay);overlay.querySelector(".public-apply-close").onclick=()=>overlay.remove();
  overlay.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=e.target,result=overlay.querySelector("#tournamentRegisterResult");result.textContent="Reserving your slot...";try{
    const latest=await playerApi(`/api/tournaments/${encodeURIComponent(tournamentId)}/registrations/count`);const live=Number(baseCount||0)+Number(latest.count||0);if(live>=max){overlay.remove();showToast("Registration closed — all tournament slots are full. Keep an eye on the Nexus for the next tournament!");updateTournamentCards();return;}
    await playerApi(`/api/tournaments/${encodeURIComponent(tournamentId)}/register`,{method:"POST",body:JSON.stringify({tournamentName,maxSlots:max,ign:f.elements.ign.value.trim(),uid:f.elements.uid.value.trim(),whatsapp:f.elements.whatsapp.value.trim()})});
    const group=publicAdminData().siteSettings?.tournamentGroupLink||"";result.innerHTML=`<div class="tournament-success"><strong>Registration successful 🎉</strong><span>Your slot has been reserved. ${Math.max(0,max-live-1)} slot${max-live-1===1?'':'s'} remaining.</span>${group?`<a class="btn primary full" href="${escapePublic(group)}" target="_blank" rel="noopener">Join WhatsApp Group</a>`:`<small>The WhatsApp group link will be provided by the tournament organizer.</small>`}</div>`;f.style.display="none";updateTournamentCards();
  }catch(err){result.textContent=err.message;}};
}
function tournamentConfig(id, fallback={}){const d=publicAdminData();return {...fallback,...(d.tournamentSettings?.[id]||{})};}
function formatTournamentDate(v){if(!v)return "Date TBA";const d=new Date(v+"T00:00:00");return isNaN(d)?v:d.toLocaleDateString("en-NG",{month:"short",day:"numeric"});}
function money(v){const n=Number(String(v||0).replace(/[^0-9.]/g,""));return n?"₦"+n.toLocaleString("en-NG"):"₦0";}
function updateTournamentCards(){document.querySelectorAll("[data-tournament-id]").forEach(card=>{const id=card.dataset.tournamentId;const cfg=tournamentConfig(id,{maxSlots:Number(card.dataset.maxSlots||48),baseCount:Number(card.dataset.baseCount||0)});const max=Number(cfg.maxSlots||48),base=Number(cfg.baseCount||card.dataset.baseCount||0),count=tournamentRegistrationCount(id,base),slotEl=card.querySelector("[data-slot-count]"),btn=card.querySelector("[data-register-btn]"),feeEl=card.querySelector("[data-entry-fee]"),prizeEl=card.querySelector("[data-prize]"),dateEl=card.querySelector("[data-date]"),countdown=card.querySelector(".countdown");card.dataset.maxSlots=max;card.dataset.baseCount=base;if(slotEl)slotEl.textContent=`👥 ${count}/${max} slots`;if(feeEl)feeEl.textContent=`🎟️ Entry ${money(cfg.fee)}`;if(prizeEl)prizeEl.textContent=`🏆 ${money(cfg.prize)}`;if(dateEl)dateEl.textContent=`📅 ${formatTournamentDate(cfg.date)}`;if(countdown&&cfg.date)countdown.dataset.time=cfg.date+"T18:00:00";if(btn){if(count>=max){btn.textContent="Registration Full";btn.disabled=true;btn.classList.add("tournament-full-btn");}else{btn.textContent="Register";btn.disabled=false;btn.classList.remove("tournament-full-btn");}btn.onclick=()=>openTournamentRegistration(id,card.querySelector("h3")?.textContent||"Tournament",max,base);}});updateCountdowns();}
function addTournamentRegistrationAdminRow(r){const box=document.getElementById("tournamentRegistrationsList");if(!box)return;const row=document.createElement("div");row.className="tournament-registration-row";row.innerHTML=`<b>${escapeAdminText(r.tournamentName)}</b><span>${escapeAdminText(r.ign)} • UID: ${escapeAdminText(r.uid)} • WhatsApp: ${escapeAdminText(r.whatsapp)}</span><small>${escapeAdminText(r.status||"Registered")}</small>`;box.prepend(row)}

async function refreshPublicPlayers(){const grid=document.getElementById("playerGrid");if(!grid)return;try{const d=await fetch('/api/players/public').then(r=>r.json());const players=d.players||[];if(!players.length)return;grid.innerHTML=players.slice(0,30).map(p=>`<article class="player searchable player-card" data-style="${escapePublic(String(p.playstyle||'').toLowerCase())}" data-mode="${escapePublic(String(p.preferred_mode||'').toLowerCase())}"><div class="avatar">${escapePublic((p.ign||p.full_name||'P').slice(0,1).toUpperCase())}</div><div><h3>${escapePublic(p.ign||p.full_name||'Player')} ${p.verified?'<span class="badge verified">✓ VERIFIED</span>':''}</h3><p>UID: ${escapePublic(p.uid||'')}</p><span class="tag">${escapePublic(p.playstyle||'PLAYER')}</span><span class="tag">${escapePublic(p.preferred_mode||'FREE FIRE')}</span></div><button class="btn small" onclick="showToast('Player profile opened.')">View Profile</button></article>`).join('');}catch(e){}}

async function refreshPublicLeaderboard(){const box=document.getElementById("publicLeaderboard");if(!box)return;try{const d=await fetch('/api/players/public').then(r=>r.json());const players=d.players||[];box.innerHTML=players.length?players.slice(0,10).map((p,i)=>`<article class="player searchable player-card"><div class="avatar">${i+1}</div><div><h3>${escapePublic(p.ign||p.full_name||'Player')} ${p.verified?'<span class="badge verified">✓</span>':''}</h3><p>UID: ${escapePublic(p.uid||'')}</p><span class="tag">${Number(p.points||0)} POINTS</span><span class="tag">${Number(p.wins||0)} WINS</span></div><small>#${i+1}</small></article>`).join(''):'<p>No leaderboard data yet.</p>';}catch(e){box.innerHTML='<p>Leaderboard will appear when the database is connected.</p>';}}

function toggleMenu(){document.getElementById("mainNav")?.classList.toggle("open")}
function filterCreators(type,btn){document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".creator").forEach(c=>{c.style.display=type==="all"||c.classList.contains(type)?"":"none"})}
function filterAll(){const q=(document.getElementById("globalSearch")?.value||"").toLowerCase();document.querySelectorAll(".searchable").forEach(x=>x.style.display=x.textContent.toLowerCase().includes(q)?"":"none")}
function filterPlayers(){const style=document.getElementById("playstyleFilter").value,mode=document.getElementById("modeFilter").value,q=(document.getElementById("playerSearch").value||"").toLowerCase();document.querySelectorAll("#playerGrid .player").forEach(p=>{const ok=(style==="all"||p.dataset.style===style)&&(mode==="all"||p.dataset.mode===mode)&&p.textContent.toLowerCase().includes(q);p.style.display=ok?"":"none"})}
function submitContact(e){e.preventDefault();showToast("Request submitted — demo mode.");e.target.reset()}
function updateCountdowns(){document.querySelectorAll(".countdown").forEach(el=>{const target=new Date(el.dataset.time).getTime(),now=Date.now(),d=target-now;if(d<=0){el.textContent="LIVE / STARTED";return}const days=Math.floor(d/86400000),h=Math.floor(d%86400000/3600000),m=Math.floor(d%3600000/60000);el.textContent=`${days}d ${h}h ${m}m`})}
setInterval(updateCountdowns,30000);updateCountdowns();
document.addEventListener("DOMContentLoaded",()=>{loadServerConfig().then(()=>{updateTournamentCards();});});
document.addEventListener("DOMContentLoaded",refreshPlayerCount);
document.addEventListener("DOMContentLoaded",refreshPublicLeaderboard);
document.addEventListener("DOMContentLoaded",refreshPublicPlayers);

/* ===== ADMIN ONLY: single admin.html, one session, 5 min inactivity ===== */
const ADMIN_SESSION_KEY="ff_nexus_admin";
const ADMIN_ACTIVITY_KEY="ff_nexus_admin_activity";
const ADMIN_DATA_KEY="ff_nexus_hub_admin_data";
const ADMIN_TIMEOUT=5*60*1000;
let adminExpiryTimer=null;

function adminIsLoggedIn(){
  const logged=!!sessionStorage.getItem(ADMIN_SESSION_KEY);
  const last=Number(sessionStorage.getItem(ADMIN_ACTIVITY_KEY)||0);
  return logged && last && Date.now()-last<ADMIN_TIMEOUT;
}
function adminTouch(){
  if(!sessionStorage.getItem(ADMIN_SESSION_KEY)) return;
  sessionStorage.setItem(ADMIN_ACTIVITY_KEY,String(Date.now()));
  clearTimeout(adminExpiryTimer);
  adminExpiryTimer=setTimeout(()=>{if(!adminIsLoggedIn()) adminLogout(true)},ADMIN_TIMEOUT+250);
}
async function adminLogin(){
  const input=document.getElementById("adminPassword"),error=document.getElementById("loginError");
  if(!input)return;
  input.disabled=true;
  if(error)error.textContent="Signing in…";
  try{
    const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:input.value})});
    const x=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(x.error||"Admin login failed.");
    sessionStorage.setItem(ADMIN_SESSION_KEY,x.token);
    sessionStorage.setItem(ADMIN_ACTIVITY_KEY,String(Date.now()));
    input.value="";
    if(error)error.textContent="";
    checkAdminSession();
    showAdminPage(location.hash.slice(1)||"overview");
  }catch(e){
    if(error)error.textContent=e.message||"Admin login failed.";
  }finally{input.disabled=false;}
}
function adminAuthHeaders(){
  const token=sessionStorage.getItem(ADMIN_SESSION_KEY)||"";
  return token?{Authorization:"Bearer "+token}:{};
}
async function adminApi(path,options={}){
  const headers={...(options.headers||{}),...adminAuthHeaders()};
  const r=await fetch(path,{...options,headers});
  const x=await r.json().catch(()=>({}));
  if(r.status===401){adminLogout(true);throw new Error(x.error||"Admin session expired.");}
  if(!r.ok)throw new Error(x.error||"Admin request failed.");
  return x;
}
function adminLogout(expired=false){
  sessionStorage.removeItem(ADMIN_SESSION_KEY);sessionStorage.removeItem(ADMIN_ACTIVITY_KEY);clearTimeout(adminExpiryTimer);
  document.getElementById("loginScreen")?.classList.remove("hidden");document.getElementById("adminApp")?.classList.add("hidden");
  if(expired){const e=document.getElementById("loginError");if(e)e.textContent="Session expired after 5 minutes of inactivity. Please log in again."}
}
function checkAdminSession(){if(!adminIsLoggedIn()){adminLogout(false);return}document.getElementById("loginScreen")?.classList.add("hidden");document.getElementById("adminApp")?.classList.remove("hidden");adminTouch()}

async function refreshAdminPlayers(){
  const box=document.getElementById("registeredPlayersList"),countEl=document.getElementById("adminLivePlayerCount");
  if(!box)return;
  try{
    const d=await adminApi("/api/admin/players");
    const players=Array.isArray(d.players)?d.players:[]; if(countEl)countEl.textContent=players.length.toLocaleString("en-NG");
    if(!players.length){box.innerHTML='<p class="admin-form-help">No registered player accounts yet.</p>';return;}
    box.innerHTML=`<div class="table-wrap"><table><tr><th>Player</th><th>IGN</th><th>UID</th><th>WhatsApp</th><th>Registered</th></tr>${players.map(p=>`<tr><td>${escapeAdminText(p.full_name||"")}<br><small>${escapeAdminText(p.email||"")}</small></td><td>${escapeAdminText(p.ign||"")}</td><td>${escapeAdminText(p.uid||"")}</td><td>${escapeAdminText(p.whatsapp||"")}</td><td>${new Date(p.created_at).toLocaleDateString()}</td></tr>`).join("")}</table></div>`;
  }catch(e){box.innerHTML=`<p class="admin-form-help">${escapeAdminText(e.message)}<br>Make sure the Neon DATABASE_URL is configured on the server.</p>`;}
}


function renderAdminManagedListings(){
  if(!document.getElementById('adminApp')) return;
  const d=loadAdminData();
  const creators=Array.isArray(d.creators)?d.creators:[];
  const vendors=Array.isArray(d.vendors)?d.vendors:[];
  const tournaments=Array.isArray(d.tournaments)?d.tournaments:[];
  const setCount=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=String(n);};
  setCount('adminCreatorCount',creators.length);
  setCount('adminVendorCount',vendors.length);
  setCount('adminTournamentCount',tournaments.length);
  const action=(type,id)=>`<div class="admin-row-actions"><button type="button" class="mini" onclick="adminEdit('${type}','${escapeAdminText(id)}')">Edit</button><button type="button" class="mini danger" onclick="adminRemove('${type}','${escapeAdminText(id)}')">Remove</button></div>`;
  const ct=document.getElementById('adminCreatorsTable');
  if(ct) ct.innerHTML=creators.length?creators.map(x=>`<tr><td>${x.image?`<img src="${x.image}" class="admin-table-image" alt="">`:''}${escapeAdminText(x.name||'Creator')}</td><td>${escapeAdminText(x.uid||'')}</td><td>${escapeAdminText(x.plan||'')}</td><td>${escapeAdminText(x.status||'Pending')}</td><td>${action('creators',x.id)}</td></tr>`).join(''):`<tr><td colspan="5" class="admin-form-help">No creators added yet.</td></tr>`;
  const vt=document.getElementById('adminVendorsTable');
  if(vt) vt.innerHTML=vendors.length?vendors.map(x=>`<tr><td>${x.image?`<img src="${x.image}" class="admin-table-image" alt="">`:''}${escapeAdminText(x.name||'Vendor')}</td><td>${escapeAdminText(x.category||x.plan||'')}</td><td>${escapeAdminText(x.status||'Pending')}</td><td>${action('vendors',x.id)}</td></tr>`).join(''):`<tr><td colspan="4" class="admin-form-help">No vendors added yet.</td></tr>`;
  const tt=document.getElementById('adminTournamentsTable');
  if(tt) tt.innerHTML=tournaments.length?tournaments.map(x=>`<tr><td>${escapeAdminText(x.name||'Tournament')}</td><td>${escapeAdminText(x.organizer||'')}</td><td>${money(x.fee||0)}</td><td>${escapeAdminText(x.status||'Active')}</td><td>${action('tournaments',x.id)}</td></tr>`).join(''):`<tr><td colspan="5" class="admin-form-help">No tournaments added yet.</td></tr>`;
}

function showAdminPage(page){
  if(!adminIsLoggedIn())return;
  const allowed=["overview","creators","vendors","players","tournaments","news","payments","reports","settings","admin-settings","monthly-rankings","applications","leaderboard-admin","tournament-registrations"];
  if(!allowed.includes(page))page="overview";
  document.querySelectorAll(".admin-section").forEach(s=>s.classList.toggle("admin-current",s.id===page));
  document.querySelectorAll("[data-admin-page]").forEach(a=>a.classList.toggle("active",a.dataset.adminPage===page));
  adminTouch();
  renderAdminManagedListings();
  renderAdminNews();
  if(page==="admin-settings") loadAdminWebsiteSettings();
  if(page==="overview"||page==="players") refreshAdminPlayers();
  if(page==="monthly-rankings") loadMonthlyRankings();
  if(page==="news") renderAdminNews();
  if(page==="leaderboard-admin") refreshAdminLeaderboard();
}

/* Add Creator / Vendor / other admin records with a proper form. */
function escapeAdminText(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
function adminAdd(type){
  if(!adminIsLoggedIn())return;
  const configs={
    creators:{title:"Add Creator",fields:[
      ["name","Creator name","text",true],
      ["uid","Free Fire UID","text",true],
      ["username","Username / In-game name","text",false],
      ["platform","Main platform","text",false],
      ["category","Content type","text",false],
      ["bio","Creator bio / useful information","textarea",false],
      ["social","Social media link","url",false],
      ["plan","Plan","select",false,["Free","Popular","Featured","PRO"]],
      ["status","Status","select",false,["Active","Pending","Suspended"]]
    ]},
    vendors:{title:"Add Vendor",fields:[
      ["name","Business / Vendor name","text",true],
      ["owner","Contact person","text",false],
      ["phone","Phone number","tel",false],
      ["whatsapp","WhatsApp number","tel",false],
      ["category","Business category","text",false],
      ["location","Business location","text",false],
      ["description","Business description / useful information","textarea",false],
      ["contact","Contact / website link","url",false],
      ["plan","Listing plan","select",false,["Free","Verified","PRO","Featured"]],
      ["status","Verification status","select",false,["Pending","Approved","Suspended"]]
    ]},
    players:{title:"Add Player",fields:[
      ["name","Player name","text",true],["uid","Free Fire UID","text",true],
      ["style","Play style","text",false],["mode","Preferred mode","text",false],
      ["bio","Player information","textarea",false]
    ]},
    tournaments:{title:"Add Tournament",fields:[
      ["name","Tournament name","text",true],["organizer","Organizer","text",true],
      ["fee","Entry fee","number",false],["prize","Prize money","number",false],["date","Tournament date","date",false],
      ["maxSlots","Maximum slots","number",true],
      ["whatsappGroupLink","WhatsApp group link","url",false],
      ["details","Tournament information","textarea",false]
    ]}
  };
  const cfg=configs[type]||configs.creators;
  const overlay=document.createElement("div"); overlay.className="admin-form-overlay";
  const fields=cfg.fields.map(f=>{
    const [key,label,input,required,options]=f;
    let control=input==="textarea"?`<textarea id="add_${key}" placeholder="${label}"></textarea>`:
      input==="select"?`<select id="add_${key}">${options.map(o=>`<option>${escapeAdminText(o)}</option>`).join("")}</select>`:
      `<input id="add_${key}" type="${input}" placeholder="${label}" ${required?"required":""}>`;
    return `<label>${label}${required?' *':''}${control}</label>`;
  }).join("");
  const imageField=(type==="creators"||type==="vendors")?`<label>Profile picture / business logo<input id="add_image" type="file" accept="image/*"></label><div id="add_image_preview" class="admin-upload-preview">Choose an image from your device</div>`:
    `<label>Image (optional)<input id="add_image" type="file" accept="image/*"></label><div id="add_image_preview" class="admin-upload-preview">Choose an image from your device</div>`;
  overlay.innerHTML=`<div class="admin-form-card"><button class="admin-form-close" type="button">×</button><h2>${cfg.title}</h2><p class="admin-form-help">Fill in the useful information below, then choose the profile picture from your device.</p><form id="adminAddForm">${fields}${imageField}<button class="btn primary full" type="submit">Add ${type==="vendors"?"Vendor":type==="creators"?"Creator":type.slice(0,-1).replace(/^./,c=>c.toUpperCase())}</button></form></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".admin-form-close").onclick=()=>overlay.remove();
  const imageInput=overlay.querySelector("#add_image"), preview=overlay.querySelector("#add_image_preview");
  imageInput.addEventListener("change",()=>{
    const file=imageInput.files?.[0]; if(!file)return;
    if(!file.type.startsWith("image/")){alert("Please choose an image file.");imageInput.value="";return;}
    if(file.size>3*1024*1024){alert("Please choose an image under 3 MB.");imageInput.value="";return;}
    const r=new FileReader(); r.onload=e=>{preview.innerHTML=`<img src="${e.target.result}" alt="Image preview">`;preview.dataset.image=e.target.result;}; r.readAsDataURL(file);
  });
  overlay.querySelector("#adminAddForm").addEventListener("submit",e=>{
    e.preventDefault();
    const item={id:type+"_"+Date.now()};
    cfg.fields.forEach(f=>{const el=overlay.querySelector("#add_"+f[0]);item[f[0]]=el?.value.trim()||"";});
    if(type==="tournaments"){item.maxSlots=Number(item.maxSlots||48);item.fee=item.fee||"0";item.prize=item.prize||"0";}
    item.image=preview.dataset.image||"";
    const d=loadAdminData();d[type]=d[type]||[];d[type].push(item);saveAdminData(d);
    addAdminTableRow(type,item);
    renderAdminManagedListings();
    renderTournamentControls();
    overlay.remove();showToast(cfg.title.replace("Add ","")+" added successfully.");adminTouch();
  });
}
function adminEdit(type,id){
  if(!adminIsLoggedIn())return;
  const d=loadAdminData(); const item=(d[type]||[]).find(x=>String(x.id)===String(id)); if(!item)return showToast('Listing not found.');
  const configs={
    creators:{title:'Edit Creator',fields:[['name','Creator name','text',true],['uid','Free Fire UID','text',true],['username','Username / In-game name','text',false],['platform','Main platform','text',false],['category','Content type','text',false],['bio','Creator bio / useful information','textarea',false],['social','Social media link','url',false],['plan','Plan','select',false,['Free','Popular','Featured','PRO']],['status','Status','select',false,['Active','Pending','Suspended']]]},
    vendors:{title:'Edit Vendor',fields:[['name','Business / Vendor name','text',true],['owner','Contact person','text',false],['phone','Phone number','tel',false],['whatsapp','WhatsApp number','tel',false],['category','Business category','text',false],['location','Business location','text',false],['description','Business description / useful information','textarea',false],['contact','Contact / website link','url',false],['plan','Listing plan','select',false,['Free','Verified','PRO','Featured']],['status','Verification status','select',false,['Pending','Approved','Suspended']]]},
    tournaments:{title:'Edit Tournament',fields:[['name','Tournament name','text',true],['organizer','Organizer','text',true],['fee','Entry fee','number',false],['prize','Prize money','number',false],['date','Tournament date','date',false],['maxSlots','Maximum slots','number',true],['whatsappGroupLink','WhatsApp group link','url',false],['details','Tournament information','textarea',false],['status','Status','select',false,['Active','Upcoming','Completed','Closed']]]}
  };
  const cfg=configs[type]; if(!cfg)return showToast('This listing cannot be edited here.');
  const overlay=document.createElement('div'); overlay.className='admin-form-overlay';
  const fields=cfg.fields.map(f=>{const [key,label,input,required,options]=f; const val=item[key]??''; let control=input==='textarea'?`<textarea id="edit_${key}" placeholder="${label}">${escapeAdminText(val)}</textarea>`:input==='select'?`<select id="edit_${key}">${options.map(o=>`<option ${String(val)===o?'selected':''}>${escapeAdminText(o)}</option>`).join('')}</select>`:`<input id="edit_${key}" type="${input}" value="${escapeAdminText(val)}" placeholder="${label}" ${required?'required':''}>`; return `<label>${label}${required?' *':''}${control}</label>`;}).join('');
  overlay.innerHTML=`<div class="admin-form-card"><button class="admin-form-close" type="button">×</button><h2>${cfg.title}</h2><p class="admin-form-help">Update the details below. Changes will appear on the main website after saving.</p><form id="adminEditForm">${fields}<label>Replace image (optional)<input id="edit_image" type="file" accept="image/*"></label><div id="edit_image_preview" class="admin-upload-preview">${item.image?`<img src="${item.image}" alt="Current image">`:'No image selected'}</div><button class="btn primary full" type="submit">Save Changes</button></form></div>`;
  document.body.appendChild(overlay); overlay.querySelector('.admin-form-close').onclick=()=>overlay.remove();
  const imageInput=overlay.querySelector('#edit_image'), preview=overlay.querySelector('#edit_image_preview');
  imageInput.addEventListener('change',()=>{const file=imageInput.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){alert('Please choose an image file.');imageInput.value='';return;}if(file.size>3*1024*1024){alert('Please choose an image under 3 MB.');imageInput.value='';return;}const r=new FileReader();r.onload=e=>{preview.innerHTML=`<img src="${e.target.result}" alt="Image preview">`;preview.dataset.image=e.target.result;};r.readAsDataURL(file);});
  overlay.querySelector('#adminEditForm').onsubmit=e=>{e.preventDefault();cfg.fields.forEach(f=>{const el=overlay.querySelector('#edit_'+f[0]);item[f[0]]=el?.value.trim()||'';});if(type==='tournaments'){item.fee=item.fee||'0';item.prize=item.prize||'0';item.maxSlots=Number(item.maxSlots||48);}if(preview.dataset.image)item.image=preview.dataset.image;d[type]=d[type]||[];const i=d[type].findIndex(x=>String(x.id)===String(id));if(i>=0)d[type][i]=item;saveAdminData(d);overlay.remove();renderAdminManagedListings();renderTournamentControls();updateTournamentCards();renderAdminContentOnPublicSite();showToast((type==='creators'?'Creator':type==='vendors'?'Vendor':'Tournament')+' updated successfully.');adminTouch();};
}
function adminRemove(type,id){
  if(!adminIsLoggedIn())return;
  const d=loadAdminData(); const arr=Array.isArray(d[type])?d[type]:[]; const item=arr.find(x=>String(x.id)===String(id)); if(!item)return;
  const label=type==='creators'?'creator':type==='vendors'?'vendor':'tournament';
  if(!confirm(`Remove ${item.name||label} from the website? This cannot be undone.`))return;
  d[type]=arr.filter(x=>String(x.id)!==String(id));
  if(type==='tournaments'&&d.tournamentSettings)delete d.tournamentSettings[id];
  saveAdminData(d); renderAdminManagedListings(); renderTournamentControls(); updateTournamentCards(); renderAdminContentOnPublicSite(); showToast(`${label.charAt(0).toUpperCase()+label.slice(1)} removed successfully.`); adminTouch();
}

function addAdminTableRow(type,item){
  const section=document.getElementById(type);const table=section?.querySelector("table");if(!table)return;
  const row=table.insertRow(-1); const img=item.image?`<img src="${item.image}" class="admin-table-image" alt="">`:"";
  if(type==="creators") row.innerHTML=`<td>${img}${escapeAdminText(item.name)}</td><td>${escapeAdminText(item.uid)}</td><td>${escapeAdminText(item.plan)}</td><td>${escapeAdminText(item.category||"")}</td><td>${escapeAdminText(item.status||"Pending")}</td><td><button class="mini" onclick="showToast('Creator saved.')">Edit</button></td>`;
  else if(type==="vendors") row.innerHTML=`<td>${img}${escapeAdminText(item.name)}</td><td>${escapeAdminText(item.category||item.plan||"")}</td><td>${escapeAdminText(item.status||"Pending")}</td><td>Manual</td><td><button class="mini" onclick="showToast('Vendor saved.')">Edit</button></td>`;
  else if(type==="tournaments") row.innerHTML=`<td>${escapeAdminText(item.name)}</td><td>${escapeAdminText(item.organizer)}</td><td>${escapeAdminText(item.fee)}</td><td>Pending</td><td><button class="mini" onclick="showToast('Tournament saved.')">Edit</button></td>`;
  else row.innerHTML=`<td>${escapeAdminText(item.name)}</td><td>${escapeAdminText(item.uid||"")}</td><td>${escapeAdminText(item.style||"")}</td><td>No</td><td><button class="mini">Saved</button></td>`;
}

function tournamentDefaults(){return {}}
function getTournamentForEdit(id){const d=loadAdminData(), defaults=tournamentDefaults()[id]||{}, item=(d.tournaments||[]).find(x=>x.id===id)||{};return {...defaults,...item,...(d.tournamentSettings?.[id]||{})};}
window.editTournament=function(id){const t=getTournamentForEdit(id),overlay=document.createElement("div");overlay.className="admin-form-overlay";overlay.innerHTML=`<div class="admin-form-card"><button class="admin-form-close" type="button">×</button><h2>Edit Tournament</h2><p class="admin-form-help">Changes here update the tournament card on the main website.</p><form id="editTournamentForm"><label>Tournament name<input id="edit_t_name" value="${escapeAdminText(t.name||"")}" required></label><label>Entry fee (₦)<input id="edit_t_fee" type="number" min="0" value="${escapeAdminText(t.fee||0)}" required></label><label>Prize money (₦)<input id="edit_t_prize" type="number" min="0" value="${escapeAdminText(t.prize||0)}"></label><label>Date<input id="edit_t_date" type="date" value="${escapeAdminText(t.date||"")}" required></label><label>Maximum slots<input id="edit_t_slots" type="number" min="1" value="${Number(t.maxSlots||48)}" required></label><label>WhatsApp group link<input id="edit_t_group" type="url" value="${escapeAdminText(t.whatsappGroupLink||"")}" placeholder="https://chat.whatsapp.com/..."></label><button class="btn primary full" type="submit">Save Tournament Changes</button></form></div>`;document.body.appendChild(overlay);overlay.querySelector(".admin-form-close").onclick=()=>overlay.remove();overlay.querySelector("form").onsubmit=e=>{e.preventDefault();const d=loadAdminData();d.tournamentSettings=d.tournamentSettings||{};d.tournamentSettings[id]={name:overlay.querySelector("#edit_t_name").value.trim(),fee:overlay.querySelector("#edit_t_fee").value,prize:overlay.querySelector("#edit_t_prize").value,date:overlay.querySelector("#edit_t_date").value,maxSlots:Number(overlay.querySelector("#edit_t_slots").value||48),whatsappGroupLink:overlay.querySelector("#edit_t_group").value.trim(),baseCount:Number(t.baseCount||0)};if(Array.isArray(d.tournaments)){const item=d.tournaments.find(x=>x.id===id);if(item)Object.assign(item,d.tournamentSettings[id]);}saveAdminData(d);overlay.remove();renderTournamentControls();updateTournamentCards();renderTournamentAdminFees();showToast("Tournament changes saved.");adminTouch();};}
function renderTournamentAdminFees(){document.querySelectorAll("[data-admin-tournament-fee]").forEach(el=>{const id=el.dataset.adminTournamentFee,t=getTournamentForEdit(id);el.textContent=money(t.fee);});}
function renderTournamentControls(){const box=document.getElementById("tournamentControlsList");if(!box)return;const d=loadAdminData(),items=[...Object.entries(tournamentDefaults()).map(([id,v])=>({id,...v})),...(d.tournaments||[])];const seen=new Set();box.innerHTML=items.filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true}).map(t=>{const x=getTournamentForEdit(t.id);return `<div class="tournament-control-row"><div><b>${escapeAdminText(x.name||"Tournament")}</b><small>Entry ${money(x.fee)} • ${formatTournamentDate(x.date)} • ${Number(x.maxSlots||48)} slots</small></div><button type="button" class="mini" onclick="editTournament('${escapeAdminText(t.id)}')">Edit</button></div>`}).join("");}
function loadAdminData(){try{return JSON.parse(localStorage.getItem(ADMIN_DATA_KEY)||'{"creators":[],"vendors":[],"players":[],"tournaments":[],"news":[],"payments":[],"reports":[],"siteSettings":{}}')}catch(e){return {creators:[],vendors:[],players:[],tournaments:[],news:[],payments:[],reports:[],siteSettings:{}}}}
function saveAdminData(d){localStorage.setItem(ADMIN_DATA_KEY,JSON.stringify(d))}
function activateListing(btn){if(btn){btn.textContent="Active";btn.disabled=true;showToast("Listing activated.");}adminTouch()}
function pinPlayer(btn){if(btn){btn.textContent="Pinned";btn.disabled=true;showToast("Player pinned for 24H.");}adminTouch()}
function renderAdminNews(){const box=document.getElementById("adminNewsList");if(!box)return;const news=loadAdminData().news||[];box.innerHTML=news.length?news.map(n=>`<div class="admin-managed-item"><div><b>${escapeAdminText(n.name||"Untitled")}</b><p>${escapeAdminText(n.details||"")}</p></div><div class="admin-row-actions"><button type="button" class="mini" onclick="adminEditNews('${escapeAdminText(n.id)}')">Edit</button><button type="button" class="mini danger" onclick="adminRemoveNews('${escapeAdminText(n.id)}')">Remove</button></div></div>`).join(""):"<p class=\"admin-form-help\">No news published yet.</p>";}
function publishNews(){const t=document.getElementById("newsTitle"),b=document.getElementById("newsBody");if(!t||!t.value.trim())return showToast("Enter an article title.");const d=loadAdminData();d.news=d.news||[];d.news.push({id:"news_"+Date.now(),name:t.value.trim(),details:b?b.value.trim():"",image:""});saveAdminData(d);if(b)b.value="";t.value="";renderAdminNews();renderAdminContentOnPublicSite();showToast("News published successfully.");adminTouch()}
function adminEditNews(id){if(!adminIsLoggedIn())return;const d=loadAdminData(),item=(d.news||[]).find(x=>String(x.id)===String(id));if(!item)return showToast("News article not found.");const title=prompt("Edit article title:",item.name||"");if(title===null)return;const body=prompt("Edit article text:",item.details||"");if(body===null)return;item.name=title.trim();item.details=body.trim();saveAdminData(d);renderAdminNews();renderAdminContentOnPublicSite();showToast("News updated successfully.");adminTouch()}
function adminRemoveNews(id){if(!adminIsLoggedIn())return;const d=loadAdminData(),item=(d.news||[]).find(x=>String(x.id)===String(id));if(!item)return;if(!confirm(`Remove \"${item.name||"this article"}\" from the website?`))return;d.news=(d.news||[]).filter(x=>String(x.id)!==String(id));saveAdminData(d);renderAdminNews();renderAdminContentOnPublicSite();showToast("News removed successfully.");adminTouch()}

function defaultPaymentMethods(){
  return [{id:"pay_1",provider:"OPay",account:"8115334953",name:"Olajide David Pelumi",default:true}];
}
function loadPaymentMethods(){
  const d=loadAdminData();
  if(!Array.isArray(d.paymentMethods)||!d.paymentMethods.length){
    d.paymentMethods=defaultPaymentMethods();
    saveAdminData(d);
  }
  return d.paymentMethods;
}
function renderPaymentMethods(){
  const box=document.getElementById("paymentMethodsList");if(!box)return;
  const methods=loadPaymentMethods();
  box.innerHTML=methods.map((m,i)=>`<div class="payment-method-row" data-payment-id="${escapeAdminText(m.id)}">
    <input class="pm-provider" value="${escapeAdminText(m.provider)}" placeholder="Provider">
    <input class="pm-account" value="${escapeAdminText(m.account)}" placeholder="Account number">
    <input class="pm-name" value="${escapeAdminText(m.name)}" placeholder="Account name">
    <span class="default-badge">${m.default?'Default':''}</span>
    <button class="mini" type="button" onclick="setDefaultPaymentMethod('${escapeAdminText(m.id)}')">${m.default?'Default':'Make default'}</button>
    <button class="mini" type="button" onclick="removePaymentMethod('${escapeAdminText(m.id)}')">Remove</button>
  </div>`).join('');
}
function addPaymentMethod(){
  if(!adminIsLoggedIn())return;
  const provider=document.getElementById("newPaymentProvider")?.value.trim()||"";
  const account=document.getElementById("newPaymentAccount")?.value.trim()||"";
  const name=document.getElementById("newPaymentName")?.value.trim()||"";
  if(!provider||!account||!name){showToast("Enter provider, account number and account name.");return}
  const d=loadAdminData();d.paymentMethods=Array.isArray(d.paymentMethods)?d.paymentMethods:[];
  d.paymentMethods.push({id:"pay_"+Date.now(),provider,account,name,default:d.paymentMethods.length===0});
  saveAdminData(d);
  ["newPaymentProvider","newPaymentAccount","newPaymentName"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
  renderPaymentMethods();renderPaymentMethodsOnPaymentsPage();showToast("Payment method added.");adminTouch();
}
function setDefaultPaymentMethod(id){
  const d=loadAdminData();d.paymentMethods=(d.paymentMethods||[]).map(m=>({...m,default:m.id===id}));saveAdminData(d);renderPaymentMethods();renderPaymentMethodsOnPaymentsPage();showToast("Default payment method updated.");adminTouch();
}
function removePaymentMethod(id){
  const d=loadAdminData();let methods=d.paymentMethods||[];
  if(methods.length<=1){showToast("Keep at least one payment method.");return}
  const removed=methods.find(m=>m.id===id);methods=methods.filter(m=>m.id!==id);
  if(removed?.default && methods.length)methods[0].default=true;
  d.paymentMethods=methods;saveAdminData(d);renderPaymentMethods();renderPaymentMethodsOnPaymentsPage();showToast("Payment method removed.");adminTouch();
}
function savePaymentMethodEdits(){
  const d=loadAdminData();let methods=d.paymentMethods||[];
  document.querySelectorAll(".payment-method-row").forEach(row=>{
    const id=row.dataset.paymentId,m=methods.find(x=>x.id===id);if(!m)return;
    m.provider=row.querySelector(".pm-provider")?.value.trim()||m.provider;
    m.account=row.querySelector(".pm-account")?.value.trim()||m.account;
    m.name=row.querySelector(".pm-name")?.value.trim()||m.name;
  });
  d.paymentMethods=methods;saveAdminData(d);renderPaymentMethods();renderPaymentMethodsOnPaymentsPage();showToast("Payment methods saved.");adminTouch();
}
function renderPaymentMethodsOnPaymentsPage(){
  const box=document.getElementById("adminPaymentMethodsList");if(!box)return;
  const methods=loadPaymentMethods();
  box.innerHTML=methods.map(m=>`<div class="payment-method-history"><b>${escapeAdminText(m.provider)}</b><span>${escapeAdminText(m.account)}</span><span>${escapeAdminText(m.name)}</span>${m.default?'<span class="status ok">Default</span>':''}</div>`).join('');
}
function loadAdminWebsiteSettings(){
  const s=(loadAdminData().siteSettings)||{};
  const map={siteName:"websiteName",sitePhone:"phone",siteEmail:"email",siteWhatsApp:"whatsapp",siteAddress:"address",siteTagline:"tagline",siteDescription:"description",tournamentGroupLink:"tournamentGroupLink"};
  Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.value=s[map[id]]||""});
  const fee=document.getElementById("listingFee");if(fee)fee.value=s.listingFee||10000;
  const p=document.getElementById("siteLogoPreview");if(p&&s.logo)p.innerHTML='<img src="'+s.logo+'" style="max-width:180px;max-height:100px;object-fit:contain">';
  renderPaymentMethods();
  renderTournamentControls();
}
function saveAdminWebsiteSettings(){
  const d=loadAdminData(),s=d.siteSettings||{};
  const get=id=>document.getElementById(id)?.value.trim()||"";
  s.websiteName=get("siteName");s.phone=get("sitePhone");s.email=get("siteEmail");s.whatsapp=get("siteWhatsApp");s.address=get("siteAddress");s.tagline=get("siteTagline");s.description=get("siteDescription");s.tournamentGroupLink=get("tournamentGroupLink");
  const feeRaw=get("listingFee").replace(/[^0-9.]/g,""); const feeNum=Number(feeRaw); s.listingFee=Number.isFinite(feeNum)&&feeNum>0?feeNum:10000;
  const file=document.getElementById("siteLogo")?.files?.[0];
  const finish=logo=>{if(logo)s.logo=logo;d.siteSettings=s;d.paymentMethods=Array.isArray(d.paymentMethods)&&d.paymentMethods.length?d.paymentMethods:defaultPaymentMethods();saveAdminData(d);savePaymentMethodEdits();const m=document.getElementById("adminSettingsMessage");if(m)m.textContent="Admin Settings saved successfully.";showToast("Admin Settings saved.");adminTouch()};
  if(file){if(!file.type.startsWith("image/"))return alert("Please choose an image file.");if(file.size>3*1024*1024)return alert("Please choose a logo under 3 MB.");const r=new FileReader();r.onload=e=>finish(e.target.result);r.readAsDataURL(file)}else finish(s.logo||"");
}
document.addEventListener("DOMContentLoaded",()=>{
  const password=document.getElementById("adminPassword");
  if(password)password.addEventListener("keydown",e=>{if(e.key==="Enter")adminLogin()});
  document.querySelectorAll("[data-admin-page]").forEach(link=>link.addEventListener("click",()=>adminTouch()));
  document.querySelectorAll(".admin-section:not(#overview)").forEach(section=>{if(!section.querySelector(".back-dashboard")){const back=document.createElement("a");back.className="back-dashboard";back.href="#overview";back.textContent="← Back to Dashboard";section.insertBefore(back,section.firstChild)}});
  const td=loadAdminData().siteSettings||{};if(document.getElementById("tournamentGroupLink"))document.getElementById("tournamentGroupLink").value=td.tournamentGroupLink||"";
  if(document.getElementById("adminApp")){if(adminIsLoggedIn()){checkAdminSession();showAdminPage(location.hash.slice(1)||"overview")}else checkAdminSession()}
});
window.addEventListener("hashchange",()=>{if(document.getElementById("adminApp")&&adminIsLoggedIn())showAdminPage(location.hash.slice(1)||"overview")});
["click","keydown","touchstart","mousemove","scroll"].forEach(e=>document.addEventListener(e,adminTouch,{passive:true}));

/* ===== PUBLIC SITE <-> ADMIN SETTINGS CONNECTION =====
   This section only reads the settings already saved by admin.html.
   It does not redesign or rearrange the public website. */
function applyAdminSettingsToWebsite(){
  if(document.getElementById("adminApp")) return; // admin page: don't alter dashboard
  let d;
  try{ d=JSON.parse(localStorage.getItem("ff_nexus_hub_admin_data")||"{}"); }catch(e){ return; }
  const s=d.siteSettings||{};

  if(s.websiteName){
    document.title=s.websiteName+" | Free Fire Community";
    document.querySelectorAll(".topbar .brand, footer b").forEach(el=>{
      // Keep the existing FF badge/style; only replace the text after it.
      if(el.classList.contains("brand") && el.querySelector("span")){
        const badge=el.querySelector("span");
        el.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=" "+s.websiteName;});
        if(!el.textContent.includes(s.websiteName)) el.appendChild(document.createTextNode(" "+s.websiteName));
      }else el.textContent=s.websiteName;
    });
  }

  if(s.tagline){
    const eyebrow=document.querySelector("#home .hero-copy .eyebrow");
    if(eyebrow) eyebrow.textContent=s.tagline;
  }
  if(s.description){
    const heroText=document.querySelector("#home .hero-copy > p");
    if(heroText) heroText.textContent=s.description;
  }

  // Put the configured contact information into the existing contact section,
  // without creating or moving any layout elements.
  const contactText=document.querySelector("#contact > div > p");
  if(contactText && (s.phone||s.email||s.whatsapp||s.address)){
    const parts=[];
    if(s.phone) parts.push("Phone: "+s.phone);
    if(s.whatsapp) parts.push("WhatsApp: "+s.whatsapp);
    if(s.email) parts.push("Email: "+s.email);
    if(s.address) parts.push("Address: "+s.address);
    contactText.textContent=parts.join(" • ");
  }

  // The original site has no logo <img>, so use the uploaded logo as the
  // existing brand background image rather than changing the page structure.
  if(s.logo){
    document.querySelectorAll(".topbar .brand span").forEach(el=>{
      el.style.backgroundImage="url(\'"+s.logo.replace(/\'/g,"%27")+"\')";
      el.style.backgroundSize="cover";
      el.style.backgroundPosition="center";
      el.style.color="transparent";
    });
  }

  // Public stats count only real records added/registered in the system.
  // The original demo numbers are intentionally not counted.
  const countMap={
    creators:"#liveCreatorCount",
    vendors:"#liveVendorCount",
    tournaments:"#liveTournamentCount"
  };
  Object.keys(countMap).forEach(k=>{
    const arr=Array.isArray(d[k])?d[k]:[];
    const el=document.querySelector(countMap[k]);
    if(el) el.textContent=String(arr.length);
  });

  // Keep players at zero until the real database reports registered accounts.
  const playerEl=document.querySelector("#livePlayerCount");
  if(playerEl && !playerEl.textContent.trim()) playerEl.textContent="0";
}

document.addEventListener("DOMContentLoaded",applyAdminSettingsToWebsite);


function openPublicProfile(item){
  const x=item||{};
  const root=document.getElementById('publicProfileRoot');
  if(!root)return;
  const label=x.type==='vendor'?'Vendor':x.type==='player'?'Player':'Creator';
  const name=escapeAdminPublicText(x.name||x.ign||label);
  const letter=escapeAdminPublicText((x.name||x.ign||label).trim().charAt(0).toUpperCase());
  const image=x.image||'';
  const avatar=image?`<img class="public-profile-avatar" src="${escapeAdminPublicText(image)}" alt="Profile picture">`:`<div class="public-profile-avatar">${letter}</div>`;
  const fields=[];
  if(x.uid)fields.push(['Free Fire UID',x.uid]);
  if(x.ign)fields.push(['In-game Name',x.ign]);
  if(x.platform)fields.push(['Platform',x.platform]);
  if(x.category)fields.push(['Category',x.category]);
  if(x.phone)fields.push(['Phone',x.phone]);
  if(x.whatsapp)fields.push(['WhatsApp',x.whatsapp]);
  if(x.location)fields.push(['Location',x.location]);
  if(x.style)fields.push(['Playstyle',x.style]);
  if(x.mode)fields.push(['Preferred Mode',x.mode]);
  if(x.status)fields.push(['Status',x.status]);
  root.innerHTML=`<div class="public-profile-overlay" role="dialog" aria-modal="true"><div class="public-profile-modal"><button class="public-profile-close" type="button" aria-label="Close">×</button><div class="public-profile-head">${avatar}<div><span class="eyebrow">${label.toUpperCase()} PROFILE</span><h2>${name}</h2><div class="public-profile-meta">${x.verified?'✓ Verified':''}</div></div></div>${fields.length?`<div class="public-profile-grid">${fields.map(f=>`<div class="public-profile-field"><small>${escapeAdminPublicText(f[0])}</small><span>${escapeAdminPublicText(f[1])}</span></div>`).join('')}</div>`:''}${x.details?`<div class="public-profile-bio"><strong>About</strong><br>${escapeAdminPublicText(x.details)}</div>`:''}${x.social?`<div class="public-profile-links"><a href="${escapeAdminPublicText(x.social)}" target="_blank" rel="noopener">Social / Website</a></div>`:''}</div></div>`;
  const overlay=root.firstElementChild;
  overlay.querySelector('.public-profile-close').onclick=()=>root.innerHTML='';
  overlay.addEventListener('click',e=>{if(e.target===overlay)root.innerHTML=''});
}

function renderAdminContentOnPublicSite(){
  if(document.getElementById("adminApp")) return;
  let d;
  try{ d=JSON.parse(localStorage.getItem("ff_nexus_hub_admin_data")||"{}"); }catch(e){ return; }

  // Featured creator is populated only from creators added through Admin.
  const featured=document.getElementById("featuredCreatorContent");
  if(featured){
    const first=Array.isArray(d.creators)?d.creators[0]:null;
    if(first){
      const image=first.image||"";
      const letter=(first.name||"C").trim().charAt(0).toUpperCase();
      featured.innerHTML=`<div class="creator-mini"><div class="avatar"${image?' style="background-image:url(\''+image.replace(/'/g,"%27")+'\');background-size:cover;background-position:center"':''}>${image?'':escapeAdminPublicText(letter)}</div><div><b>${escapeAdminPublicText(first.name||"Creator")}</b><small>UID: ${escapeAdminPublicText(first.uid||"")}</small>${first.status==='Approved'?'<span class="badge verified">✓ VERIFIED</span>':''}</div></div><p>${escapeAdminPublicText(first.details||"")}</p><a href="#creators" class="card-link">View Creator →</a>`;
    }
  }

  // Added creators appear in the existing Creator Directory.
  const creatorGrid=document.getElementById("creatorGrid");
  if(creatorGrid && Array.isArray(d.creators)){
    d.creators.forEach(item=>{
      if(!item || !item.id || creatorGrid.querySelector('[data-admin-id="'+item.id+'"]')) return;
      const card=document.createElement("article");
      card.className="profile-card searchable creator";
      card.dataset.adminId=item.id;
      const letter=(item.name||"C").trim().charAt(0).toUpperCase();
      const image=item.image||"";
      card.innerHTML=`<div class="profile-body"><div class="avatar big"${image?' style="background-image:url(\''+image.replace(/'/g,"%27")+'\')"':''}>${image?'':escapeAdminPublicText(letter)}</div><span class="badge featured">✦ FEATURED</span><h3>${escapeAdminPublicText(item.name||"Creator")}</h3><p>UID ${escapeAdminPublicText(item.uid||"")}</p><p>${escapeAdminPublicText(item.details||"")}</p><div class="socials"><span>${escapeAdminPublicText(item.platform||"Creator")}</span></div><div class="profile-actions"><button class="btn small full" type="button">View Creator Info</button></div></div>`;
      card.querySelector('.profile-actions button').onclick=()=>openPublicProfile({type:'creator',name:item.name||'Creator',uid:item.uid||'',ign:item.ign||'',details:item.details||'',platform:item.platform||'',category:item.category||'',social:item.social||'',status:item.status||'Pending',verified:item.status==='Approved',image});
      creatorGrid.appendChild(card);
    });
  }

  // Added vendors appear in the existing Vendor Directory.
  const vendorGrid=document.querySelector("#vendors .grid");
  if(vendorGrid && Array.isArray(d.vendors)){
    d.vendors.forEach(item=>{
      if(!item || !item.id || vendorGrid.querySelector('[data-admin-id="'+item.id+'"]')) return;
      const card=document.createElement("article");
      card.className="vendor-card searchable"; card.dataset.adminId=item.id;
      const image=item.image||"";
      card.innerHTML=(image?'<img class="vendor-profile-img" src="'+image+'" alt="Vendor logo">':'<div class="vendor-icon">₦</div>')+'<span class="badge verified">✓ VERIFIED</span><h3>'+escapeAdminPublicText(item.name||"Vendor")+'</h3><p>'+escapeAdminPublicText(item.details||"")+'</p><div class="contact-line">Contact vendor</div><button class="btn small full" type="button">View Vendor Info</button>';
      card.querySelector('.btn.small').onclick=()=>openPublicProfile({type:'vendor',name:item.name||'Vendor',contact:item.contact||'',phone:item.phone||'',whatsapp:item.whatsapp||'',category:item.category||'',location:item.location||'',details:item.details||'',social:item.social||'',status:item.status||'Pending',verified:item.status==='Approved',image});
      vendorGrid.appendChild(card);
    });
  }

  // Added tournaments appear in the existing Tournament Hub.
  const tournamentGrid=document.querySelector("#tournaments .tournament-grid");
  if(tournamentGrid && Array.isArray(d.tournaments)){
    d.tournaments.forEach(item=>{
      if(!item || !item.id || tournamentGrid.querySelector('[data-admin-id="'+item.id+'"]')) return;
      const card=document.createElement("article");
      card.className="tourney searchable"; card.dataset.adminId=item.id;card.dataset.tournamentId=item.id;card.dataset.maxSlots=item.maxSlots||48;card.dataset.baseCount=0;
      const cfg=tournamentConfig(item.id,{fee:item.fee||0,prize:item.prize||0,date:item.date||"",maxSlots:Number(item.maxSlots||48),baseCount:0}),max=Number(cfg.maxSlots||48),count=tournamentRegistrationCount(item.id,0);
      card.innerHTML='<div class="tourney-top"><span class="badge featured">✦ FEATURED</span><span>Community</span></div><h3>'+escapeAdminPublicText(item.name||"Tournament")+'</h3><div class="tour-info"><span data-prize>🏆 '+money(cfg.prize)+'</span><span data-entry-fee>🎟️ Entry '+money(cfg.fee)+'</span><span data-slot-count>👥 '+count+'/'+max+' slots</span><span data-date>📅 '+formatTournamentDate(cfg.date)+'</span></div><div class="countdown" data-time="'+escapeAdminPublicText((cfg.date||"")+"T18:00:00")+'">Loading...</div><button class="btn primary full" data-register-btn>Register</button>';
      card.querySelector('[data-register-btn]').onclick=()=>openTournamentRegistration(item.id,item.name||"Tournament",max,0);
      tournamentGrid.appendChild(card);
    });
  }

  // Published news appears in the existing News grid.
  const newsGrid=document.querySelector("#news .news-grid");
  if(newsGrid && Array.isArray(d.news)){
    d.news.forEach(item=>{
      if(!item || !item.id || newsGrid.querySelector('[data-admin-id="'+item.id+'"]')) return;
      const card=document.createElement("article");
      card.className="news-card searchable"; card.dataset.adminId=item.id;
      card.innerHTML='<div class="news-tag">NEXUS UPDATE</div><h3>'+escapeAdminPublicText(item.name||"News")+'</h3><p>'+escapeAdminPublicText(item.details||"")+'</p><a href="#news" class="card-link">Read update →</a>';
      newsGrid.appendChild(card);
    });
  }
}
function escapeAdminPublicText(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}

document.addEventListener("DOMContentLoaded",renderAdminContentOnPublicSite);

/* ===== MONTHLY CREATOR & VENDOR RANKINGS ===== */
function currentRankingMonth(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function rankingFilePreview(inputId, previewId){
  const input=document.getElementById(inputId), preview=document.getElementById(previewId);
  if(!input||!preview)return;
  input.addEventListener('change',()=>{
    const file=input.files?.[0]; if(!file)return;
    if(!file.type.startsWith('image/')){alert('Please choose an image file.');input.value='';return;}
    if(file.size>3*1024*1024){alert('Please choose an image under 3 MB.');input.value='';return;}
    const r=new FileReader();r.onload=e=>{preview.innerHTML=`<img src="${e.target.result}" alt="Ranking image preview">`;preview.dataset.image=e.target.result};r.readAsDataURL(file);
  });
}
function rankingValue(id){return document.getElementById(id)?.value.trim()||''}
function saveMonthlyRankings(){
  if(!adminIsLoggedIn())return;
  const month=rankingValue('rankingMonth')||currentRankingMonth();
  const d=loadAdminData();
  d.monthlyRankings=d.monthlyRankings||{};
  const make=(kind,n)=>({
    position:n,
    name:rankingValue(`${kind}Rank${n}Name`),
    uid:kind==='creator'?rankingValue(`${kind}Rank${n}Uid`):'',
    category:kind==='vendor'?rankingValue(`${kind}Rank${n}Category`):'',
    score:rankingValue(`${kind}Rank${n}Score`),
    image:document.getElementById(`${kind}Rank${n}Preview`)?.dataset.image||''
  });
  const creators=[1,2,3].map(n=>make('creator',n));
  const vendors=[1,2,3].map(n=>make('vendor',n));
  if(creators.every(x=>!x.name) && vendors.every(x=>!x.name)){showToast('Enter at least one Creator or Vendor ranking.');return}
  d.monthlyRankings[month]={month,creators,vendors,savedAt:new Date().toISOString()};
  saveAdminData(d);renderRankingHistory();
  const msg=document.getElementById('rankingMessage');if(msg)msg.textContent=`Rankings for ${month} saved successfully.`;
  showToast('Monthly rankings saved.');adminTouch();
}
function renderRankingHistory(){
  const box=document.getElementById('rankingHistory');if(!box)return;
  const rankings=loadAdminData().monthlyRankings||{};
  const months=Object.keys(rankings).sort().reverse();
  if(!months.length){box.innerHTML='<p class="admin-form-help">No monthly rankings saved yet.</p>';return}
  box.innerHTML=months.map(month=>{
    const r=rankings[month];
    const card=(x,label)=>x?.name?`<div class="ranking-history-card"><b>${label}</b><br>${x.image?`<img src="${x.image}" alt="">`:''}<strong>${escapeAdminText(x.name)}</strong>${x.score?` — ${escapeAdminText(x.score)} pts`:''}${x.uid?`<br><small>UID: ${escapeAdminText(x.uid)}</small>`:''}${x.category?`<br><small>${escapeAdminText(x.category)}</small>`:''}</div>`:'';
    return `<div class="ranking-history-item"><h3>${escapeAdminText(month)}</h3><div class="ranking-history-row"><div><b>Creators</b>${(r.creators||[]).map((x,i)=>card(x,['🥇 1st','🥈 2nd','🥉 3rd'][i])).join('')||'<small>No entries</small>'}</div><div><b>Vendors</b>${(r.vendors||[]).map((x,i)=>card(x,['🥇 1st','🥈 2nd','🥉 3rd'][i])).join('')||'<small>No entries</small>'}</div></div></div>`;
  }).join('');
}
function loadMonthlyRankings(){
  const month=document.getElementById('rankingMonth');if(month&&!month.value)month.value=currentRankingMonth();
  renderRankingHistory();
}
['creatorRank1','creatorRank2','creatorRank3','vendorRank1','vendorRank2','vendorRank3'].forEach(k=>rankingFilePreview(k+'Image',k+'Preview'));


document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('#vendors .vendor-card').forEach(card=>{
    const h=card.querySelector('h3'); const p=card.querySelector('p'); const btn=card.querySelector('.btn.small');
    if(btn&&h){btn.onclick=()=>openPublicProfile({type:'vendor',name:h.textContent,details:p?.textContent||'',status:card.querySelector('.verified')?'Verified':'Listed'});btn.textContent='View Vendor Info';}
  });
  document.querySelectorAll('#creatorGrid .profile-card').forEach(card=>{
    if(card.dataset.adminId)return;
    const h=card.querySelector('h3'); const ps=card.querySelectorAll('.profile-body>p');
    if(h&&!card.querySelector('.profile-actions')){
      const btn=document.createElement('button');btn.className='btn small full';btn.type='button';btn.textContent='View Creator Info';
      btn.onclick=()=>openPublicProfile({type:'creator',name:h.textContent,uid:(ps[0]?.textContent||'').replace(/UID\s*/i,''),details:ps[1]?.textContent||'',status:card.querySelector('.verified')?'Verified':card.querySelector('.featured')?'Featured':'Listed'});
      const actions=document.createElement('div');actions.className='profile-actions';actions.appendChild(btn);card.querySelector('.profile-body').appendChild(actions);
    }
  });
});
