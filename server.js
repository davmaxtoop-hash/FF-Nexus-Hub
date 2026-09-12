const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || '';
const CONFIGURED_ADMIN_PASSWORD = normalizeAdminPassword(process.env.ADMIN_PASSWORD || '');
// Local/offline-friendly password. For production, set ADMIN_PASSWORD in Railway.
const ADMIN_PASSWORD = CONFIGURED_ADMIN_PASSWORD || 'Max is king';
const MAXSHOP_ADMIN_PASSWORD = normalizeAdminPassword(process.env.MAXSHOP_ADMIN_PASSWORD || ADMIN_PASSWORD);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_aa24b40e2dc0408ac5cdc038b117f6dd191d5a3c';
const APP_URL = process.env.APP_URL || '';
const LISTING_FEE_NGN = Math.max(1, Math.round(Number(process.env.LISTING_FEE_NGN || 10000)));

function normalizeAdminPassword(value){
  let s=String(value ?? '');
  // Normalize copied/pasted Unicode and remove invisible characters that can
  // accidentally get into a Railway variable or mobile browser input.
  try{s=s.normalize('NFKC');}catch(e){}
  s=s.replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
  // If the Railway value was pasted with matching surrounding quotes, accept
  // the intended password rather than treating the quotes as part of it.
  if(s.length>=2 && ((s[0]==='"' && s[s.length-1]==='"') || (s[0]==="'" && s[s.length-1]==="'"))){
    s=s.slice(1,-1).trim();
  }
  return s;
}
app.set('trust proxy', 1);

app.use(express.json({ limit: '8mb', verify: (req,res,buf)=>{ req.rawBody=buf; } }));

// MAX SHOP public routes. These routes intentionally serve files directly — no
// redirects and no MAX SHOP index.html — so Railway/proxy/browser combinations
// cannot get stuck in a redirect loop. The Nexus Hub root index.html remains
// the site's main homepage.
app.get(['/max-shop', '/max-shop/'], (req,res) =>
  res.sendFile(path.join(__dirname, 'max-shop', 'max-introduction.html'))
);
app.get('/max-shop/max-introduction.html', (req,res) =>
  res.sendFile(path.join(__dirname, 'max-shop', 'max-introduction.html'))
);
app.get(['/max-shop/store', '/max-shop/store/'], (req,res) =>
  res.sendFile(path.join(__dirname, 'max-shop', 'max-index.html'))
);
app.get(['/max-shop/store/index.html', '/max-shop/max-index.html'], (req,res) =>
  res.sendFile(path.join(__dirname, 'max-shop', 'max-index.html'))
);

// The admin page has no public link and uses a configurable non-obvious path;
// authentication is still required by the MAX SHOP admin page.
const MAXSHOP_ADMIN_PATH = normalizeRouteSegment(process.env.MAXSHOP_ADMIN_PATH || 'secure-portal-7k4m');

function normalizeRouteSegment(value){
  let s=String(value ?? '').trim().replace(/^\/+|\/+$/g,'');
  s=s.replace(/[^a-zA-Z0-9_-]/g,'');
  return s || 'secure-portal-7k4m';
}

// Deliberately do not expose the old predictable admin URLs.
app.get(['/max-shop/admin','/max-shop/admin/','/max-shop/admin.html','/max-shop/max-admin.html'],
  (req,res)=>res.status(404).send('Not found'));

app.get([`/max-shop/${MAXSHOP_ADMIN_PATH}`, `/max-shop/${MAXSHOP_ADMIN_PATH}/`], (req,res)=>
  res.sendFile(path.join(__dirname,'max-shop','max-admin.html'))
);

// Serve the project from the same directory Railway starts Node from.
// Keep index.html as the Nexus Hub homepage; MAX SHOP has its own filenames.
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'admin.html')));
app.get('/admin/', (req,res)=>res.sendFile(path.join(__dirname,'admin.html')));
app.get('/admin.html', (req,res)=>res.sendFile(path.join(__dirname,'admin.html')));


let sql = null;
let dbInitialized = false;
function dbReady(){ return !!DATABASE_URL && dbInitialized && !!sql; }
function requireDb(req,res,next){ if(!dbReady()) return res.status(503).json({error:'Database is not ready. Check DATABASE_URL and the server logs.'}); next(); }

