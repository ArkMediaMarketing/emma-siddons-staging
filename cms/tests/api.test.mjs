import test from 'node:test';
import assert from 'node:assert/strict';
import {validateValues,safeURL} from '../worker/validation.ts';
import worker from '../worker/index.ts';
const origin='http://localhost:8787';
const request=async(path,method='GET',body)=>{const response=await fetch(origin+path,{method,headers:method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
test('URL validation rejects executable and protocol-relative URLs',()=>{for(const value of ['javascript:alert(1)','//evil.test','data:text/html,x','/\\evil.test','https://x.test/ bad'])assert.equal(safeURL(value),false);assert.equal(safeURL('/contact/'),true);assert.equal(safeURL('https://example.com/image.jpg',true),true);assert.equal(safeURL('mailto:emma@example.com'),true);assert.throws(()=>validateValues({fields:[]},{unrecognised:'x'}));});
test('Production API requires a session',async()=>{const response=await worker.fetch(new Request('https://cms.example.com/api/pages'),{});assert.equal(response.status,401);});
test('Local bypass cannot be used on a remote hostname',async()=>{const response=await worker.fetch(new Request('https://cms.example.com/admin/'),{LOCAL_DEVELOPMENT:'true'});assert.equal(response.status,302);assert.equal(new URL(response.headers.get('Location')).pathname,'/admin/login/');});
test('Draft, preview, publish, conflict detection and restoration',async()=>{
 const initial=(await request('/api/pages/home-new')).data;const field=initial.document.fields.find(f=>f.id.startsWith('home-new-text'));
 const original=structuredClone(initial.values), edited={...original,[field.id]:'Studio <verification> & content test'};
 try {
  const saved=await request('/api/pages/home-new','PUT',{revision:initial.revision,values:edited});assert.equal(saved.status,200);
  const publicHTML=await (await fetch(origin+'/')).text();assert.equal(publicHTML.includes('Studio &lt;verification&gt;'),false);
  const preview=await (await fetch(origin+'/?preview=1')).text();assert.ok(preview.includes('Studio &lt;verification&gt; &amp; content test'));assert.equal(preview.includes('<verification>'),false);
  const stale=await request('/api/pages/home-new','PUT',{revision:initial.revision,values:edited});assert.equal(stale.status,409);
  const foreign=await fetch(origin+'/api/pages/home-new',{method:'PUT',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({revision:saved.data.revision,values:edited})});assert.equal(foreign.status,403);
  const published=await request('/api/pages/home-new/publish','POST',{revision:saved.data.revision});assert.equal(published.status,200);
  const live=await(await fetch(origin+'/')).text();assert.ok(live.includes('Studio &lt;verification&gt; &amp; content test'));
 }finally{
  const latest=(await request('/api/pages/home-new')).data;
  const restored=await request('/api/pages/home-new','PUT',{revision:latest.revision,values:original});assert.equal(restored.status,200);
  assert.equal((await request('/api/pages/home-new/publish','POST',{revision:restored.data.revision})).status,200);
 }
});

test('Promoted homepage retains its CMS identity and old address redirects',async()=>{
 const pages=(await request('/api/pages')).data;
 const root=pages.filter(page=>page.route==='/'&&!['header','footer'].includes(page.id));
 assert.equal(root.length,1);assert.equal(root[0].id,'home-new');assert.equal(root[0].title,'Home');
 for(const path of ['/home-new','/home-new/','/home-new/index.html']){
  const response=await fetch(origin+path+'?source=old-link',{redirect:'manual'});
  assert.equal(response.status,301);assert.equal(response.headers.get('Location'),origin+'/?source=old-link');
 }
 const html=await(await fetch(origin+'/')).text();assert.ok(html.includes('home-new-page'));assert.ok(html.includes('href="'+ 'https://emma-siddons-admin.tight-darkness-d12f.workers.dev/'+'"'));
});
