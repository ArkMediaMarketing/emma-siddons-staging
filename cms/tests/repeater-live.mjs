// Account-authorized live check: private draft only; restore it and revoke the session.
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {randomToken,hashToken} from '../worker/auth.ts';
const origin='https://emma-siddons-staging.netlify.app';
function sql(command){const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','emma-siddons-cms','--remote','--env','','--command',command,'--json'],{encoding:'utf8'});if(r.status!==0)throw new Error('Database verification failed.');return JSON.parse(r.stdout);}
const token=randomToken(),hash=await hashToken(token),cookie='__Host-emma_session='+token;
async function call(path,method='GET',body){const r=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(await r.text());return r.json();}
let original=null,savedRevision=null;
try{
 sql(`INSERT INTO admin_sessions VALUES('${hash}','itswebsitedeveloper.ews@gmail.com',${Date.now()+600000})`);
 const state=await call('/api/pages/home');
 if(state.revision&&JSON.stringify(state.values)!==JSON.stringify(state.published))throw new Error('Unpublished draft exists; leaving it untouched.');
 original=structuredClone(state.values);
 const field=state.document.fields.find(f=>f.type==='repeater');assert.ok(field);
 const rows=field.items.map((item,index)=>({templateIndex:index,iconIndex:index,values:Object.fromEntries(item.allFields.map(f=>[f.id,original[f.id]??f.value]))}));
 rows.reverse();const added=structuredClone(rows[rows.length-1]);const title=field.items[added.templateIndex].fields.find(f=>f.label==='Title');added.values[title.id]='Private repeater verification';rows.push(added);
 const before=(await fetch(origin+'/')).headers.get('x-cms-published-version');
 const saved=await call('/api/pages/home','PUT',{revision:state.revision,values:{...original,[field.id]:rows}});savedRevision=saved.revision;
 const preview=await fetch(origin+'/admin/preview/',{headers:{Cookie:cookie}});assert.equal(preview.status,200);const $=load(await preview.text());
 assert.equal($('.steps>li').length,6);assert.equal($('.steps>li').last().find('h3').text(),'Private repeater verification');
 assert.deepEqual($('.steps [data-cms-auto-number]').toArray().map(el=>$(el).text()),['1','2','3','4','5','6']);assert.equal($('.steps svg').length,6);
 const publicPage=await fetch(origin+'/');assert.equal(publicPage.headers.get('x-cms-published-version'),before);assert.ok(!(await publicPage.text()).includes('Private repeater verification'));
 console.log('PASS: native Cloudflare repeater preview renders six entries with automatic numbering and icons; public content stayed unchanged.');
}finally{
 try{if(savedRevision!==null)await call('/api/pages/home','PUT',{revision:savedRevision,values:original});}
 finally{sql(`DELETE FROM admin_sessions WHERE token_hash='${hash}'`);}
}