async function initDb(){
  if(!DATABASE_URL){ console.warn('DATABASE_URL is not configured. Player accounts will not work until it is added.'); return; }
  sql = neon(DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS player_accounts (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    uid TEXT NOT NULL UNIQUE,
    ign TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    playstyle TEXT DEFAULT '',
    preferred_mode TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS player_stats (
    player_id BIGINT PRIMARY KEY REFERENCES player_accounts(id) ON DELETE CASCADE,
    wins INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    tournaments_played INT NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS listing_applications (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT REFERENCES player_accounts(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    uid TEXT DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    payment_amount NUMERIC NOT NULL DEFAULT 0,
    payment_ref TEXT DEFAULT '',
    payment_proof TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending Review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  )`;
  await sql`ALTER TABLE listing_applications ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS listing_applications_payment_reference_idx ON listing_applications(payment_reference)`;
  await sql`CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS support_payments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT DEFAULT '',
    email TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Payment Pending',
    payment_gateway_status TEXT DEFAULT '',
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS support_payments_status_idx ON support_payments(status)`;
  await sql`CREATE TABLE IF NOT EXISTS maxshop_content (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS maxshop_orders (
    id BIGSERIAL PRIMARY KEY,
    order_type TEXT NOT NULL DEFAULT 'diamond_topup',
    package_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    customer_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    uid TEXT NOT NULL,
    payment_reference TEXT NOT NULL UNIQUE,
    payment_status TEXT NOT NULL DEFAULT 'Payment Pending',
    fulfillment_status TEXT NOT NULL DEFAULT 'Awaiting Payment',
    provider_reference TEXT DEFAULT '',
    provider_message TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    provider_order_code TEXT DEFAULT '',
    provider_product_id TEXT DEFAULT '',
    idempotency_key TEXT DEFAULT ''
  )`;
  await sql`ALTER TABLE maxshop_orders ADD COLUMN IF NOT EXISTS provider_order_code TEXT DEFAULT ''`;
  await sql`ALTER TABLE maxshop_orders ADD COLUMN IF NOT EXISTS provider_product_id TEXT DEFAULT ''`;
  await sql`ALTER TABLE maxshop_orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS maxshop_orders_status_idx ON maxshop_orders(payment_status, fulfillment_status)`;

  await sql`CREATE TABLE IF NOT EXISTS tournament_registrations_db (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES player_accounts(id) ON DELETE CASCADE,
    tournament_id TEXT NOT NULL,
    tournament_name TEXT NOT NULL,
    ign TEXT NOT NULL,
    uid TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(player_id, tournament_id),
    UNIQUE(uid, tournament_id)
  )`;
  dbInitialized = true;
  console.log('Neon database ready.');
}

function signPlayer(p){
  if(!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
  return jwt.sign({id:p.id,email:p.email,role:'player'}, JWT_SECRET, {expiresIn:'30d'});
}
function signAdmin(){
  if(!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
  return jwt.sign({role:'admin'}, JWT_SECRET, {expiresIn:'5m'});
}
function adminAuth(req,res,next){
  if(!JWT_SECRET || !ADMIN_PASSWORD) return res.status(503).json({error:'Admin authentication is not configured. Add JWT_SECRET and ADMIN_PASSWORD to the server environment.'});
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token) return res.status(401).json({error:'Admin login required.'});
  try{
    const payload=jwt.verify(token,JWT_SECRET);
    if(payload.role!=='admin') throw new Error('Invalid admin role.');
    req.admin=payload;
    next();
  }catch(e){ return res.status(401).json({error:'Admin session expired. Please log in again.'}); }
}
function signMaxShopAdmin(){
  if(!JWT_SECRET) throw new Error('JWT_SECRET is not configured on the server.');
  return jwt.sign({role:'maxshop_admin'}, JWT_SECRET, {expiresIn:'12h'});
}
function maxShopAdminAuth(req,res,next){
  if(!JWT_SECRET || !MAXSHOP_ADMIN_PASSWORD) return res.status(503).json({error:'MAX SHOP admin authentication is not configured. Add JWT_SECRET and MAXSHOP_ADMIN_PASSWORD to Railway.'});
  const h=req.headers.authorization||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token) return res.status(401).json({error:'MAX SHOP admin login required.'});
  try{
    const payload=jwt.verify(token,JWT_SECRET);
    if(payload.role!=='maxshop_admin') throw new Error('Invalid MAX SHOP admin role.');
    req.maxShopAdmin=payload;
    next();
  }catch(e){ return res.status(401).json({error:'MAX SHOP admin session expired. Please log in again.'}); }
}

function auth(req,res,next){
  if(!JWT_SECRET) return res.status(503).json({error:'JWT_SECRET is not configured on the server.'});
  const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!token) return res.status(401).json({error:'Please log in first.'});
  try{ req.player=jwt.verify(token,JWT_SECRET); next(); }catch(e){ return res.status(401).json({error:'Session expired. Please log in again.'}); }
}

// Railway health checks should confirm that the web server is alive.
// Database availability is reported separately so a temporary/missing DB
// does not make Railway mark the whole deployment as unhealthy/404.
app.get('/api/health',(req,res)=>res.status(200).json({ok:true,database:dbReady(),databaseConfigured:!!DATABASE_URL,adminAuth:!!(JWT_SECRET&&ADMIN_PASSWORD)}));
app.get('/api/config',(req,res)=>res.json({listingFee:LISTING_FEE_NGN,paystackPublicKey:PAYSTACK_PUBLIC_KEY}));

app.get('/api/public-content', requireDb, async (req,res)=>{
  // This endpoint is live website state; never let a proxy/browser serve stale content.
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  try{
    const rows=await sql`SELECT data,updated_at FROM site_content WHERE id=1 LIMIT 1`;
    const row=rows[0];
    res.json({
      exists: !!row,
      data: row?.data || {},
      updatedAt: row?.updated_at || null
    });
  }catch(e){ console.error(e); res.status(500).json({error:'Could not load shared website content.'}); }
});

app.put('/api/admin/public-content', requireDb, adminAuth, async (req,res)=>{
  try{
    const data=req.body?.data;
    if(!data || typeof data!=='object' || Array.isArray(data)) return res.status(400).json({error:'Invalid website content.'});
    const serialized=JSON.stringify(data);
    if(Buffer.byteLength(serialized,'utf8')>7*1024*1024) return res.status(413).json({error:'Website content is too large. Please use smaller images (under 3 MB each).'});
    await sql`INSERT INTO site_content (id,data,updated_at) VALUES (1,${data},NOW())
      ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:'Could not save shared website content.'}); }
});

app.post('/api/admin/login',(req,res)=>{
  try{
    if(!JWT_SECRET || !ADMIN_PASSWORD) return res.status(503).json({error:'Admin authentication is not configured. Add JWT_SECRET and ADMIN_PASSWORD to the server environment.'});
    const password=normalizeAdminPassword(req.body?.password ?? '');
    // Compare normalized values using fixed-size SHA-256 digests.
    // This avoids timing leaks and also makes mobile copy/paste behavior predictable.
    const a=crypto.createHash('sha256').update(password,'utf8').digest();
    const b=crypto.createHash('sha256').update(ADMIN_PASSWORD,'utf8').digest();
    const matches=crypto.timingSafeEqual(a,b);
    if(!matches){
      console.warn(`Admin login rejected: enteredLength=${password.length}`);
      return res.status(401).json({error:'Incorrect password.'});
    }
    console.log('Admin login accepted.');
    res.json({token:signAdmin(),expiresIn:300});
  }catch(e){console.error(e);res.status(500).json({error:'Could not log in to admin.'});}
});

app.post('/api/players/register', requireDb, async (req,res)=>{
  try{
    const {fullName,email,password,uid,ign,whatsapp,playstyle='',preferredMode=''}=req.body||{};
    if(!fullName||!email||!password||!uid||!ign||!whatsapp) return res.status(400).json({error:'Please complete all required fields.'});
    if(password.length<6) return res.status(400).json({error:'Password must be at least 6 characters.'});
    const cleanEmail=String(email).trim().toLowerCase(), cleanUid=String(uid).trim();
    const exists=await sql`SELECT id FROM player_accounts WHERE email=${cleanEmail} OR uid=${cleanUid} LIMIT 1`;
    if(exists.length) return res.status(409).json({error:'An account with this email or UID already exists.'});
    const hash=await bcrypt.hash(password,12);
    const rows=await sql`INSERT INTO player_accounts (full_name,email,password_hash,uid,ign,whatsapp,playstyle,preferred_mode)
      VALUES (${String(fullName).trim()},${cleanEmail},${hash},${cleanUid},${String(ign).trim()},${String(whatsapp).trim()},${String(playstyle).trim()},${String(preferredMode).trim()})
      RETURNING id,full_name,email,uid,ign,whatsapp,playstyle,preferred_mode,created_at`;
    const player=rows[0];
    await sql`INSERT INTO player_stats (player_id) VALUES (${player.id}) ON CONFLICT (player_id) DO NOTHING`;
    res.status(201).json({token:signPlayer(player),player});
  }catch(e){ console.error(e); res.status(500).json({error:'Could not create the player account.'}); }
});

app.post('/api/players/login', requireDb, async (req,res)=>{
  try{
    const {email,password}=req.body||{}; if(!email||!password) return res.status(400).json({error:'Email and password are required.'});
    const rows=await sql`SELECT * FROM player_accounts WHERE email=${String(email).trim().toLowerCase()} LIMIT 1`;
    if(!rows.length || !(await bcrypt.compare(password,rows[0].password_hash))) return res.status(401).json({error:'Incorrect email or password.'});
    const p=rows[0]; delete p.password_hash;
    res.json({token:signPlayer(p),player:p});
  }catch(e){ console.error(e); res.status(500).json({error:'Could not log you in.'}); }
});

app.get('/api/players/me', requireDb, auth, async (req,res)=>{
  const rows=await sql`SELECT id,full_name,email,uid,ign,whatsapp,playstyle,preferred_mode,created_at FROM player_accounts WHERE id=${req.player.id} LIMIT 1`;
  if(!rows.length) return res.status(404).json({error:'Player account not found.'});
  res.json({player:rows[0]});
});


app.get('/api/players/public', requireDb, async (req,res)=>{
  const rows=await sql`SELECT p.id,p.full_name,p.uid,p.ign,p.playstyle,p.preferred_mode,p.created_at,COALESCE(s.wins,0) wins,COALESCE(s.points,0) points,COALESCE(s.tournaments_played,0) tournaments_played,s.verified
    FROM player_accounts p LEFT JOIN player_stats s ON s.player_id=p.id ORDER BY COALESCE(s.points,0) DESC,p.created_at DESC LIMIT 100`;
  res.json({players:rows});
});

app.get('/api/players/me/stats', requireDb, auth, async (req,res)=>{
  await sql`INSERT INTO player_stats (player_id) VALUES (${req.player.id}) ON CONFLICT (player_id) DO NOTHING`;
  const rows=await sql`SELECT wins,points,tournaments_played,verified FROM player_stats WHERE player_id=${req.player.id}`;
  const regs=await sql`SELECT id,tournament_id,tournament_name,created_at FROM tournament_registrations_db WHERE player_id=${req.player.id} ORDER BY created_at DESC`;
  res.json({stats:rows[0]||{wins:0,points:0,tournaments_played:0,verified:false},registrations:regs});
});

app.get('/api/players/me/notifications', requireDb, auth, async (req,res)=>{
  const rows=await sql`SELECT id,title,message,is_read,created_at FROM notifications WHERE player_id=${req.player.id} ORDER BY created_at DESC LIMIT 50`;
  res.json({notifications:rows});
});
app.post('/api/players/me/notifications/:id/read', requireDb, auth, async (req,res)=>{
  await sql`UPDATE notifications SET is_read=TRUE WHERE id=${req.params.id} AND player_id=${req.player.id}`; res.json({ok:true});
});

async function verifyPaystack(reference){
  if(!PAYSTACK_SECRET_KEY) throw new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
  const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{
    headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`}
  });
  const data=await response.json();
  if(!response.ok || !data.status) throw new Error(data.message||'Paystack verification failed.');
  return data.data;
}

app.post('/api/support/initialize', requireDb, async (req,res)=>{
  try{
    if(!PAYSTACK_SECRET_KEY) return res.status(503).json({error:'Paystack is not configured. Add PAYSTACK_SECRET_KEY to the server environment.'});
    const b=req.body||{};
    const email=String(b.email||'').trim().toLowerCase();
    const name=String(b.name||'').trim();
    const amount=Math.round(Number(b.amount));
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:'Please enter a valid email address.'});
    if(!Number.isFinite(amount) || amount<=0) return res.status(400).json({error:'Enter any positive amount you want to support with.'});
    const reference=`FFNEXUS_SUPPORT_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    await sql`INSERT INTO support_payments (name,email,amount,reference,status) VALUES (${name},${email},${amount},${reference},'Payment Pending')`;
    const base=APP_URL.replace(/\/$/,'') || `${req.protocol}://${req.get('host')}`;
    const paystackResponse=await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({email,amount:String(amount*100),currency:'NGN',reference,callback_url:`${base}/support/paystack/callback`,metadata:{support_payment:true,support_id:reference,name}})
    });
    const result=await paystackResponse.json();
    if(!paystackResponse.ok || !result.status){
      await sql`UPDATE support_payments SET status='Payment Initialization Failed' WHERE reference=${reference}`;
      return res.status(502).json({error:result.message||'Could not initialize support payment.'});
    }
    res.status(201).json({reference:result.data.reference,authorization_url:result.data.authorization_url});
  }catch(e){console.error('Support payment initialization error:',e);res.status(500).json({error:e.message||'Could not start support payment.'});}
});

