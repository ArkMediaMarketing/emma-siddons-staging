import {sanitizeRichText,proseParagraphs,paragraphHTML,validateRepeater} from './validation.ts';

/** Apply typed content overrides, including nested item fields, without changing untouched markup. */
export async function applyContent(rewriter:HTMLRewriter,fields:any[],data:Record<string,any>){
 const activeRepeaters=fields.filter(f=>f.type==='repeater'&&data[f.id]!==undefined&&data[f.id]!==null);
 const proseFields=fields.filter(f=>f.type==='prose'&&data[f.id]!==undefined&&data[f.id]!==null);
 const covered=new Set([...activeRepeaters.flatMap(f=>f.childIds),...proseFields.flatMap(f=>f.blocks.map(b=>b.id))]);
 for(const field of fields){
  if(covered.has(field.id)||field.autoNumber)continue;
  const value=data[field.id];
  if(field.type==='repeater'){
   if(value!==undefined&&value!==null){
    const rows=validateRepeater(field,value);
    const html=(await Promise.all(rows.map(async(row,index)=>{
     const item=field.items[row.templateIndex],inner=new HTMLRewriter();
     await applyContent(inner,item.allFields,row.values);
     inner.on('[data-cms-auto-number]',{element(el){el.setInnerContent(String(index+1).padStart(Number(el.getAttribute('data-cms-auto-number'))||1,'0'));}});
     const icon=field.items[row.iconIndex]?.icon;
     if(icon)inner.on('[data-cms-repeat-icon]',{element(el){el.replace(icon,{html:true});}});
     return inner.transform(new Response(item.template,{headers:{'Content-Type':'text/html','X-CMS-Fragment':'1'}})).text();
    }))).join('');
    rewriter.on(`[data-cms-repeat="${field.id}"]`,{element(el){el.setInnerContent(html,{html:true});el.setAttribute('style',(el.getAttribute('style')||'')+`;--cms-repeater-count:${Math.max(1,Math.min(rows.length,5))}`);}});
   }
   continue;
  }
  if(field.type==='prose'){
   if(value!==undefined&&value!==null){
    const blocks=field.blocks;
    const html=proseParagraphs(value).map((content,index)=>{const attributes={...blocks[Math.min(index,blocks.length-1)].attributes};if(index>=blocks.length)delete attributes.id;return paragraphHTML(content,attributes);}).join('');
    rewriter.on(`[data-cms-prose="${field.id}"]`,{element(el){el.replace(html,{html:true});}});
    for(const block of blocks.slice(1))rewriter.on(`[data-cms-rich="${block.id}"]`,{element(el){el.remove();}});
   }
   continue;
  }
  if(value===undefined)continue;
  if(field.type==='richtext'){if(value!==null)rewriter.on(`[data-cms-rich="${field.id}"]`,{element(el){el.setInnerContent(sanitizeRichText(value),{html:true});}});continue;}
  if(field.type==='link')rewriter.on(`[data-cms-link="${field.id}"]`,{element(el){el.setAttribute('href',value);}});
  else rewriter.on(`[data-cms="${field.id}"]`,{element(el){
   if(field.type==='image'){el.setAttribute('src',value.src);el.setAttribute('alt',value.alt);if(value.src!==field.value.src){el.removeAttribute('srcset');el.removeAttribute('sizes');}}
   else if(field.type==='meta')el.setAttribute('content',value);
   else el.setInnerContent(value);
  }});
 }
}
