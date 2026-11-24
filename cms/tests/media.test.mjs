import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const origin='http://localhost:8787';
test('Image upload validates type and round-trips bytes',async()=>{
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8S8AAAAASUVORK5CYII=','base64');
 const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),'cms-test-pixel.png');
 const response=await fetch(origin+'/api/media',{method:'POST',headers:{Origin:origin},body:form});assert.equal(response.status,201);
 const media=await response.json();
 try{const asset=await fetch(origin+media.src);assert.equal(asset.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await asset.arrayBuffer()),bytes);}finally{const db=new DatabaseSync('.local/content.sqlite');db.prepare('DELETE FROM media WHERE id=?').run(media.id);db.close();}
 const bad=new FormData();bad.set('file',new Blob(['<svg><script>alert(1)</script></svg>'],{type:'image/svg+xml'}),'bad.svg');
 assert.equal((await fetch(origin+'/api/media',{method:'POST',headers:{Origin:origin},body:bad})).status,400);
});