app.post('/api/paystack/initialize', requireDb, async (req,res)=>{
  try{
    if(!PAYSTACK_SECRET_KEY) return res.status(503).json({error:'Paystack is not configured. Add PAYSTACK_SECRET_KEY to the server environment.'});
    const b=req.body||{}; const type=String(b.type||'').toLowerCase();
    if(!['creator','vendor'].includes(type)) return res.status(400).json({error:'Paystack is only required for creator and vendor listings.'});
    if(!b.name || !b.email) return res.status(400).json({error:'Name and email are required.'});
    const amount=LISTING_FEE_NGN;
    const reference=`FFNEXUS_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const payload={...b}; delete payload.password;
    const rows=await sql`INSERT INTO listing_applications (type,name,uid,payload,payment_amount,payment_ref,payment_reference,status)
      VALUES (${type},${String(b.name)},${String(b.uid||'')},${JSON.stringify(payload)},${amount},${reference},${reference},'Payment Pending') RETURNING id,created_at,status,payment_reference`;
    const application=rows[0];
    const base=APP_URL.replace(/\/$/,'') || `${req.protocol}://${req.get('host')}`;
    const paystackResponse=await fetch('https://api.paystack.co/transaction/initialize',{
      method:'POST',headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({email:String(b.email).trim().toLowerCase(),amount:String(amount*100),currency:'NGN',reference,callback_url:`${base}/paystack/callback`,metadata:{application_id:String(application.id),application_type:type}})
    });
    const result=await paystackResponse.json();
    if(!paystackResponse.ok || !result.status){
      await sql`UPDATE listing_applications SET status='Payment Initialization Failed' WHERE id=${application.id}`;
      return res.status(502).json({error:result.message||'Could not initialize Paystack payment.'});
    }
    res.status(201).json({applicationId:application.id,reference:result.data.reference,authorization_url:result.data.authorization_url,access_code:result.data.access_code,publicKey:PAYSTACK_PUBLIC_KEY});
  }catch(e){console.error(e);res.status(500).json({error:e.message||'Could not start Paystack payment.'});}
});

