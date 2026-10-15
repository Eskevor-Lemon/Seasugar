import test from 'node:test';
import assert from 'node:assert/strict';
import {readSettings,patchSettings,cleanTerms} from '../src/storage.js';
const store=initial=>({value:JSON.stringify(initial),getItem(){return this.value;},setItem(_key,value){this.value=value;}});
test('settings writes preserve newer glossary edits and legacy settings',()=>{
  const storage=store({model:'legacy-model',glossaries:{'en-zh':[{source:'Ponyville',target:'小马谷'}],'zh-en':[{source:'小马谷',target:'Ponyville'}]}});
  patchSettings({glossaryMode:'combined'},storage);
  patchSettings({style:'自然'},storage);
  const result=readSettings(storage);
  assert.equal(result.model,'legacy-model');assert.equal(result.glossaryMode,'combined');
  assert.equal(result.glossaries['en-zh'][0].target,'小马谷');assert.equal(result.glossaries['zh-en'][0].target,'Ponyville');
  assert.deepEqual(cleanTerms(result.glossaries['en-zh']),[{source:'Ponyville',target:'小马谷',aliases:'',note:''}]);
});
test('corrupt or unavailable storage is not silently overwritten',()=>{
  const storage=store({});storage.value='broken';assert.throws(()=>patchSettings({style:'x'},storage));assert.equal(storage.value,'broken');
  storage.value='null';assert.throws(()=>readSettings(storage));
  storage.value='{}';storage.setItem=()=>{throw new Error('QuotaExceeded');};assert.throws(()=>patchSettings({style:'x'},storage),/QuotaExceeded/);
});
