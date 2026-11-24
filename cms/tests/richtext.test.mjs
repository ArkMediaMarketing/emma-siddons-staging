import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeRichText,validateValues} from '../worker/validation.ts';
const origin='http://localhost:8787';
const call=async(path,method='GET',body)=>{const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.ok,true,await r.clone().text());return r.json();};
test('Rich text preserves formatting while removing executable content and unsafe links',()=>{
 const clean=sanitizeRichText('<strong>Hello</strong><em> world</em><br><a href="/contact/" onclick="alert(1)">Contact</a><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Bad</a>');
 assert.ok(clean.includes('<strong>Hello</strong><em> world</em><br />'));
 assert.ok(clean.includes('href="/contact/"'));assert.doesNotMatch(clean,/script|onclick|onerror|javascript:|<img/);
 assert.equal(sanitizeRichText('<a href="//evil.example">Bad</a>'),'<a>Bad</a>');
 const values=validateValues({fields:[{id:'body',type:'richtext',value:null}]},{body:'<em>Safe</em><script>bad</script>'});assert.equal(values.body,'<em>Safe</em>');
});
test('Complete heading field keeps drafts private, publishes formatting and restores original state',async()=>{
 const initial=await call('/api/pages/home'),field=initial.document.fields.find(f=>f.type==='richtext'&&f.label.startsWith('Main heading'));
 assert.ok(field.legacyIds.length>1);const original=structuredClone(initial.values);
 try{
  const saved=await call('/api/pages/home','PUT',{revision:initial.revision,values:{...original,[field.id]:'A <em>formatted</em> test heading'}});
  assert.ok(!(await (await fetch(origin+'/')).text()).includes('<em>formatted</em>'));
  assert.ok((await (await fetch(origin+'/admin/preview/')).text()).includes('<em>formatted</em>'));
  await call('/api/pages/home/publish','POST',{revision:saved.revision});
  assert.ok((await (await fetch(origin+'/')).text()).includes('<em>formatted</em>'));
 }finally{
  const state=await call('/api/pages/home');const saved=await call('/api/pages/home','PUT',{revision:state.revision,values:original});await call('/api/pages/home/publish','POST',{revision:saved.revision});
 }
});
