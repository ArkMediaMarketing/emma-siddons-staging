/** Pair a link's label and destination without changing their stored CMS IDs. */
export function pairLinkFields<T extends {id:string;type:string;label:string;linkTextIds?:string[];legacyIds?:string[]}>(fields:T[]):T[]{
 const paired=new Set<string>();
 const result=fields.map(field=>{
  if(field.type!=='link')return field;
  const parts=(field.linkTextIds||[]).filter(id=>fields.some(f=>f.id===id&&f.type==='text'&&!/^Brand (name|tagline)/.test(f.label)));
  parts.forEach(id=>paired.add(id));
  return {...field,linkTextIds:parts,...(parts.length?{legacyIds:parts}:{})};
 });
 return result.filter(f=>!paired.has(f.id)).sort((a,b)=>fields.findIndex(f=>f.id===(a.legacyIds?.[0]||a.id))-fields.findIndex(f=>f.id===(b.legacyIds?.[0]||b.id)));
}
