import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import catalog from '../worker/catalog.json' with {type:'json'};
import {validateRepeater} from '../worker/validation.ts';
const origin='http://localhost:8787';
async function call(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.ok,true,await r.clone().text());return r.json();}
function seed(field,values){return field.items.map((item,index)=>({templateIndex:index,iconIndex:index,values:Object.fromEntries(item.allFields.map(f=>[f.id,values[f.id]??f.value]))}));}
test('Repeated steps, benefits, areas and FAQs have grouped fields without number inputs',()=>{
 for(const id of ['home-new','v2','how-i-can-help-you'])assert.ok(catalog.documents.find(d=>d.id===id).fields.some(f=>f.type==='repeater'));
 const types=new Set(catalog.documents.flatMap(d=>d.fields.filter(f=>f.type==='repeater').map(f=>f.label)));
 for(const kind of ['Steps','Benefits','Areas','FAQs'])assert.ok(types.has(kind));
 for(const d of catalog.documents)for(const f of d.fields.filter(f=>f.type==='repeater'))for(const item of f.items)assert.ok(item.fields.every(f=>!f.autoNumber&&!f.hiddenFromEditor));
 const field=catalog.documents.find(d=>d.id==='home-new').fields.find(f=>f.type==='repeater');
 assert.throws(()=>validateRepeater(field,[{templateIndex:999,values:{}}]));
 assert.throws(()=>validateRepeater(field,[{templateIndex:0,values:{unknown:'bad'}}]));
 assert.throws(()=>validateRepeater(field,Array(31).fill({templateIndex:0,values:{}})));
});
test('Repeater add/remove/reorder renumbers output, preserves icons and keeps drafts private',async()=>{
 const initial=await call('/api/pages/home-new'),original=structuredClone(initial.values),field=initial.document.fields.find(f=>f.type==='repeater'&&f.label==='Steps');
 const rows=seed(field,original),before=load(await (await fetch(origin+'/')).text());
 const title=field.items[0].fields.find(f=>f.label==='Title');
 const added=structuredClone(rows[0]);added.values[title.id]='Repeater verification extra';
 rows.reverse();rows.splice(1,1);rows.push(added);
 try{
  const saved=await call('/api/pages/home-new','PUT',{revision:initial.revision,values:{...original,[field.id]:rows}});
  assert.equal((await (await fetch(origin+'/')).text()).includes('Repeater verification extra'),false);
  const preview=load(await (await fetch(origin+'/admin/preview/')).text());
  assert.equal(preview('.nh-journey>li').length,5);assert.equal(preview('.nh-journey>li').last().find('h3').text(),'Repeater verification extra');
  assert.equal(preview('.nh-journey>li').first().find('h3').text(),before('.nh-journey>li').last().find('h3').text());
  assert.deepEqual(preview('.nh-journey [data-cms-auto-number]').toArray().map(el=>preview(el).text()),['01','02','03','04','05']);
  assert.equal(preview('.nh-journey svg').length,before('.nh-journey svg').length);assert.equal(preview('html html').length,0);
  await call('/api/pages/home-new/publish','POST',{revision:saved.revision});
  assert.ok((await (await fetch(origin+'/')).text()).includes('Repeater verification extra'));
  const current=await call('/api/pages/home-new');const empty=await call('/api/pages/home-new','PUT',{revision:current.revision,values:{...original,[field.id]:[]}});await call('/api/pages/home-new/publish','POST',{revision:empty.revision});
  assert.equal(load(await (await fetch(origin+'/')).text())('.nh-journey>li').length,0);
 }finally{const state=await call('/api/pages/home-new');const saved=await call('/api/pages/home-new','PUT',{revision:state.revision,values:original});await call('/api/pages/home-new/publish','POST',{revision:saved.revision});}
});
