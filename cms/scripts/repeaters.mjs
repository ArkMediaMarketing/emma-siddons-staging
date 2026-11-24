/** Discover semantic repeated content, never arbitrary two-column layout containers. */
export function instrumentRepeaters({$,container,fields,id,sectionName}){
 const candidates=new Set(container.find('ol,ul,.nh-benefits').toArray());
 container.find('details').each((_,el)=>{const parent=$(el).parent();if(parent.children('details').length>1&&parent.children().length===parent.children('details').length)candidates.add(parent[0]);});
 let index=0;
 for(const parent of candidates){
  const group=$(parent),children=group.children().toArray();
  if(children.length<2||!children.every(el=>el.name===children[0].name)||!['li','article','details'].includes(children[0].name))continue;
  const key=`${id}-repeater-${index++}`,items=[],childIds=new Set();
  const kind=children[0].name==='details'?'FAQs':parent.name==='ol'?'Steps':group.hasClass('nh-benefits')?'Benefits':'Areas';
  children.forEach((el,itemIndex)=>{
   const item=$(el),numberKeys=new Set();
   item.find('cms-text[data-cms]').each((_,node)=>{const value=$(node).text().trim();if(/^\d{1,2}$/.test(value)&&Number(value)===itemIndex+1){$(node).attr('data-cms-auto-number',String(value.length));numberKeys.add($(node).attr('data-cms'));}});
   const ids=new Set();
   item.find('[data-cms],[data-cms-link],[data-cms-rich],[data-cms-prose]').addBack().each((_,node)=>{for(const attr of ['data-cms','data-cms-link','data-cms-rich','data-cms-prose'])if($(node).attr(attr))ids.add($(node).attr(attr));});
   for(const f of fields)if(numberKeys.has(f.id)||(f.legacyIds?.length&&f.legacyIds.every(k=>numberKeys.has(k)))){f.autoNumber=true;f.hiddenFromEditor=true;}
   const allFields=fields.filter(f=>ids.has(f.id));allFields.forEach(f=>childIds.add(f.id));
   const visible=allFields.filter(f=>!f.editorGroup&&!f.hiddenFromEditor&&!f.autoNumber);
   let plainIndex=0;
   const editable=visible.map(f=>({...structuredClone(f),label:f.type==='image'?'Image':f.type==='link'?'Link URL':f.type==='prose'?(kind==='FAQs'?'Answer':'Description'):f.label.includes('heading')?'Title':f.label.startsWith('Question')?'Question':f.label.includes('link text')?'Link text':f.type==='text'?(++plainIndex===1?'Title':'Description'):f.label}));
   const icon=item.find('svg').first();let iconHTML=null;
   if(kind==='Steps'&&icon.length){icon.attr('data-cms-repeat-icon','');iconHTML=$.html(icon);}
   items.push({template:$.html(item),fields:editable,allFields:structuredClone(allFields),icon:iconHTML});
  });
  group.attr('data-cms-repeat',key);
  for(const f of fields)if(childIds.has(f.id))f.editorGroup=key;
  fields.push({id:key,type:'repeater',label:kind,section:sectionName(parent),value:null,items,childIds:[...childIds],legacyIds:items.flatMap(item=>item.allFields.filter(f=>f.type==='text').map(f=>f.id))});
 }
}
