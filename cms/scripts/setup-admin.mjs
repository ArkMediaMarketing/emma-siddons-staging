import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomToken,hashToken} from '../worker/auth.js';
const config=JSON.parse(readFileSync('wrangler.json','utf8'));
const email=config.vars.ADMIN_EMAIL;
if(!/^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+$/.test(email))throw new Error('Invalid administrator email.');
const command=sql=>{const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','emma-siddons-cms','--remote','--env','','--command',sql,'--json'],{encoding:'utf8'});if(r.status!==0)throw new Error('Unable to provision administrator setup: '+r.stderr);return JSON.parse(r.stdout);};
const existing=command('SELECT email FROM administrators WHERE id=1');
if(existing[0]?.results?.length){console.log('An administrator is already configured. Sign in at https://emma-siddons-admin.itswebsitedeveloper-ews.workers.dev/admin/');process.exit(0);}
const token=randomToken(),hash=await hashToken(token),expires=Date.now()+24*60*60*1000;
command(`DELETE FROM setup_tokens; INSERT INTO setup_tokens(token_hash,email,expires_at) VALUES('${hash}','${email}',${expires});`);
console.log('Private, single-use setup link (expires in 24 hours):');
console.log('https://emma-siddons-admin.itswebsitedeveloper-ews.workers.dev/admin/setup/#token='+token);
