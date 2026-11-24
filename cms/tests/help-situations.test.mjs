import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
const origin='http://localhost:8787';
async function call(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,await r.clone().text());return r.json();}
test('Help situations keeps accessible panels and supports CMS draft/publish',async()=>{
 const initial=await call('/api/pages/how-i-can-help-you'),original=structuredClone(initial.values);
 const field=initial.document.fields.find(f=>f.type==='richtext'&&f.section==='Search introduction'&&f.label.endsWith('heading'));
 assert.ok(field);
 const $=load(await(await fetch(origin+'/how-i-can-help-you/')).text());
 assert.equal($('main h1').length,1);assert.equal($('.concept-bar,[data-retired]').length,0);
 assert.equal($('.help-situations [role="tab"]').length,10);
 assert.equal($('.help-situations [role="tabpanel"]').length,10);
 assert.equal($('.help-situations [role="tabpanel"]:not([hidden])').length,2);
 for(const tab of $('.help-situations [role="tab"]').toArray()){
  const panel=$('#'+$(tab).attr('aria-controls'));
  assert.equal(panel.length,1);assert.equal(panel.attr('aria-labelledby'),$(tab).attr('id'));
 }
 assert.ok(!$('.help-situations').text().includes('50%'));
 assert.equal($('header.site-chrome').length,1);assert.equal($('footer.site-chrome').length,1);
 try{
  const saved=await call('/api/pages/how-i-can-help-you','PUT',{revision:initial.revision,values:{...original,[field.id]:'Help draft verification'}});
  assert.ok(!(await(await fetch(origin+'/how-i-can-help-you/')).text()).includes('Help draft verification'));
  assert.ok((await(await fetch(origin+'/admin/preview/how-i-can-help-you/')).text()).includes('Help draft verification'));
  await call('/api/pages/how-i-can-help-you/publish','POST',{revision:saved.revision});
  assert.ok((await(await fetch(origin+'/how-i-can-help-you/')).text()).includes('Help draft verification'));
 }finally{
  const state=await call('/api/pages/how-i-can-help-you');const restored=await call('/api/pages/how-i-can-help-you','PUT',{revision:state.revision,values:original});await call('/api/pages/how-i-can-help-you/publish','POST',{revision:restored.revision});
 }
});
