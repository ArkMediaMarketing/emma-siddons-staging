import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
import catalog from '../worker/catalog.json' with {type:'json'};

test('Every public page uses the homepage header and footer with working active navigation',async()=>{
 const paths=catalog.documents.filter(d=>!['header','footer'].includes(d.id)).map(d=>d.route);
 let expected;
 for(const route of paths){
  const $=load(await readFile(new URL('../dist/site'+route+'index.html',import.meta.url),'utf8'));
  assert.equal($('header.site-chrome').length,1,route);
  assert.equal($('footer.site-chrome').length,1,route);
  if($('header .desktop-nav a').toArray().some(el=>$(el).attr('href')===route))assert.equal($('header .desktop-nav [aria-current=page]').attr('href'),route);
  $('header a').removeAttr('class aria-current');
  const chrome=[$('header').html(),$('footer').html()];
  if(expected)assert.deepEqual(chrome,expected,route);else expected=chrome;
 }
});