app.post('/api/applications', requireDb, async (req,res)=>{
  try{
    const b=req.body||{}; const type=String(b.type||'').toLowerCase();
    if(type!=='player') return res.status(400).json({error:'Creator and vendor applications must be paid through Paystack.'});
    if(!b.name) return res.status(400).json({error:'Name is required.'});
    const payload={...b}; delete payload.password;
    let linkedPlayerId=null;
    const h=req.headers.authorization||'';
    if(h.startsWith('Bearer ')){try{const t=jwt.verify(h.slice(7),JWT_SECRET);linkedPlayerId=t.id}catch(e){}}
    const rows=await sql`INSERT INTO listing_applications (player_id,type,name,uid,payload,payment_amount,payment_ref,payment_reference,status)
      VALUES (${linkedPlayerId},'player',${String(b.name)},${String(b.uid||'')},${JSON.stringify(payload)},0,'','', 'Pending Player Review') RETURNING id,created_at,status`;
    res.status(201).json({application:rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not submit application.'});}
});

async function finalizeSupportPayment(reference){
  const tx=await verifyPaystack(reference);
  const rows=await sql`SELECT * FROM support_payments WHERE reference=${reference} LIMIT 1`;
  if(!rows.length) return {found:false,tx};
  const row=rows[0];
  const expected=Math.round(Number(row.amount||0)*100);
  const paid=tx.status==='success' && Number(tx.amount)===expected && String(tx.currency||'').toUpperCase()==='NGN';
  if(!paid){
    await sql`UPDATE support_payments SET status='Payment Failed',payment_gateway_status=${String(tx.status||'unknown')} WHERE id=${row.id}`;
    return {found:true,paid:false,tx};
  }
  await sql`UPDATE support_payments SET status='Paid',payment_gateway_status='success',paid_at=NOW() WHERE id=${row.id} AND status<>'Paid'`;
  return {found:true,paid:true,tx};
}

async function finalizePaystackPayment(reference){
  const tx=await verifyPaystack(reference);
  const rows=await sql`SELECT * FROM listing_applications WHERE payment_reference=${reference} OR payment_ref=${reference} LIMIT 1`;
  if(!rows.length) return {found:false,tx};
  const appRow=rows[0];
  const expected=Math.round(Number(appRow.payment_amount||0)*100);
  if(tx.status!=='success' || Number(tx.amount)!==expected || String(tx.currency||'').toUpperCase()!=='NGN'){
    await sql`UPDATE listing_applications SET status='Payment Failed' WHERE id=${appRow.id}`;
    return {found:true,paid:false,tx};
  }
  // A successful Paystack payment is the approval for paid Creator/Vendor listings.
  // Keep the application in the admin Applications/Review page for audit history,
  // but publish it immediately without requiring a manual Approve & Publish action.
  const approvedAt = new Date();
  await sql`UPDATE listing_applications SET status='Approved',payment_ref=${reference},payment_reference=${reference},reviewed_at=NOW() WHERE id=${appRow.id}`;

  if(appRow.type==='creator' || appRow.type==='vendor'){
    const contentRows=await sql`SELECT data FROM site_content WHERE id=1 LIMIT 1`;
    const content=contentRows[0]?.data && typeof contentRows[0].data==='object' ? contentRows[0].data : {};
    const target=appRow.type==='creator'?'creators':'vendors';
    const list=Array.isArray(content[target]) ? content[target].slice() : [];
    const payload=appRow.payload && typeof appRow.payload==='object' ? appRow.payload : {};
    const published={...payload,id:appRow.id,name:appRow.name,uid:appRow.uid||payload.uid||'',status:'Approved',paymentStatus:'Paid',paymentReference:reference,paymentAmount:Number(appRow.payment_amount||0),paymentConfirmedAt:approvedAt.toISOString(),createdAt:appRow.created_at};
    const existingIndex=list.findIndex(x=>String(x?.id)===String(appRow.id));
    if(existingIndex>=0) list[existingIndex]=published; else list.unshift(published);
    content[target]=list;
    await sql`INSERT INTO site_content (id,data,updated_at) VALUES (1,${content},NOW())
      ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
  }
  return {found:true,paid:true,tx};
}


async function fulfillMaxShopOrder(order){
  const apiKey=String(process.env.GAMECORE_API_KEY||'').trim();
  const baseUrl=String(process.env.GAMECORE_BASE_URL||'https://api.gamecore-api.tech').trim().replace(/\/$/,'');
  if(!apiKey) return {ok:false,pending:true,message:'Payment confirmed. Free Fire delivery is waiting for the GameCore API key.'};
  try{
    const cat=await fetch(`${baseUrl}/b2b/catalog/games/free-fire/products?deliveryType=id_only`,{headers:{'X-Api-Key':apiKey}});
    const catalog=await cat.json().catch(()=>({}));
    if(!cat.ok || catalog.success===false) return {ok:false,pending:true,message:catalog.error||'Could not load Free Fire top-up products from GameCore.'};
    const products=Array.isArray(catalog.data)?catalog.data:[];
    const digits=String(order.package_name||'').replace(/[^0-9]/g,'');
    const wanted=Number(digits);
    const product=products.find(p=>Number(p?.amountType?.value)===wanted) || products.find(p=>String(p?.name||'').toLowerCase().includes(String(wanted)));
    if(!product) return {ok:false,pending:true,message:`GameCore has no matching Free Fire product for ${order.package_name}.`};
    const schema=Array.isArray(product.deliveryDataSchema)?product.deliveryDataSchema:[];
    const idField=schema.find(x=>x?.required)?.id || schema[0]?.id;
    if(!idField) return {ok:false,pending:true,message:'GameCore did not provide a Player ID field for this product.'};
    const idem=String(order.idempotency_key||`MAX-${order.payment_reference}`);
    const r=await fetch(`${baseUrl}/b2b/orders`,{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':apiKey,'X-Idempotency-Key':idem},body:JSON.stringify({items:[{productId:Number(product.id),quantity:1,deliveryData:{[idField]:String(order.uid)}}],externalOrderId:String(order.payment_reference)})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok || data.success===false) return {ok:false,pending:true,message:data.error||data.message||`GameCore rejected the top-up (${r.status}).`};
    const code=String(data?.data?.orders?.[0]?.code||'');
    if(!code) return {ok:false,pending:true,message:'GameCore accepted the request but returned no order code.'};
    return {ok:true,processing:true,providerReference:code,productId:String(product.id),message:'GameCore accepted the Free Fire top-up. Waiting for delivery confirmation.'};
  }catch(e){ return {ok:false,pending:true,message:'GameCore could not be reached. The paid order is safe and can be retried.'}; }
}

async function pollGameCoreOrder(order){
  const apiKey=String(process.env.GAMECORE_API_KEY||'').trim();
  const baseUrl=String(process.env.GAMECORE_BASE_URL||'https://api.gamecore-api.tech').trim().replace(/\/$/,'');
  const code=String(order.provider_order_code||'').trim();
  if(!apiKey || !code) return;
  try{
    const r=await fetch(`${baseUrl}/b2b/orders/${encodeURIComponent(code)}`,{headers:{'X-Api-Key':apiKey}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok || data.success===false) return;
    const status=String(data?.data?.status||'').toLowerCase();
    if(status==='completed') await sql`UPDATE maxshop_orders SET fulfillment_status='Fulfilled',provider_message='Free Fire diamonds delivered successfully.',fulfilled_at=NOW() WHERE id=${order.id}`;
    else if(['failed','cancelled','refunded'].includes(status)) await sql`UPDATE maxshop_orders SET fulfillment_status='Delivery Failed',provider_message=${`GameCore status: ${status}`} WHERE id=${order.id}`;
  }catch(e){}
}

async function processPendingGameCoreOrders(){
  try{ const rows=await sql`SELECT * FROM maxshop_orders WHERE payment_status='Paid' AND fulfillment_status='Processing Top Up' AND provider_order_code<>'' ORDER BY id ASC LIMIT 20`; for(const row of rows) await pollGameCoreOrder(row); }catch(e){ console.error('GameCore poll:',e.message||e); }
}


app.post('/api/maxshop/admin/login',(req,res)=>{
  const password=normalizeAdminPassword(req.body?.password||'');
  if(!JWT_SECRET || !MAXSHOP_ADMIN_PASSWORD) return res.status(503).json({error:'MAX SHOP admin authentication is not configured. Add JWT_SECRET and MAXSHOP_ADMIN_PASSWORD to Railway.'});
  if(password!==MAXSHOP_ADMIN_PASSWORD) return res.status(401).json({error:'Wrong MAX SHOP admin password.'});
  res.json({ok:true,token:signMaxShopAdmin()});
});

app.get('/api/maxshop/data', requireDb, async (req,res)=>{
  try{ const rows=await sql`SELECT data,updated_at FROM maxshop_content WHERE id=1 LIMIT 1`; const data=rows[0]?.data || defaultMaxShopData(); res.set('Cache-Control','no-store'); res.json({data,updatedAt:rows[0]?.updated_at||null}); }
  catch(e){res.status(500).json({error:'Could not load MAX SHOP data.'});}
});

app.put('/api/maxshop/admin/data', requireDb, maxShopAdminAuth, async (req,res)=>{
  try{ const data=req.body?.data; if(!data || typeof data!=='object' || Array.isArray(data)) return res.status(400).json({error:'Invalid MAX SHOP data.'}); const serialized=JSON.stringify(data); if(Buffer.byteLength(serialized,'utf8')>7*1024*1024) return res.status(413).json({error:'MAX SHOP data is too large. Reduce image sizes.'});
    await sql`INSERT INTO maxshop_content(id,data,updated_at) VALUES(1,${data},NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`; res.json({ok:true});
  }catch(e){console.error('MAX SHOP admin save:',e);res.status(500).json({error:'Could not save MAX SHOP data.'});}
});

app.get('/api/maxshop/admin/orders', requireDb, maxShopAdminAuth, async (req,res)=>{
  try{ const rows=await sql`SELECT id,package_name,amount,customer_name,phone,email,uid,payment_reference,payment_status,fulfillment_status,provider_reference,provider_message,created_at,paid_at,fulfilled_at FROM maxshop_orders ORDER BY id DESC LIMIT 200`; res.json({orders:rows}); }catch(e){res.status(500).json({error:'Could not load MAX SHOP orders.'});}
});

app.post('/api/maxshop/admin/orders/:id/retry', requireDb, maxShopAdminAuth, async (req,res)=>{
  try{ const rows=await sql`SELECT * FROM maxshop_orders WHERE id=${Number(req.params.id)} LIMIT 1`; if(!rows.length)return res.status(404).json({error:'Order not found.'}); const order=rows[0]; if(order.payment_status!=='Paid')return res.status(400).json({error:'Only paid orders can be retried.'}); await sql`UPDATE maxshop_orders SET fulfillment_status='Processing Top Up',provider_message='Delivery retry queued by MAX SHOP admin.' WHERE id=${order.id}`; const current=(await sql`SELECT * FROM maxshop_orders WHERE id=${order.id}`)[0]; const delivery=await fulfillMaxShopOrder(current); if(delivery.ok){ await sql`UPDATE maxshop_orders SET fulfillment_status=${delivery.processing?'Processing Top Up':'Fulfilled'},provider_reference=${delivery.providerReference||''},provider_order_code=${delivery.providerReference||''},provider_product_id=${delivery.productId||''},idempotency_key=COALESCE(NULLIF(idempotency_key,''),${`MAX-${order.payment_reference}-RETRY`}),provider_message=${delivery.message||''},fulfilled_at=${delivery.processing?null:new Date()} WHERE id=${order.id}`; } else { await sql`UPDATE maxshop_orders SET fulfillment_status='Awaiting Provider',provider_message=${delivery.message||'Provider unavailable.'} WHERE id=${order.id}`; } res.json({ok:true}); }catch(e){console.error('MAX SHOP retry:',e);res.status(500).json({error:'Could not retry delivery.'});}
});

app.post('/api/maxshop/reviews', requireDb, async (req,res)=>{
  try{ const name=String(req.body?.name||'').trim().slice(0,80), purchaseType=String(req.body?.purchaseType||'Purchase').slice(0,50), text=String(req.body?.text||'').trim().slice(0,1000), rating=Math.max(1,Math.min(5,Number(req.body?.rating||5))); if(!name||!text)return res.status(400).json({error:'Name and review are required.'}); const rows=await sql`SELECT data FROM maxshop_content WHERE id=1 LIMIT 1`; const d=rows[0]?.data||defaultMaxShopData(); d.reviews=Array.isArray(d.reviews)?d.reviews:[]; d.reviews.push({id:'REV-'+Date.now(),name,purchaseType,rating,text,approved:true,createdAt:new Date().toISOString()}); await sql`INSERT INTO maxshop_content(id,data,updated_at) VALUES(1,${d},NOW()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`; res.status(201).json({ok:true}); }catch(e){res.status(500).json({error:'Could not submit review.'});}
});

app.post('/api/maxshop/paystack/initialize', requireDb, async (req,res)=>{
  try{
    if(!PAYSTACK_SECRET_KEY) return res.status(503).json({error:'Paystack is not configured. Add PAYSTACK_SECRET_KEY on the Nexus Hub server.'});
    const b=req.body||{};
    const amount=Math.round(Number(b.amount));
    const uid=String(b.uid||'').trim();
    const packageName=String(b.packageName||'Free Fire Top Up').trim();
    const email=String(b.email||'').trim().toLowerCase();
    if(!Number.isFinite(amount)||amount<1) return res.status(400).json({error:'Invalid amount.'});
    if(!uid) return res.status(400).json({error:'Free Fire UID is required.'});
    if(!email || !email.includes('@')) return res.status(400).json({error:'A valid email is required for Paystack receipt.'});
    const reference=`MAXSHOP_${Date.now()}_${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    await sql`INSERT INTO maxshop_orders (package_name,amount,customer_name,phone,email,uid,payment_reference) VALUES (${packageName},${amount},${String(b.customerName||'')},${String(b.phone||'')},${email},${uid},${reference})`;
    const base=APP_URL || `${req.protocol}://${req.get('host')}`;
    const ps=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:String(amount*100),currency:'NGN',reference,callback_url:`${base}/max-shop/paystack/callback`,metadata:{maxshop_order:true,reference,uid,packageName}})});
    const result=await ps.json();
    if(!ps.ok||!result.status){ await sql`UPDATE maxshop_orders SET payment_status='Payment Initialization Failed' WHERE payment_reference=${reference}`; return res.status(502).json({error:result.message||'Could not initialize Paystack payment.'}); }
    res.status(201).json({reference:result.data.reference,authorization_url:result.data.authorization_url,access_code:result.data.access_code,publicKey:PAYSTACK_PUBLIC_KEY});
  }catch(e){console.error('MAX SHOP Paystack init:',e);res.status(500).json({error:e.message||'Could not start payment.'});}
});

async function finalizeMaxShopPayment(reference){
  const tx=await verifyPaystack(reference);
  const rows=await sql`SELECT * FROM maxshop_orders WHERE payment_reference=${reference} LIMIT 1`;
  if(!rows.length) throw new Error('MAX SHOP order not found.');
  const order=rows[0];
  const expected=Math.round(Number(order.amount)*100);
  if(tx.status!=='success' || Number(tx.amount)!==expected || String(tx.currency||'').toUpperCase()!=='NGN'){
    await sql`UPDATE maxshop_orders SET payment_status='Payment Failed' WHERE id=${order.id}`;
    return {paid:false,order};
  }
  await sql`UPDATE maxshop_orders SET payment_status='Paid',fulfillment_status=CASE WHEN fulfillment_status='Fulfilled' THEN fulfillment_status ELSE 'Processing Top Up' END,paid_at=COALESCE(paid_at,NOW()) WHERE id=${order.id}`;
  const current=(await sql`SELECT * FROM maxshop_orders WHERE id=${order.id}`)[0];
  if(current.fulfillment_status!=='Fulfilled'){
    const delivery=await fulfillMaxShopOrder(current);
    if(delivery.ok){
      const fs=delivery.processing?'Processing Top Up':'Fulfilled';
      if(delivery.processing){
        await sql`UPDATE maxshop_orders SET fulfillment_status=${fs},provider_reference=${delivery.providerReference||''},provider_order_code=${delivery.providerReference||''},provider_product_id=${delivery.productId||''},idempotency_key=COALESCE(NULLIF(idempotency_key,''),${`MAX-${reference}`}),provider_message=${delivery.message||''} WHERE id=${order.id}`;
      }else{
        await sql`UPDATE maxshop_orders SET fulfillment_status=${fs},provider_reference=${delivery.providerReference||''},provider_order_code=${delivery.providerReference||''},provider_product_id=${delivery.productId||''},idempotency_key=COALESCE(NULLIF(idempotency_key,''),${`MAX-${reference}`}),provider_message=${delivery.message||''},fulfilled_at=NOW() WHERE id=${order.id}`;
      }
      current.fulfillment_status=fs; current.provider_reference=delivery.providerReference||''; current.provider_order_code=delivery.providerReference||''; current.provider_message=delivery.message||'';
    }else{
      await sql`UPDATE maxshop_orders SET fulfillment_status='Awaiting Provider',provider_message=${delivery.message||''},idempotency_key=COALESCE(NULLIF(idempotency_key,''),${`MAX-${reference}`}) WHERE id=${order.id}`;
      current.fulfillment_status='Awaiting Provider'; current.provider_message=delivery.message||'';
    }
  }
  return {paid:true,order:current};
}

app.get('/max-shop/paystack/callback', requireDb, async (req,res)=>{
  const reference=String(req.query.reference||'');
  if(!reference) return res.redirect('/max-shop/?payment=failed');
  try{const result=await finalizeMaxShopPayment(reference);res.redirect(result.paid?`/max-shop/?payment=success&reference=${encodeURIComponent(reference)}`:`/max-shop/?payment=failed&reference=${encodeURIComponent(reference)}`);}catch(e){console.error('MAX SHOP callback:',e);res.redirect('/max-shop/?payment=failed');}
});

app.get('/api/maxshop/orders/:reference', requireDb, async (req,res)=>{
  try{
    const rows=await sql`SELECT payment_reference,package_name,amount,uid,payment_status,fulfillment_status,provider_message,created_at,paid_at,fulfilled_at FROM maxshop_orders WHERE payment_reference=${String(req.params.reference)} LIMIT 1`;
    if(!rows.length)return res.status(404).json({error:'Order not found.'});
    res.json({order:rows[0]});
  }catch(e){res.status(500).json({error:'Could not load order.'});}
});

app.get('/paystack/callback', requireDb, async (req,res)=>{
  try{
    const reference=String(req.query.reference||'').trim();
    if(!reference) return res.redirect('/?payment=failed');
    if(reference.startsWith('FFNEXUS_SUPPORT_')){
      const result=await finalizeSupportPayment(reference);
      return res.redirect(result.paid?`/?support=success&reference=${encodeURIComponent(reference)}`:`/?support=failed&reference=${encodeURIComponent(reference)}`);
    }
    const result=await finalizePaystackPayment(reference);
    res.redirect(result.paid?`/?payment=success&reference=${encodeURIComponent(reference)}`:`/?payment=failed&reference=${encodeURIComponent(reference)}`);
  }catch(e){console.error(e);res.redirect('/?payment=failed');}
});

app.post('/api/paystack/webhook', requireDb, async (req,res)=>{
  try{
    const signature=req.headers['x-paystack-signature']||'';
    const expected=crypto.createHmac('sha512',PAYSTACK_SECRET_KEY).update(req.rawBody||Buffer.from(JSON.stringify(req.body))).digest('hex');
    const sig=Buffer.from(String(signature)); const exp=Buffer.from(expected);
    if(!PAYSTACK_SECRET_KEY || sig.length!==exp.length || !crypto.timingSafeEqual(sig,exp)) return res.sendStatus(401);
    res.sendStatus(200);
    if(req.body?.event==='charge.success' && req.body?.data?.reference){
      try{
        const ref=String(req.body.data.reference);
        if(ref.startsWith('FFNEXUS_SUPPORT_')) await finalizeSupportPayment(ref);
        else if(ref.startsWith('MAXSHOP_')) await finalizeMaxShopPayment(ref);
        else await finalizePaystackPayment(ref);
      }catch(e){console.error('Paystack webhook processing error:',e);}
    }
  }catch(e){console.error('Paystack webhook error:',e);res.sendStatus(400);}
});

app.get('/api/admin/support-payments', requireDb, adminAuth, async (req,res)=>{
  try{
    const rows=await sql`SELECT id,name,email,amount,reference,status,reviewed,reviewed_at,created_at,paid_at FROM support_payments ORDER BY created_at DESC`;
    res.json({payments:rows});
  }catch(e){console.error(e);res.status(500).json({error:'Could not load Support Reviews.'});}
});

app.post('/api/admin/support-payments/:id/review', requireDb, adminAuth, async (req,res)=>{
  try{
    const rows=await sql`UPDATE support_payments SET reviewed=TRUE,reviewed_at=NOW() WHERE id=${req.params.id} RETURNING *`;
    if(!rows.length) return res.status(404).json({error:'Support payment not found.'});
    res.json({payment:rows[0]});
  }catch(e){console.error(e);res.status(500).json({error:'Could not mark support payment reviewed.'});}
});

app.get('/api/admin/applications', requireDb, adminAuth, async (req,res)=>{
  const rows=await sql`SELECT id,type,name,uid,payload,payment_amount,payment_ref,payment_proof,status,created_at,reviewed_at FROM listing_applications ORDER BY created_at DESC`;
  res.json({applications:rows});
});
app.post('/api/admin/applications/:id/review', requireDb, adminAuth, async (req,res)=>{
  const action=String(req.body?.action||'').toLowerCase();
  const status=action==='approve'?'Approved':action==='reject'?'Rejected':null;
  if(!status) return res.status(400).json({error:'Invalid review action.'});
  const rows=await sql`UPDATE listing_applications SET status=${status},reviewed_at=NOW() WHERE id=${req.params.id} RETURNING *`;
  if(!rows.length) return res.status(404).json({error:'Application not found.'});
  const a=rows[0];
  if(a.player_id){ await sql`INSERT INTO notifications (player_id,title,message) VALUES (${a.player_id},${status==='Approved'?'Application approved':'Application update'},${status==='Approved'?'Your application has been approved and published.':'Your application was not approved.'})`; }
  res.json({application:a});
});

app.get('/api/admin/leaderboard', requireDb, adminAuth, async (req,res)=>{
  const rows=await sql`SELECT p.id,p.full_name,p.uid,p.ign,COALESCE(s.wins,0) wins,COALESCE(s.points,0) points,COALESCE(s.tournaments_played,0) tournaments_played,COALESCE(s.verified,FALSE) verified FROM player_accounts p LEFT JOIN player_stats s ON s.player_id=p.id ORDER BY COALESCE(s.points,0) DESC,COALESCE(s.wins,0) DESC,p.ign ASC`;
  res.json({players:rows});
});
app.post('/api/admin/leaderboard/:playerId', requireDb, adminAuth, async (req,res)=>{
  const b=req.body||{}; const wins=Math.max(0,Number(b.wins||0)),points=Math.max(0,Number(b.points||0)),played=Math.max(0,Number(b.tournamentsPlayed||0)),verified=!!b.verified;
  await sql`INSERT INTO player_stats (player_id,wins,points,tournaments_played,verified) VALUES (${req.params.playerId},${wins},${points},${played},${verified}) ON CONFLICT (player_id) DO UPDATE SET wins=EXCLUDED.wins,points=EXCLUDED.points,tournaments_played=EXCLUDED.tournaments_played,verified=EXCLUDED.verified,updated_at=NOW()`;
  res.json({ok:true});
});

app.get('/api/stats', requireDb, async (req,res)=>{
  const rows=await sql`SELECT COUNT(*)::int AS player_count FROM player_accounts`;
  res.json({players:rows[0].player_count});
});

app.get('/api/admin/players', requireDb, adminAuth, async (req,res)=>{
  // Admin UI still uses its existing login. This endpoint should be protected by a real admin auth system before production.
  const rows=await sql`SELECT id,full_name,email,uid,ign,whatsapp,playstyle,preferred_mode,created_at FROM player_accounts ORDER BY created_at DESC`;
  res.json({players:rows});
});

app.post('/api/tournaments/:tournamentId/register', requireDb, auth, async (req,res)=>{
  try{
    const {tournamentName,ign,uid,whatsapp,maxSlots}=req.body||{};
    if(!tournamentName||!ign||!uid||!whatsapp) return res.status(400).json({error:'Tournament registration details are incomplete.'});
    const limit=Number(maxSlots||0);
    if(limit>0){ const c=await sql`SELECT COUNT(*)::int AS count FROM tournament_registrations_db WHERE tournament_id=${req.params.tournamentId}`; if(Number(c[0].count)>=limit) return res.status(409).json({error:'Registration closed — all tournament slots are full.'}); }
    const rows=await sql`INSERT INTO tournament_registrations_db (player_id,tournament_id,tournament_name,ign,uid,whatsapp)
      VALUES (${req.player.id},${req.params.tournamentId},${String(tournamentName)},${String(ign).trim()},${String(uid).trim()},${String(whatsapp).trim()})
      RETURNING id,created_at`;
    await sql`INSERT INTO player_stats (player_id,tournaments_played) VALUES (${req.player.id},1) ON CONFLICT (player_id) DO UPDATE SET tournaments_played=player_stats.tournaments_played+1,updated_at=NOW()`;
    await sql`INSERT INTO notifications (player_id,title,message) VALUES (${req.player.id},'Tournament registration confirmed',${'Your slot for '+String(tournamentName)+' has been reserved successfully.'})`;
    res.status(201).json({registration:rows[0]});
  }catch(e){
    if(String(e.message||'').includes('duplicate key')) return res.status(409).json({error:'This player or UID is already registered for this tournament.'});
    console.error(e); res.status(500).json({error:'Could not register for the tournament.'});
  }
});

app.get('/api/admin/tournament-registrations', requireDb, adminAuth, async (req,res)=>{
  const rows=await sql`SELECT id,tournament_id,tournament_name,ign,uid,whatsapp,created_at FROM tournament_registrations_db ORDER BY created_at DESC`;
  res.json({registrations:rows});
});

app.get('/api/tournaments/:tournamentId/registrations/count', requireDb, async (req,res)=>{
  const rows=await sql`SELECT COUNT(*)::int AS count FROM tournament_registrations_db WHERE tournament_id=${req.params.tournamentId}`;
  res.json({count:rows[0].count});
});

app.get('/{*splat}',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));

initDb().then(()=>app.listen(PORT,()=>console.log(`FF Nexus Hub running on port ${PORT}`))).catch(err=>{console.error('Database initialization failed:',err); app.listen(PORT,()=>console.log(`FF Nexus Hub running on port ${PORT} (database unavailable)`));});


// MAX SHOP module: static files live under /max-shop/.
// Keep Nexus Hub's root index.html as the main site.
// MAX SHOP admin is intentionally not linked from public pages.
