import {pairLinkFields} from './link-fields';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
const escapes=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanups=new Set<()=>void>();
export function destroyRepeaters(){for(const cleanup of cleanups)cleanup();cleanups.clear();}
function content(field:any,item:any,values:Record<string,any>):string{
 const saved=values[field.id];
 if(saved!==undefined&&saved!==null)return field.type==='prose'?saved:String(saved).replace(/<br\s*\/?>/gi,' ');
 if(field.type==='prose')return field.blocks.map(block=>'<p>'+content(item.allFields.find(f=>f.id===block.id),item,values)+'</p>').join('');
 const node=document.createElement('div');node.innerHTML=field.template||'';
 node.querySelectorAll('cms-text').forEach(el=>{el.textContent=values[el.getAttribute('data-cms')]??el.textContent;el.replaceWith(...el.childNodes);});
 return node.innerHTML.replace(/<br\s*\/?>/gi,' ');
}
function plain(html:string){const node=document.createElement('div');node.innerHTML=html;return node.textContent||'';}
export function mountRepeater(root:HTMLElement,field:any,values:Record<string,any>,changed:()=>void,chooseImage:(callback:(image:any)=>void)=>void){
 const rows=values[field.id]!=null?structuredClone(values[field.id]):field.items.map((item,index)=>({templateIndex:index,iconIndex:index,values:Object.fromEntries(item.allFields.map(f=>[f.id,values[f.id]??f.value]))}));
 let editors:Editor[]=[];
 const cleanup=()=>{editors.forEach(editor=>editor.destroy());editors=[];};cleanups.add(cleanup);
 const persist=()=>{values[field.id]=rows;changed();};
 const title=(row:any)=>{const item=field.items[row.templateIndex],f=item.fields.find(f=>['Title','Question'].includes(f.label));if(!f)return 'Entry';return f.type==='richtext'?plain(content(f,item,row.values)):row.values[f.id]??f.value;};
 const draw=(openIndex=0)=>{
  cleanup();root.innerHTML=`<div class="repeater-heading"><div><h3>${escapes(field.label)}</h3><p>${rows.length} entries · Numbers follow the entry order automatically.</p></div><button class="button outline" type="button" data-add>Add entry</button></div><div class="repeater-entries">${rows.map((row,index)=>{
   const item=field.items[row.templateIndex];
   return `<details class="repeater-entry" ${index===openIndex?'open':''}><summary><span class="repeater-number">${index+1}</span><span>${escapes(title(row))}</span></summary><div class="repeater-body"><div class="repeater-actions"><button type="button" data-move="${index}" data-direction="-1" ${index===0?'disabled':''}>Move up</button><button type="button" data-move="${index}" data-direction="1" ${index===rows.length-1?'disabled':''}>Move down</button><button type="button" data-remove="${index}">Remove entry</button></div>${item.icon?`<label>Icon<select data-icon="${index}">${field.items.map((_,i)=>`<option value="${i}" ${i===(row.iconIndex??row.templateIndex)?'selected':''}>Icon ${i+1}</option>`).join('')}</select></label>`:''}${pairLinkFields<any>(item.fields).map((f,j)=>{
    const domId=`${field.id}-row-${index}-field-${j}`,v=row.values[f.id]??f.value;
    if(f.type==='link'&&f.linkTextIds?.length){const text=f.linkTextIds.map(key=>row.values[key]??item.allFields.find(f=>f.id===key)?.value??'').join(' ').replace(/\s+/g,' ').trim();return `<div class="field link-fields"><label for="${domId}-text">Button Text</label><input id="${domId}-text" data-row="${index}" data-key="${f.linkTextIds[0]}" data-link-parts="${escapes(JSON.stringify(f.linkTextIds))}" value="${escapes(text)}"><label for="${domId}">Button URL</label><input id="${domId}" data-row="${index}" data-key="${f.id}" value="${escapes(v)}"></div>`;}
    if(f.type==='image')return `<div class="field"><label for="${domId}">${escapes(f.label)}</label><img class="repeater-image" src="${escapes(v.src)}" alt="${escapes(v.alt)}"><button type="button" class="button outline" data-image="${index}" data-key="${escapes(f.id)}">Choose image</button><label for="${domId}">Image URL</label><input id="${domId}" data-row="${index}" data-key="${escapes(f.id)}" data-image-part="src" value="${escapes(v.src)}"><label for="${domId}-alt">Alternative text</label><input id="${domId}-alt" data-row="${index}" data-key="${escapes(f.id)}" data-image-part="alt" value="${escapes(v.alt)}"></div>`;
    if(f.type==='prose'||(f.type==='richtext'&&f.label!=='Title'))return `<div class="field"><label id="${domId}-label">${escapes(f.label)}</label><div class="rich-toolbar" role="group" aria-label="${escapes(f.label)} formatting">${[['bold','Bold','B'],['italic','Italic','I'],['underline','Underline','U'],['link','Add link','Link'],['unlink','Remove link','Unlink'],['undo','Undo','Undo'],['redo','Redo','Redo']].map(([cmd,label,text])=>`<button type="button" data-editor="${domId}" data-command="${cmd}" aria-label="${label}">${text}</button>`).join('')}</div><div class="rich-editor" id="${domId}" data-rich-row="${index}" data-rich-key="${escapes(f.id)}"></div></div>`;
    const text=f.type==='richtext'?plain(content(f,item,row.values)):v;
    return `<div class="field"><label for="${domId}">${escapes(f.label)}</label><input id="${domId}" data-row="${index}" data-key="${escapes(f.id)}" ${f.type==='richtext'?'data-plain-rich="true"':''} value="${escapes(text)}"></div>`;
   }).join('')}</div></details>`;
  }).join('')}</div>${rows.length===0?'<p class="repeater-empty">No entries. Add an entry to get started.</p>':''}`;
  const add=root.querySelector<HTMLButtonElement>('[data-add]');add.disabled=rows.length>=30;add.onclick=()=>{
   const item=field.items[0],data=Object.fromEntries(item.allFields.map(f=>[f.id,f.type==='image'?structuredClone(f.value):f.type==='link'?f.value:f.type==='text'?'':null]));
   for(const f of item.fields)if(f.type==='prose')data[f.id]='<p></p>';else if(f.type==='richtext')data[f.id]=f.label==='Title'?'New entry':'';else if(f.type==='text')data[f.id]=['Title','Question'].includes(f.label)?'New entry':'';
   rows.push({templateIndex:0,iconIndex:0,values:data});persist();draw(rows.length-1);
  };
  root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.remove);rows.splice(index,1);persist();draw(Math.max(0,index-1));});
  root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>button.onclick=()=>{const from=Number(button.dataset.move),to=from+Number(button.dataset.direction);[rows[from],rows[to]]=[rows[to],rows[from]];persist();draw(to);});
  root.querySelectorAll<HTMLInputElement>('input[data-row]').forEach(input=>input.oninput=()=>{const row=rows[Number(input.dataset.row)],key=input.dataset.key;if(input.dataset.linkParts)JSON.parse(input.dataset.linkParts).forEach((id,i)=>row.values[id]=i===0?input.value:'');else if(input.dataset.imagePart)row.values[key]={...row.values[key],[input.dataset.imagePart]:input.value};else row.values[key]=input.dataset.plainRich?escapes(input.value):input.value;persist();const summary=input.closest('details').querySelector('summary>span:last-child');summary.textContent=title(row);});
  root.querySelectorAll('[data-icon]').forEach(node=>{const select=node as unknown as HTMLSelectElement;select.onchange=()=>{rows[Number(select.dataset.icon)].iconIndex=Number(select.value);persist();};});
  root.querySelectorAll<HTMLButtonElement>('[data-image]').forEach(button=>button.onclick=()=>chooseImage(image=>{const index=Number(button.dataset.image),row=rows[index],key=button.dataset.key;row.values[key]={...row.values[key],src:image.src};persist();draw(index);}));
  root.querySelectorAll<HTMLElement>('[data-rich-row]').forEach(element=>{
   const index=Number(element.dataset.richRow),row=rows[index],item=field.items[row.templateIndex],f=item.fields.find(f=>f.id===element.dataset.richKey);
   const editor=new Editor({element,extensions:[StarterKit.configure({hardBreak:false,heading:false,bulletList:false,orderedList:false,listItem:false,listKeymap:false,blockquote:false,codeBlock:false,code:false,horizontalRule:false,link:{openOnClick:false,autolink:false}})],content:content(f,item,row.values),editorProps:{attributes:{role:'textbox','aria-multiline':'true','aria-labelledby':element.id+'-label'}},onUpdate:({editor})=>{row.values[f.id]=f.type==='prose'?editor.getHTML():editor.getHTML().replace(/<\/p>\s*<p>/g,' ').replace(/^<p>|<\/p>$/g,'');persist();}});
   editors.push(editor);
   root.querySelectorAll<HTMLButtonElement>(`[data-editor="${element.id}"]`).forEach(button=>button.onclick=()=>{const chain=editor.chain().focus(),cmd=button.dataset.command;if(cmd==='bold')chain.toggleBold().run();if(cmd==='italic')chain.toggleItalic().run();if(cmd==='underline')chain.toggleUnderline().run();if(cmd==='unlink')chain.unsetLink().run();if(cmd==='undo')chain.undo().run();if(cmd==='redo')chain.redo().run();if(cmd==='link'){const url=window.prompt('Link URL',editor.getAttributes('link').href||'https://');if(url===null)return;if(!url.trim())chain.unsetLink().run();else if(/^(https:\/\/|\/(?!\/)|mailto:|tel:|#)/.test(url.trim()))chain.setLink({href:url.trim()}).run();}});
  });
 };
 draw();
}
