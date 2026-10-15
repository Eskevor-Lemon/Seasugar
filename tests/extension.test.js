import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import wiki from '../src/wiki-glossary.json' with {type:'json'};
import {makeDefaultTerms} from '../src/glossary.js';
import '../插件/Google Chrome/matcher.js';
const {validate,compile,find}=globalThis.SeasugarMatcher;
test('extension respects longest names, exact case, unicode boundaries and punctuation',()=>{
  const c=compile(validate([{source:'Twilight',target:'暮光'},{source:'Twilight Sparkle',target:'暮光闪闪'},{source:'A. B.',target:'名字'}]));
  assert.deepEqual(find("Twilight Sparkle's Twilight twilight Twilightish éTwilight A. B.",c).map(m=>m.source),['Twilight Sparkle','Twilight','A. B.']);
  assert.equal(find('plain text',compile([])).length,0);
});
test('custom glossary validation rejects ambiguous duplicate entries and malformed data',()=>{
  assert.throws(()=>validate([{source:'A',target:'一'},{source:'A',target:'二'}]),/重复/);
  for(const rows of [null,[{}],[{source:' ',target:'x'}],[{source:'A\nB',target:'x'}]]) assert.throws(()=>validate(rows));
  assert.deepEqual(validate([{source:' A ',target:' 一 '}]),[{source:'A',target:'一'}]);
});
test('packaged extension uses only local assets and minimal permissions',()=>{
  const base=new URL('../插件/Google Chrome/',import.meta.url);
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base),'utf8'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);
  assert.equal(manifest.host_permissions,undefined);
  assert.ok(fs.existsSync(new URL(manifest.action.default_popup,base)));
  const data=JSON.parse(fs.readFileSync(new URL('glossary.json',base),'utf8'));
  assert.equal(validate(data.terms).length,2991);
  assert.deepEqual(data.terms,makeDefaultTerms(wiki.entries,'en-zh').map(({source,target,variants})=>({source,target,variants})));
  const cosmos=find('Cosmos',compile(validate(data.terms)))[0];
  assert.ok(cosmos.variants.some(v=>v.target==='纭宇'));
  assert.ok(cosmos.variants.some(v=>v.target==='宇宙洪荒'));
  assert.ok(data.source.includes('译名表'));
});
