import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
const out = path.resolve('dist/site');
// All public pages and admin pages are Astro output. Never copy source into hosting.
await mkdir(out, {recursive:true});
async function copy(dir, dest) {
 await mkdir(dest,{recursive:true});
 for (const e of await readdir(dir,{withFileTypes:true})) {
  if(e.name==='site') continue;
  const src=path.join(dir,e.name), target=path.join(dest,e.name);
  if(e.isDirectory()) await copy(src,target);
  else await copyFile(src,target);
 }
}
await copy(path.resolve('dist'),out);
for(const name of ['_headers','_redirects']) await copyFile(path.resolve('..',name),path.join(out,name));
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
   if(scope!=='main')return scope==='header'?'Brand & navigation':'Footer';
   const section=$(el).closest('section');if(!section.length)return 'Page content';
   const token=section.attr('id')||section.attr('class')?.split(' ')[0]?.replace(/^(nh|v2)-/,'');
   const names={home:'Hero',hero:'Hero',service:'Property search service',about:'About me',areas:'Areas covered',contact:'Contact',reviews:'Client reviews',trust:'Credentials',intro:'Introduction',benefits:'How I help',offmarket:'Off-market homes','off-market':'Off-market homes',process:'How I work',fees:'Services & fees',journal:'Journal',guide:'Guide',faq:'Frequently asked questions',testimonials:'Client reviews'};
   return names[token]||(token?.includes('review')?'Client reviews':null)||'Section '+(container.find('section').toArray().indexOf(section[0])+1);
  };
  const counts=new Map();
  const labelFor=(el,role)=>{const key=sectionName(el)+'/'+role;const n=(counts.get(key)||0)+1;counts.set(key,n);return role+' '+n;};
  const nodes=[];
  function walk(node) {
   if(['script','style','svg','noscript'].includes(node.name)) return;
   if(node.type==='text' && node.data.trim()) nodes.push(node);
   else for(const child of [...node.children||[]]) walk(child);
  }
  for(const el of container.toArray()) walk(el);
  for(const node of nodes) {
   const key=`${scope==='main'?id:scope}-text-${n++}`;
   const parent=$(node.parent);
   const role=parent.closest('.brand__name').length?'Brand name':parent.closest('.brand__strapline').length?'Brand tagline':parent.closest('nav').length?'Navigation label':parent.closest('a[href^="tel:"]').length?'Phone number':parent.closest('a[href^="mailto:"]').length?'Email address':parent.closest('a').length?'Button / link text':parent.closest('h1,h2,h3,h4,h5,h6').length?'Heading':parent.closest('.eyebrow').length?'Section label':parent.closest('p,blockquote').length?'Content':parent.closest('summary').length?'Question':'Text';
   const label=labelFor(node.parent,role);
   const section=sectionName(node.parent);
   $(node).replaceWith($('<cms-text>').attr('data-cms',key).text(node.data));
   fields.push({id:key,type:'text',label,section,value:node.data,...(/^[+]+$/.test(node.data.trim())?{hiddenFromEditor:true}:{})});
  }
  container.find('img').each((i,el)=>{
   const key=`${scope==='main'?id:scope}-image-${i}`;
   $(el).attr('data-cms',key);
   const src=$(el).attr('src');
   fields.push({id:key,type:'image',label:labelFor(el,sectionName(el)==='Hero'?'Hero image':'Section image'),section:sectionName(el),value:{src,alt:$(el).attr('alt')||''}});
   if(src?.startsWith('/')&&!library.some(x=>x.src===src)) library.push({src,name:src.split('/').pop()});
  });
  container.find('a').each((i,el)=>{
   const key=`${scope==='main'?id:scope}-link-${i}`;
   $(el).attr('data-cms-link',key);
   fields.push({id:key,type:'link',label:labelFor(el,'Button / link URL'),section:sectionName(el),value:$(el).attr('href')||'/'});
  });
  // Keep every legacy ID while presenting whole semantic text blocks.
  let groupIndex=0;
  container.find('h1,h2,h3,h4,h5,h6,p,blockquote,figcaption').each((_,el)=>{
   const block=$(el);if(block.find('a,img,svg,button,input,ul,ol,p,blockquote').length)return;
   const parts=block.find('cms-text').toArray().map(node=>$(node).attr('data-cms'));if(!parts.length)return;
   const key=`${scope==='main'?id:scope}-rich-${groupIndex++}`;
   const tag=el.name,role=/^h[1-6]$/.test(tag)?tag==='h1'?'Main heading':'Section heading':block.hasClass('eyebrow')?'Section label':tag==='blockquote'?'Review quote':tag==='figcaption'?'Image caption':sectionName(el)==='Hero'?'Introduction':'Body content';
   const rich={id:key,type:'richtext',label:labelFor(el,role),section:sectionName(el),value:null,template:block.html(),legacyIds:parts,paragraph:tag==='p'&&!block.hasClass('eyebrow')};
   for(const field of fields)if(parts.includes(field.id))field.editorGroup=key;
   block.attr('data-cms-rich',key);fields.push(rich);
  });
  // One editor per adjacent run of body paragraphs; retain prior rich fields for compatibility.
  const paragraphFields=fields.filter(f=>f.paragraph),visited=new Set();let proseIndex=0;
  for(const first of paragraphFields){
   if(visited.has(first.id))continue;
   let node=container.find(`[data-cms-rich="${first.id}"]`),blocks=[];
   while(node.length){const field=paragraphFields.find(f=>f.id===node.attr('data-cms-rich'));if(!field||visited.has(field.id))break;visited.add(field.id);blocks.push({id:field.id,attributes:Object.fromEntries(Object.entries(node[0].attribs).filter(([key])=>!key.startsWith('data-cms')))});node=node.next();}
   const key=`${scope==='main'?id:scope}-prose-${proseIndex++}`;
   const members=blocks.map(b=>fields.find(f=>f.id===b.id));
   const prose={id:key,type:'prose',label:first.section==='Hero'?'Introduction':'Content',section:first.section,value:null,blocks,legacyIds:members.flatMap(f=>f.legacyIds)};
   for(const member of members)member.editorGroup=key;
   container.find(`[data-cms-rich="${first.id}"]`).attr('data-cms-prose',key);fields.push(prose);
  }
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
console.log(`Prepared ${documents.length} pages and ${library.length} images; Astro templates compiled.`);
