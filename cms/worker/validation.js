export function safeURL(value, image=false) {
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\\]/.test(value)) return false;
 if(value.startsWith('/')&&!value.startsWith('//')) return true;
 if(!image && (value.startsWith('#')||/^mailto:[^<>]+$/.test(value)||/^tel:[+\d()-]+$/.test(value))) return true;
 try{return new URL(value).protocol==='https:';}catch{return false;}
}
export function validateValues(doc, values) {
 if(!values||typeof values!=='object'||Array.isArray(values)) throw new Error('Content must be an object.');
 const allowed=new Map(doc.fields.map(f=>[f.id,f]));
 for(const [key,value] of Object.entries(values)) {
  const f=allowed.get(key); if(!f) throw new Error('Unknown content field.');
  if(f.type==='image') {
   if(!value||!safeURL(value.src,true)||typeof value.alt!=='string'||value.alt.length>1000) throw new Error('Use a valid image URL and alternative text.');
  } else if(typeof value!=='string'||value.length>20000 || (f.type==='link'&&!safeURL(value))) throw new Error('Invalid field value.');
 }
 return values;
}
export function defaults(doc){return Object.fromEntries(doc.fields.map(f=>[f.id,f.value]));}
