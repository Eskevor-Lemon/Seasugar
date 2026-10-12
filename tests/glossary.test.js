import test from 'node:test';
import assert from 'node:assert/strict';
import {activeGlossary,defaultGlossaries,initialGlossaryMode} from '../src/glossary.js';
import {glossaryProblems,relevantTerms,buildMessages} from '../src/core.js';

test('default tables are complete, immutable and conflict-free in both directions',()=>{
  for(const terms of Object.values(defaultGlossaries)){
    assert.ok(terms.length>300);
    assert.deepEqual(glossaryProblems(terms),[]);
    assert.throws(()=>terms.push({}));
    assert.ok(terms.every(t=>t.page.startsWith('https://mlp.huijiwiki.com/wiki/')));
  }
  assert.equal(defaultGlossaries['en-zh'].find(t=>t.source==='Twilight Sparkle').target,'暮光闪闪');
  assert.equal(defaultGlossaries['zh-en'].find(t=>t.source==='暮光闪闪').target,'Twilight Sparkle');
  assert.equal(relevantTerms('Shining Armor spoke.',defaultGlossaries['en-zh'])[0].target,'银甲闪闪');
  assert.equal(relevantTerms('Vinyl Scratch spoke.',defaultGlossaries['en-zh'])[0].target,'DJ-3号');
  assert.equal(relevantTerms('Sci-Twi spoke.',defaultGlossaries['en-zh'])[0].target,'人类暮光');
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
