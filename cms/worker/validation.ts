import sanitizeHtml from 'sanitize-html';
export interface ImageValue { src:string; alt:string; }
export interface ContentField { id:string; type:string; value:string|ImageValue|null; }
export interface ContentDocument { fields:ContentField[]; }
export function safeURL(value, image=false) {
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\\]/.test(value)) return false;
 if(value.startsWith('/')&&!value.startsWith('//')) return true;
 if(!image && (value.startsWith('#')||/^mailto:[^<>]+$/.test(value)||/^tel:[+\d()-]+$/.test(value))) return true;
 try{return new URL(value).protocol==='https:';}catch{return false;}
}
export function validateValues(doc:ContentDocument, values:Record<string,any>) {
 if(!values||typeof values!=='object'||Array.isArray(values)) throw new Error('Content must be an object.');
 const allowed=new Map(doc.fields.map(f=>[f.id,f]));
 for(const [key,value] of Object.entries(values)) {
  const f=allowed.get(key); if(!f) throw new Error('Unknown content field.');
  if(f.type==='richtext'){if(value!==null&&(typeof value!=='string'||value.length>40000))throw new Error('Invalid rich text.');if(typeof value==='string')values[key]=sanitizeRichText(value);continue;}
  if(f.type==='image') {
   if(!value||!safeURL(value.src,true)||typeof value.alt!=='string'||value.alt.length>1000) throw new Error('Use a valid image URL and alternative text.');
  } else if(typeof value!=='string'||value.length>20000 || (f.type==='link'&&!safeURL(value))) throw new Error('Invalid field value.');
 }
 return values;
}
export function defaults(doc:ContentDocument){return Object.fromEntries(doc.fields.map(f=>[f.id,f.value]));}

/** Only inline editorial formatting is allowed inside existing page blocks. */
export function sanitizeRichText(value:string):string {
 return sanitizeHtml(value,{allowedTags:['strong','b','em','i','u','s','br','a'],allowedAttributes:{a:['href','title']},allowedSchemes:['https','mailto','tel'],allowProtocolRelative:false,transformTags:{a:(_tag,attrs)=>({tagName:'a',attribs:safeURL(attrs.href)?{href:attrs.href,...(attrs.title?{title:attrs.title}:{})}:{}})}});
}
