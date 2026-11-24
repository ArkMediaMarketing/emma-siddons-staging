import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeRichText,sanitizeProse,proseParagraphs,validateValues} from '../worker/validation.ts';
import {load} from 'cheerio';
const origin='http://localhost:8787';
const call=async(path,method='GET',body)=>{const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.ok,true,await r.clone().text());return r.json();};
test('Rich text preserves formatting while removing executable content and unsafe links',()=>{
 const clean=sanitizeRichText('<strong>Hello</strong><em> world</em><br><a href="/contact/" onclick="alert(1)">Contact</a><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">Bad</a>');
 assert.ok(clean.includes('<strong>Hello</strong><em> world</em><br />'));
 assert.ok(clean.includes('href="/contact/"'));assert.doesNotMatch(clean,/script|onclick|onerror|javascript:|<img/);
 assert.equal(sanitizeRichText('<a href="//evil.example">Bad</a>'),'<a>Bad</a>');
 const values=validateValues({fields:[{id:'body',type:'richtext',value:null}]},{body:'<em>Safe</em><script>bad</script>'});assert.equal(values.body,'<em>Safe</em>');
});
test('Paragraph groups preserve paragraph boundaries without forced line breaks',async()=>{
 assert.equal(sanitizeProse('<p>A<br>B</p><p>C</p>'),'<p>A B</p><p>C</p>');
 assert.deepEqual(proseParagraphs('<p>A</p><p>B</p>'),['A','B']);
 const initial=await call('/api/pages/home'),original=structuredClone(initial.values);
 const field=initial.document.fields.find(f=>f.type==='prose'&&f.section==='About me'&&f.blocks.length===2);
 assert.ok(field,'About paragraphs must share one field');
 const content='<p>Paragraph verification one.</p><p>Paragraph <em>verification</em> two.</p><p>Paragraph verification three.</p>';
 try{
  const saved=await call('/api/pages/home','PUT',{revision:initial.revision,values:{...original,[field.id]:content}});
  assert.ok(!(await (await fetch(origin+'/')).text()).includes('Paragraph verification one.'));
  await call('/api/pages/home/publish','POST',{revision:saved.revision});
  const $=load(await (await fetch(origin+'/')).text());
  const paragraphs=$('main p').toArray().filter(el=>$(el).text().startsWith('Paragraph verification'));
  assert.equal(paragraphs.length,3);assert.equal($('p p').length,0);
  assert.equal($('main').text().includes('I research and preview suitable homes'),false);
 }finally{
  const state=await call('/api/pages/home');const saved=await call('/api/pages/home','PUT',{revision:state.revision,values:original});await call('/api/pages/home/publish','POST',{revision:saved.revision});
 }
});
test('Complete heading field keeps drafts private, publishes formatting and restores original state',async()=>{
 const initial=await call('/api/pages/home'),field=initial.document.fields.find(f=>f.type==='richtext'&&f.section==='Hero'&&f.label.endsWith('heading'));
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
