import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPacket} from '../src/packet.js';
const terms=[{source:'Twilight',target:'暮光',aliases:'',note:''},{source:'Twilight Sparkle',target:'暮光闪闪',aliases:'',note:''}];
test('packet preserves exact paragraphs and only retrieves applicable names',()=>{
 const text='Twilight Sparkle said "Hi".\n\n  Bonjour!';
 const r=buildPacket({text,terms,direction:'en-zh',onlySource:true,style:'保持口吻'});
 const data=JSON.parse(r.output.split('以下为翻译资料：\n')[1]);
 assert.equal(data.text,text);assert.equal(r.count,1);assert.equal(data.glossary[0].source,'Twilight Sparkle');assert.equal(data.style,'保持口吻');
 assert.match(r.output,/只翻译英文/);assert.match(r.output,/只输出译文/);
});
test('packet supports reverse direction and rejects empty or oversized input',()=>{
 const options={text:'你好',terms:[],direction:'zh-en',onlySource:false,style:''};
 assert.match(buildPacket(options).output,/将可翻译正文译成英文/);
 assert.throws(()=>buildPacket({...options,text:'  '}),/先输入/);
 assert.throws(()=>buildPacket({...options,text:'x'.repeat(200001)}),/20 万/);
});
