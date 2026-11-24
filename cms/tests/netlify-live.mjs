// Explicit live integration check. Re-publishes identical content; no visible copy changes.
// An account-authorized, short-lived verification session is revoked in finally.
import {spawnSync} from 'node:child_process';
import {randomToken,hashToken} from '../worker/auth.js';
const worker='https://emma-siddons-admin.itswebsitedeveloper-ews.workers.dev';
const live='https://emma-siddons-staging.netlify.app';
const sql=command=>{const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','emma-siddons-cms','--remote','--env','','--command',command,'--json'],{encoding:'utf8'});if(result.status!==0)throw new Error('Database verification command failed.');return JSON.parse(result.stdout);};
const token=randomToken(),hash=await hashToken(token),email='itswebsitedeveloper.ews@gmail.com';
const cookie='__Host-emma_session='+token;
const call=async(path,method='GET',body)=>{const r=await fetch(live+path,{method,headers:{Cookie:cookie,Origin:live,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error||'API check failed.');return data;};
const version=async origin=>{const r=await fetch(origin+'/',{cache:'no-store'});if(r.status!==200||r.headers.get('x-cms-origin')!=='emma-siddons-admin')throw new Error('Published Worker content is not being served.');return r.headers.get('x-cms-published-version');};
try {
 sql(`INSERT INTO admin_sessions VALUES('${hash}','${email}',${Date.now()+10*60*1000})`);
 const state=await call('/api/pages/home');
 if(state.revision && JSON.stringify(state.values)!==JSON.stringify(state.published))throw new Error('An unpublished homepage draft exists; leaving it untouched.');
 const before=await version(live);
 const saved=await call('/api/pages/home','PUT',{values:state.values,revision:state.revision});
 if(await version(live)!==before)throw new Error('Saving a draft unexpectedly changed the public version.');
 await call('/api/pages/home/publish','POST',{revision:saved.revision});
 const after=await version(worker),netlify=await version(live);
 if(before===after||after!==netlify)throw new Error('Netlify did not receive the newly published version.');
 console.log('PASS: draft remained private; admin Publish updated Netlify immediately.');
 console.log('Worker and Netlify share published version:',after);
 for(const path of ['/about-me/','/home-new/','/v2/','/images/oilseed-rape-hero.jpg','/admin']){
  const r=await fetch(live+path,{redirect:'manual'});
  const expected=path==='/admin'?302:200;
  if(path==='/admin'&&new URL(r.headers.get('location')).origin!==live)throw new Error('Admin redirected off the Netlify origin.');
  if(r.status!==expected)throw new Error('Unexpected status for '+path+': '+r.status);
  console.log('PASS:',path,r.status);
 }
} finally {sql(`DELETE FROM admin_sessions WHERE token_hash='${hash}'`);}
