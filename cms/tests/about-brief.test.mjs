import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
const origin='http://localhost:8787';
async function call(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,await r.clone().text());return r.json();}
test('About concept renders without prototype chrome and supports CMS draft/publish',async()=>{
 const initial=await call('/api/pages/about-me'),original=structuredClone(initial.values);
 const field=initial.document.fields.find(f=>f.type==='richtext'&&f.section==='Profile'&&f.label.endsWith('heading'));
 assert.ok(field);
 const $=load(await(await fetch(origin+'/about-me/')).text());
 assert.equal($('main h1').length,1);assert.equal($('.about-brief .review').length,5);assert.equal($('.concept-bar,[data-retired]').length,0);
 assert.equal($('.about-brief .facts__list>li').length,4);
 assert.equal($('header.site-chrome').length,1);assert.equal($('footer.site-chrome').length,1);
 try{
  const saved=await call('/api/pages/about-me','PUT',{revision:initial.revision,values:{...original,[field.id]:'About draft verification'}});
  assert.ok(!(await(await fetch(origin+'/about-me/')).text()).includes('About draft verification'));
  assert.ok((await(await fetch(origin+'/admin/preview/about-me/')).text()).includes('About draft verification'));
  await call('/api/pages/about-me/publish','POST',{revision:saved.revision});
  assert.ok((await(await fetch(origin+'/about-me/')).text()).includes('About draft verification'));
 }finally{
  const state=await call('/api/pages/about-me');const restored=await call('/api/pages/about-me','PUT',{revision:state.revision,values:original});await call('/api/pages/about-me/publish','POST',{revision:restored.revision});
 }
});
