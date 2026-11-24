import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const root = path.resolve('..'), out = path.resolve('dist/site');
await mkdir(out, {recursive:true});
async function copy(dir, dest) {
 await mkdir(dest,{recursive:true});
 for (const e of await readdir(dir,{withFileTypes:true})) {
  if(e.name.startsWith('.') || e.name==='cms' || e.name==='node_modules') continue;
  const src=path.join(dir,e.name), target=path.join(dest,e.name);
  if(e.isDirectory()) await copy(src,target);
  else if(/\.(html|css|js|jpg|jpeg|png|webp|svg|ico|txt)$/i.test(e.name)||['_headers','_redirects'].includes(e.name)) await copyFile(src,target);
 }
}
await copy(root,out);
await copy(path.resolve('dist/admin'),path.join(out,'admin'));
await copy(path.resolve('dist/admin-assets'),path.join(out,'admin-assets'));
const documents=[], library=[];
async function scan(dir) {
 for(const e of await readdir(dir,{withFileTypes:true})) {
  if(e.name==='admin' || e.name==='admin-assets') continue;
  const file=path.join(dir,e.name);
  if(e.isDirectory()) await scan(file);
  else if(e.name.endsWith('.html')) await instrument(file);
 }
}
const globals = {};
async function instrument(file) {
 const html=(await readFile(file,'utf8')).replace(/\/_astro\/[^\"'\s<>]+/g, value=>value.toLowerCase()), $=load(html);
 const relative=path.relative(out,file).replaceAll('\\','/');
 const route='/'+relative.replace(/index\.html$/,'');
 const id=route==='/'?'home':route.replace(/^\/|\/$/g,'').replaceAll('/','--');
 const title=$('title').text().split('|')[0].trim();
 const doc={id,title: id==='home'?'Home':id==='home-new'?'Home New':id==='v2'?'Home V2':title,route,fields:[]};
 for(const scope of ['header','main','footer']) {
  const fields=[], container=$(scope).first();
  let n=0;
  const sectionName=el=> {
   const section=$(el).closest('section');
   return scope!=='main'?scope==='header'?'Brand & navigation':'Footer':section.find('h1,h2,.eyebrow').first().text().trim().slice(0,70)||'Page content';
  };
  const nodes=[];
  function walk(node) {
   if(['script','style','svg','noscript'].includes(node.name)) return;
   if(node.type==='text' && node.data.trim()) nodes.push(node);
   else for(const child of [...node.children||[]]) walk(child);
  }
  for(const el of container.toArray()) walk(el);
  for(const node of nodes) {
   const key=`${scope==='main'?id:scope}-text-${n++}`;
   const label=node.data.trim().slice(0,75);
   const section=sectionName(node.parent);
   $(node).replaceWith($('<cms-text>').attr('data-cms',key).text(node.data));
   fields.push({id:key,type:'text',label,section,value:node.data});
  }
  container.find('img').each((i,el)=>{
   const key=`${scope==='main'?id:scope}-image-${i}`;
   $(el).attr('data-cms',key);
   const src=$(el).attr('src');
   fields.push({id:key,type:'image',label:$(el).attr('alt')||'Section image',section:sectionName(el),value:{src,alt:$(el).attr('alt')||''}});
   if(src?.startsWith('/')&&!library.some(x=>x.src===src)) library.push({src,name:src.split('/').pop()});
  });
  container.find('a').each((i,el)=>{
   const key=`${scope==='main'?id:scope}-link-${i}`;
   $(el).attr('data-cms-link',key);
   fields.push({id:key,type:'link',label:($(el).text().trim()||$(el).attr('aria-label')||'Link')+' destination',section:sectionName(el),value:$(el).attr('href')||'/'});
  });
  if(scope==='main') doc.fields.push(...fields);
  else if(!globals[scope]) globals[scope]={id:scope,title:scope==='header'?'Header & navigation':'Footer',route:'/',fields};
 }
 const titleId=`${id}-seo-title`, descriptionId=`${id}-seo-description`;
 $('title').attr('data-cms',titleId);
 $('meta[name="description"]').attr('data-cms',descriptionId);
 doc.fields.unshift({id:titleId,type:'text',label:'Page title',section:'Search appearance',value:$('title').text()},{id:descriptionId,type:'meta',label:'Search description',section:'Search appearance',value:$('meta[name="description"]').attr('content')||''});
 $('head').append('<style>cms-text{display:contents;white-space:pre-line}</style>');
 await writeFile(file,$.html()); documents.push(doc);
}
await scan(out);
const order = id => { const i=['home','home-new','v2'].indexOf(id);return i<0?100:i; };
documents.sort((a,b)=>order(a.id)-order(b.id));
await writeFile('worker/catalog.json',JSON.stringify({documents:[...Object.values(globals),...documents],library},null,2));
console.log(`Prepared ${documents.length} pages and ${library.length} images; source templates are unchanged.`);
