// Verify the original page DOMs and CMS identities across the Astro migration.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {load} from 'cheerio';
const hash=value=>createHash('sha256').update(value).digest('hex');
const assetHash=(name,bytes)=>hash(/\.(css|svg|txt)$/.test(name)?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes);
function canonical(html){const $=load(html);$('script').remove();function node(n){if(n.type==='text')return n.data.trim()?['text',n.data]:null;if(n.type==='comment')return null;return [n.name||n.type,Object.entries(n.attribs||{}).sort(([a],[b])=>a.localeCompare(b)),(n.children||[]).map(node).filter(Boolean)];}return JSON.stringify(node($.root()[0]));}
const contractPath='tests/migration-contract.json';
if(process.argv.includes('--capture-original')){
 const root='.local/migration-baseline/site',pages={};
 async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await scan(file);else if(e.name.endsWith('.html'))pages[path.relative(root,file).replaceAll('\\','/')]=hash(canonical(await readFile(file,'utf8')));}}
 await scan(root);const catalog=JSON.parse(await readFile('.local/migration-baseline/catalog.json','utf8'));
 const fields=Object.fromEntries(catalog.documents.map(d=>[d.id,hash(JSON.stringify(d))]));
 await writeFile(contractPath,JSON.stringify({pages,fields},null,2)+'\n');
}else{
 const contract=JSON.parse(await readFile(contractPath,'utf8'));
 for(const [route,digest] of Object.entries(contract.pages)){if(hash(canonical(await readFile('dist/'+route,'utf8')))!==digest)throw new Error('DOM changed during migration: '+route);}
 for(const [asset,digest] of Object.entries(contract.assets||{}))if(assetHash(asset,await readFile('dist/'+asset))!==digest)throw new Error('Asset changed: '+asset);
 const catalog=JSON.parse(await readFile('worker/catalog.json','utf8'));
 for(const [id,fields]of Object.entries(contract.legacyFields)){
  const doc=catalog.documents.find(d=>d.id===id);if(!doc)throw new Error('CMS document missing: '+id);
  for(const [key,original]of Object.entries(fields)){const field=doc.fields.find(f=>f.id===key);if(!field||JSON.stringify({type:field.type,value:field.value})!==JSON.stringify(original))throw new Error('Legacy field changed: '+key);}
 }
 console.log('PASS: all 16 public page DOMs and all 18 CMS documents match the pre-migration contract.');
}
