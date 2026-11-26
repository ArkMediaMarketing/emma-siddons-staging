import {nameEditorSections} from './editor-labels.mjs';
import {instrumentRepeaters} from './repeaters.mjs';
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
 const id=route==='/'?'home-new':route.replace(/^\/|\/$/g,'').replaceAll('/','--');
 const title=$('title').text().split('|')[0].trim();
 const doc={id,title: id==='home-new'?'Home':id==='v2'?'Home V2':title,route,fields:[]};
 for(const scope of ['header','main','footer']) {
  const fields=[], container=$(scope).first();
  if(scope==='main')nameEditorSections($,container,id);
  let n=0;
  const sectionName=el=> {
   if(scope!=='main')return scope==='header'?'Brand & navigation':'Footer';
   const named=$(el).closest('[data-editor-section]').attr('data-editor-section');if(named)return named;
   const section=$(el).closest('section');if(!section.length)return 'Page content';
   const classes=(section.attr('class')||'').split(' ');
   const specific=classes.filter(name=>/^(nh|classic|v2)-/.test(name)&&!/(container|section)$/.test(name)).pop();
   const token=section.attr('id')||(specific||classes[0])?.replace(/^(nh|classic|v2)-/,'');
   if(section.find('ol.numbered-list').length)return 'How I work';
   const names={home:'Hero',hero:'Hero',support:'How I help',introduction:'About me',places:'Areas covered',questions:'Frequently asked questions',proof:'Credentials',reading:'Reading guide',service:'Property search service',about:'About me',areas:'Areas covered',contact:'Contact',reviews:'Client reviews',trust:'Credentials',intro:'Introduction',benefits:'How I help',offmarket:'Off-market homes','off-market':'Off-market homes',process:'How I work',fees:'Services & fees',journal:'Journal',guide:'Guide',faq:'Frequently asked questions',testimonials:'Client reviews'};
   return names[token]||(token?.includes('review')?'Client reviews':null)||'Section '+(container.find('section').toArray().indexOf(section[0])+1);
  };
  const labelFor=(el,role)=>{
   const context=sectionName(el);
   if($(el).closest('.copyright').length)return 'Copyright text';
   if(/heading/i.test(role))return context+' heading';
   if(role==='Section label')return context+' label';
   if(/image/i.test(role))return $(el).attr('src')?.includes('map')?'Coverage map':context+' image';
   if(['Body content','Content','Introduction'].includes(role))return context+' content';
   if(role==='Text')return context+' supporting text';
   if(role==='Button / link text')return 'Button Text';
   if(role==='Button / link URL')return 'Button URL';
   if(role==='Question')return context+' question';
   return role;
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
   const linkTextIds=$(el).find('cms-text[data-cms]').toArray().map(node=>$(node).attr('data-cms')).filter(key=>{const field=fields.find(f=>f.id===key);if(field&&/^[↗→↓+★]+$/.test(field.value.trim())){field.hiddenFromEditor=true;return false;}return field&&field.type==='text';});
   fields.push({id:key,type:'link',linkTextIds,label:labelFor(el,'Button / link URL'),section:sectionName(el),value:$(el).attr('href')||'/'});
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
   const prose={id:key,type:'prose',label:first.label==='Copyright text'?'Copyright text':first.section+' content',section:first.section,value:null,blocks,legacyIds:members.flatMap(f=>f.legacyIds)};
   for(const member of members)member.editorGroup=key;
   container.find(`[data-cms-rich="${first.id}"]`).attr('data-cms-prose',key);fields.push(prose);
  }
  if(scope==='main') {
   instrumentRepeaters({$,container,fields,id,sectionName});
   // Match the two visual sections while retaining descriptive column labels.
   if(id==='off-market-homes-hertfordshire')for(const field of fields){
    if(['Off-market buying','Finding private opportunities'].includes(field.section))field.section='Understanding off-market homes';
   }
   if(id==='services-and-fees')for(const field of fields){
    if(['Property search service','Personal attention'].includes(field.section))field.section='Property search service';
    if(['Fee overview','Fee breakdown','Initial retainer','Success fee & payment terms'].includes(field.section))field.section='Fees & payment';
   }
   // New review fields are appended in source to retain all existing content IDs.
   if(id==='home-new'){
    // Append the new image in source, then relocate it to preserve existing image IDs.
    const introductionPhoto=container.find('[data-home-new-introduction-photo]');
    const introductionImageField=fields.find(field=>field.id===introductionPhoto.attr('data-cms'));
    if(introductionImageField){introductionImageField.section='About me';introductionImageField.label='About me image';}
    introductionPhoto.insertAfter(container.find('.nh-introduction__heading'));
    const reviews=container.find('[data-home-new-reviews]');
    reviews.find('[data-review-label]').prependTo(reviews.find('.nh-reviews__summary'));
    reviews.insertBefore(container.find('.nh-assurance[data-retired]'));
    const controlIds=new Set(reviews.find('[data-review-controls] cms-text').toArray().map(el=>$(el).attr('data-cms')));
    for(const field of fields)if(controlIds.has(field.id))field.hiddenFromEditor=true;
   }
   // Retire rendered elements after assigning IDs so saved CMS content stays aligned.
   if(['services-and-fees','home-new','about-me','how-i-can-help-you'].includes(id)){
    const retired=container.find('[data-retired]'),keys=new Set();
    retired.find('*').addBack().each((_,el)=>{for(const [attr,value]of Object.entries(el.attribs||{}))if(attr.startsWith('data-cms'))keys.add(value);});
    for(const field of fields)if(keys.has(field.id)||field.legacyIds?.some(key=>keys.has(key)))field.hiddenFromEditor=true;
    retired.remove();
   }
   doc.fields.push(...fields);
  }
  else if(!globals[scope]) globals[scope]={id:scope,title:scope==='header'?'Header & navigation':'Footer',route:'/',fields};
 }
 // Place the new credit after instrumentation to retain existing footer field IDs.
 $('footer .footer-copyright').append($('footer .footer-credit'));
 const titleId=`${id}-seo-title`, descriptionId=`${id}-seo-description`;
 $('title').attr('data-cms',titleId);
 $('meta[name="description"]').attr('data-cms',descriptionId);
 doc.fields.unshift({id:titleId,type:'text',label:'Page title',section:'Search appearance',value:$('title').text()},{id:descriptionId,type:'meta',label:'Search description',section:'Search appearance',value:$('meta[name="description"]').attr('content')||''});
 $('head').append('<style>cms-text{display:contents;white-space:pre-line}@media(min-width:1100px){.steps[data-cms-repeat]{grid-template-columns:repeat(var(--cms-repeater-count,5),minmax(0,1fr))}}</style>');
 await writeFile(file,$.html()); documents.push(doc);
}
await scan(out);
const order = id => { const i=['home','home-new','v2'].indexOf(id);return i<0?100:i; };
documents.sort((a,b)=>order(a.id)-order(b.id));
await writeFile('worker/catalog.json',JSON.stringify({documents:[...Object.values(globals),...documents],library},null,2));
console.log(`Prepared ${documents.length} pages and ${library.length} images; Astro templates compiled.`);
