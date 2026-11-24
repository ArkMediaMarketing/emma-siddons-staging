import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
const origin=process.argv[2]||'http://localhost:8000';
const catalog=JSON.parse(await readFile('worker/catalog.json','utf8'));
const targets=new Set();
for(const doc of catalog.documents.filter(d=>!['header','footer'].includes(d.id))){
 const response=await fetch(origin+doc.route);
 if(response.status!==200)throw new Error(`${doc.route}: ${response.status}`);
 const $=load(await response.text());
 $('a[href],link[href],img[src],script[src],source[srcset],img[srcset]').each((_,el)=>{
  const values=el.attribs.srcset?el.attribs.srcset.split(',').map(v=>v.trim().split(/\s+/)[0]):[el.attribs.href||el.attribs.src];
  for(const value of values){if(!value||value.startsWith('#'))continue;const url=new URL(value,origin+doc.route);if(url.origin===origin)targets.add(url.pathname);}
 });
}
for(const route of targets){const response=await fetch(origin+route);if(response.status!==200)throw new Error(`${route}: ${response.status}`);}
for(const route of ['/blog/','/post/','/blog/categories/property','/post/it-s-a-minefield/']){const r=await fetch(origin+route);if(r.status!==410)throw new Error('Retired route still available: '+route);}
const denied=await fetch(origin+'/api/pages');
if(!origin.includes('localhost')&&denied.status!==401)throw new Error('Production admin API was not protected.');
console.log(`PASS: ${catalog.documents.filter(d=>!['header','footer'].includes(d.id)).length} pages and ${targets.size} linked internal routes/assets on ${origin}`);
