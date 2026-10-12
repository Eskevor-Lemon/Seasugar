import test from 'node:test';
import assert from 'node:assert/strict';
import {activeGlossary,defaultGlossaries,initialGlossaryMode,makeDefaultTerms,wikiSource} from '../src/glossary.js';
import {glossaryProblems,relevantTerms,buildMessages,hasExpectedTranslation} from '../src/core.js';
import wiki from '../src/wiki-glossary.json' with {type:'json'};

test('default tables are complete, immutable and conflict-free in both directions',()=>{
  for(const terms of Object.values(defaultGlossaries)){
    assert.ok(terms.length>2500);
    assert.deepEqual(glossaryProblems(terms),[]);
    assert.throws(()=>terms.push({}));
    assert.ok(terms.every(t=>t.page.startsWith('https://mlp.huijiwiki.com/wiki/')));
  }
  assert.equal(defaultGlossaries['en-zh'].find(t=>t.source==='Twilight Sparkle').target,'暮光闪闪');
  assert.equal(defaultGlossaries['zh-en'].find(t=>t.source==='暮光闪闪').target,'Twilight Sparkle');
  assert.equal(relevantTerms('Shining Armor spoke.',defaultGlossaries['en-zh'])[0].target,'银甲闪闪');
  assert.equal(relevantTerms('Sci-Twi spoke.',defaultGlossaries['en-zh'])[0].target,'人类暮光');
});
test('translation table keeps original priority, official fallback, merged columns and unknown names',()=>{
  assert.equal(wikiSource.url,'https://mlp.huijiwiki.com/wiki/译名表');
  const get=en=>defaultGlossaries['en-zh'].find(t=>t.source===en);
  assert.equal(get('Applejack').target,'苹果杰克');
  assert.equal(get('A. B. Ravenhoof').target,'A. B. 瑞文霍夫');
  assert.equal(get('Alice').target,'爱丽丝');
  assert.equal(get('All Aboard').target,'All Aboard');
  assert.equal(get('Aloe Vera').target,'芦荟');
  assert.equal(get('Big Mac').target,'大麦哥');
  assert.equal(get('Ponyville').target,'小马镇');
  for(const e of wiki.entries)assert.equal(e.zh,e.original||e.official||e.en);
});
test('contextual homonyms survive in both directions and any supported translation passes the reminder',()=>{
  const term=defaultGlossaries['en-zh'].find(t=>t.source==='Shadowbolts');
  assert.deepEqual(term.variants.map(v=>v.target),['暗影天马','暗影团']);
  assert.ok(hasExpectedTranslation('暗影团赢了。',term));
  assert.ok(!hasExpectedTranslation('错误名字',term));
  const reverse=defaultGlossaries['zh-en'].find(t=>t.source==='苹果酥');
  assert.ok(reverse.variants.some(v=>v.target==='Apple Crisp'));
  assert.ok(reverse.variants.some(v=>v.target==='Apple Fritter'));
  const prompt=buildMessages({text:'Shadowbolts',direction:'en-zh',terms:defaultGlossaries['en-zh']});
  assert.equal(JSON.parse(prompt[1].content).glossary[0].variants.length,2);
});
test('longer names suppress embedded short names but keep separate mentions',()=>{
  const terms=[{source:'Twilight',target:'暮暮',aliases:''},{source:'Twilight Sparkle',target:'暮光闪闪',aliases:''}];
  assert.deepEqual(relevantTerms('Twilight Sparkle smiled.',terms),[terms[1]]);
  assert.equal(relevantTerms('Twilight Sparkle said: Twilight!',terms).length,2);
  assert.deepEqual(relevantTerms('TwilightSparkles',terms),[]);
});
test('legacy custom data wins migration and survives mode and direction switches',()=>{
  const custom={'en-zh':[{source:'Twilight Sparkle',target:'自定义暮暮',aliases:'',note:''}],'zh-en':[]};
  const before=JSON.stringify(custom);
  assert.equal(initialGlossaryMode({},custom),'custom');
  assert.equal(initialGlossaryMode({}, {'en-zh':[],'zh-en':[]}),'default');
  assert.equal(initialGlossaryMode({glossaryMode:'custom'}, {'en-zh':[],'zh-en':[]}),'custom');
  for(const mode of ['default','custom','default','custom'])for(const dir of ['en-zh','zh-en'])activeGlossary(mode,dir,custom);
  assert.equal(JSON.stringify(custom),before);
  for(const [mode,target] of [['default','暮光闪闪'],['custom','自定义暮暮']]){
    const messages=buildMessages({text:'Twilight Sparkle spoke.',terms:activeGlossary(mode,'en-zh',custom),direction:'en-zh'});
    assert.equal(JSON.parse(messages[1].content).glossary[0].target,target);
  }
  assert.deepEqual(activeGlossary('custom','zh-en',custom),[]);
});
