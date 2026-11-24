import catalog from './catalog.json' with { type: 'json' };
import { sessionIdentity, authRoute } from './auth.js';
import { safeURL, validateValues, defaults } from './validation.js';
const docs=new Map(catalog.documents.map(d=>[d.id,d]));
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const now=()=>new Date().toISOString();
async function identity(req,env) {
 const url=new URL(req.url);
 if(env.LOCAL_DEVELOPMENT==='true'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return env.ADMIN_EMAIL;
 return sessionIdentity(req,env);
}
async function state(id,env) {
 const row=await env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(id).first();
 return row?{values:JSON.parse(row.draft),published:row.published?JSON.parse(row.published):null,revision:row.revision,updatedAt:row.updated_at,publishedAt:row.published_at,updatedBy:row.updated_by}:{values:defaults(docs.get(id)),published:null,revision:0,updatedAt:null,publishedAt:null,updatedBy:null};
}
async function render(req,env,preview=false) {
 const url=new URL(req.url);url.searchParams.delete('preview');
 const asset=await env.ASSETS.fetch(new Request(url,req));
 if(!asset.headers.get('content-type')?.includes('text/html')||asset.status!==200) return asset;
 const route=url.pathname.endsWith('/index.html')?url.pathname.slice(0,-10):url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
 const doc=catalog.documents.find(d=>d.route===route&&!['header','footer'].includes(d.id));
 if(!doc)return asset;
 const ids=['header','footer',doc.id];
 const rows=await env.DB.prepare('SELECT * FROM documents WHERE id IN (?,?,?)').bind(...ids).all();
 const rewriter=new HTMLRewriter();
 for(const row of rows.results) {
  const data=preview?JSON.parse(row.draft):row.published?JSON.parse(row.published):{};
  const schema=docs.get(row.id);
  for(const field of schema.fields) {
   const value=data[field.id];if(value===undefined)continue;
   if(field.type==='link') rewriter.on(`[data-cms-link="${field.id}"]`,{element(el){el.setAttribute('href',value);}});
   else rewriter.on(`[data-cms="${field.id}"]`,{element(el){
    if(field.type==='image'){el.setAttribute('src',value.src);el.setAttribute('alt',value.alt);if(value.src!==field.value.src){el.removeAttribute('srcset');el.removeAttribute('sizes');}}
    else if(field.type==='meta')el.setAttribute('content',value);
    else el.setInnerContent(value);
   }});
  }
 }
 const result=rewriter.transform(asset);const headers=new Headers(result.headers);
 headers.set('Cache-Control','no-store');headers.set('Netlify-CDN-Cache-Control','no-store');headers.set('CDN-Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
 const publication=rows.results.filter(row=>row.published).sort((a,b)=>a.id.localeCompare(b.id)).map(row=>[row.id,row.published_at,row.published]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(publication)));
 headers.set('X-CMS-Published-Version',Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('').slice(0,16));
 headers.set('X-CMS-Origin','emma-siddons-admin');
 if(preview)headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(result.body,{status:result.status,headers});
}
export default {async fetch(req,env){
 const url=new URL(req.url), p=url.pathname;
 try {
  const auth=await authRoute(req,env);if(auth)return auth;
  if(['/admin/login','/admin/login/','/admin/setup','/admin/setup/'].includes(p)) {
   const response=await env.ASSETS.fetch(new Request(new URL('/admin/login/',url),req));
   const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');headers.set('X-Robots-Tag','noindex, nofollow');return new Response(response.body,{status:response.status,headers});
  }
  if(p.startsWith('/media/')) {
   if(!['GET','HEAD'].includes(req.method))return json({error:'Method not allowed'},405);
   const item=await env.DB.prepare('SELECT type,bytes FROM media WHERE id=?').bind(p.slice(7)).first();
   return item?new Response(req.method==='HEAD'?null:new Uint8Array(item.bytes),{headers:{'Content-Type':item.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}}):json({error:'Image not found'},404);
  }
  const protectedRoute=p==='/admin'||p.startsWith('/admin/')||p.startsWith('/api/')||url.searchParams.has('preview');
  let email;
  if(protectedRoute){email=await identity(req,env);if(!email){if(p.startsWith('/api/'))return json({error:'Please sign in to continue.'},401);return Response.redirect(new URL('/admin/login/',url),302);}}
  if(p.startsWith('/api/')) {
   if(!['GET','HEAD'].includes(req.method)&&req.headers.get('Origin')!==url.origin)return json({error:'Request origin not allowed'},403);
   if(Number(req.headers.get('content-length')||0)>6*1024*1024)return json({error:'Upload is too large'},413);
   if(p==='/api/session'&&req.method==='GET')return json({email,local:env.LOCAL_DEVELOPMENT==='true'});
   if(p==='/api/pages'&&req.method==='GET') {
    const rows=await env.DB.prepare('SELECT id,revision,updated_at,published_at FROM documents').all();
    return json(catalog.documents.map(({id,title,route,fields})=>({id,title,route,fieldCount:fields.length,...rows.results.find(r=>r.id===id)})));
   }
   if(p==='/api/media'&&req.method==='GET') {
    const rows=await env.DB.prepare('SELECT id,name,type,created_at FROM media ORDER BY created_at DESC').all();
    return json([...rows.results.map(x=>({...x,src:'/media/'+x.id})),...catalog.library]);
   }
   if(p==='/api/media'&&req.method==='POST') {
    const body=await req.formData(),file=body.get('file');
    if(!file||typeof file==='string'||file.size>1024*1024||file.size<1)return json({error:'Choose an image under 1 MB.'},400);
    const bytes=await file.arrayBuffer(), b=new Uint8Array(bytes);
    const type=b[0]===255&&b[1]===216?'image/jpeg':b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?'image/png':String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'?'image/webp':null;
    if(!type)return json({error:'Only JPEG, PNG and WebP images are supported.'},400);
    const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO media VALUES(?,?,?,?,?)').bind(id,file.name.slice(0,150),type,bytes,now()).run();return json({id,name:file.name,src:'/media/'+id},201);
   }
   const match=p.match(/^\/api\/pages\/([^/]+)(?:\/(publish|discard))?$/);
   if(match) {
    const [,id,action]=match,doc=docs.get(id);if(!doc)return json({error:'Page not found'},404);
    if(req.method==='GET'&&!action)return json({document:doc,...await state(id,env)});
    if(req.method==='PUT'&&!action) {
     const data=await req.json(),values=validateValues(doc,data.values),time=now();
     if(!Number.isInteger(data.revision)||data.revision<0)return json({error:'A valid revision is required.'},400);
     let result;
     if(data.revision===0) result=await env.DB.prepare('INSERT OR IGNORE INTO documents(id,draft,revision,updated_at,updated_by) VALUES(?,?,1,?,?)').bind(id,JSON.stringify(values),time,email).run();
     else result=await env.DB.prepare('UPDATE documents SET draft=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(values),time,email,id,data.revision).run();
     if(!result.meta.changes)return json({error:'This page changed in another session. Reload before saving.'},409);
     await env.DB.prepare('INSERT INTO audit(document_id,action,actor,created_at) VALUES(?,?,?,?)').bind(id,'save',email,time).run();return json(await state(id,env));
    }
    if(req.method==='POST'&&action) {
     const data=await req.json(),time=now();
     if(!Number.isInteger(data.revision))return json({error:'A valid revision is required.'},400);
     const sql=action==='publish'?'UPDATE documents SET published=draft,published_at=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?':'UPDATE documents SET draft=COALESCE(published,?),revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?';
     const first=action==='publish'?time:JSON.stringify(defaults(doc));
     const result=await env.DB.prepare(sql).bind(first,time,email,id,data.revision).run();
     if(!result.meta.changes)return json({error:'This page changed. Save or reload before continuing.'},409);
     await env.DB.prepare('INSERT INTO audit(document_id,action,actor,created_at) VALUES(?,?,?,?)').bind(id,action,email,time).run();return json(await state(id,env));
    }
   }
   return json({error:'API route not found'},404);
  }
  if(p.startsWith('/admin/preview/')){const target=new URL(p.slice('/admin/preview'.length),url);return render(new Request(target,req),env,true);}
  if(url.searchParams.has('preview'))return render(req,env,true);
  if(p==='/admin'||p.startsWith('/admin/')) {
   const target=new URL('/admin/',url);const response=await env.ASSETS.fetch(new Request(target,req));
   const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-Frame-Options','DENY');
   return new Response(response.body,{status:response.status,headers});
  }
  return render(req,env);
 }catch(error){console.error(error);return json({error:error.message?.startsWith('Invalid')||error.message?.startsWith('Use ')||error.message==='Unknown content field.'?error.message:'Unable to complete this request. Please try again.'},400);}
}};

