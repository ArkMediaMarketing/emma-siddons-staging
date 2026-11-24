const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const hashToken=async token=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(token)));
export const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256));}
const equal=(a,b)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
const cookieName='__Host-emma_session';
const cookieToken=req=>req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
const json=(data,status=200,cookie)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(token,age)=>`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export async function sessionIdentity(req,env){const token=cookieToken(req);if(!token||!/^[a-f0-9]{64}$/.test(token)||!env.DB)return null;const row=await env.DB.prepare('SELECT email FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await hashToken(token),Date.now()).first();return row?.email?.toLowerCase()===env.ADMIN_EMAIL?.toLowerCase()?row.email:null;}
async function startSession(env,email){const token=randomToken();await env.DB.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').bind(await hashToken(token),email,Date.now()+8*60*60*1000).run();return json({ok:true,email},200,cookie(token,8*60*60));}
async function limited(req,env){const ip=req.headers.get('CF-Connecting-IP')||'local',key=await hashToken(ip);await env.DB.prepare('DELETE FROM login_limits WHERE expires_at<?').bind(Date.now()).run();const row=await env.DB.prepare('INSERT INTO login_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,Date.now()+15*60*1000).first();return row.attempts>10;}
export async function authRoute(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/auth/'))return null;
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(req.headers.get('Origin')!==url.origin)return json({error:'Request origin not allowed'},403);
 if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request too large'},413);
 if(path==='/auth/logout'){const token=cookieToken(req);if(token)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await hashToken(token)).run();return json({ok:true},200,cookie('',0));}
 if(!['/auth/login','/auth/setup'].includes(path))return json({error:'Not found'},404);
 if(await limited(req,env))return json({error:'Too many attempts. Please try again in 15 minutes.'},429);
 const raw=await req.text();if(raw.length>8192)return json({error:'Request too large'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
 const email=String(data.email||'').trim().toLowerCase(),password=data.password;
 if(typeof password!=='string'||password.length>256||email!==env.ADMIN_EMAIL?.toLowerCase())return json({error:'Email or password is incorrect.'},401);
 if(path==='/auth/setup'){
  if(password.length<14)return json({error:'Choose a password with at least 14 characters.'},400);
  if(typeof data.token!=='string'||!/^[a-f0-9]{64}$/.test(data.token))return json({error:'This setup link is invalid or has expired.'},410);
  const salt=randomToken(),hashed=await passwordHash(password,salt),tokenHash=await hashToken(data.token);
  const statements=[env.DB.prepare('INSERT OR IGNORE INTO administrators(id,email,password_hash,salt,created_at) SELECT 1,email,?,?,? FROM setup_tokens WHERE token_hash=? AND email=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM administrators)').bind(hashed,salt,Date.now(),tokenHash,email,Date.now()),env.DB.prepare('DELETE FROM setup_tokens WHERE EXISTS(SELECT 1 FROM administrators)')];
  const result=await env.DB.batch(statements);
  if(!result[0].meta.changes)return json({error:'This setup link has expired or has already been used. Please sign in.'},410);
  return startSession(env,email);
 }
 const admin=await env.DB.prepare('SELECT * FROM administrators WHERE id=1').first();
 const hashed=await passwordHash(password,admin?.salt||'unconfigured-administrator');
 if(!admin||!equal(hashed,admin.password_hash))return json({error:'Email or password is incorrect.'},401);
 await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(Date.now()).run();
 return startSession(env,email);
}
