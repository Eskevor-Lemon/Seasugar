import wiki from './wiki-glossary.json' with { type: 'json' };
import places from './wiki-places.json' with { type: 'json' };
import community from './community-glossary.json' with { type: 'json' };

export const wikiSource = Object.freeze({url:wiki.source, date:wiki.retrieved, placesURL:places.source, placesDate:places.retrieved});

export function supplementPlaces(base, additions) {
  const key=s=>s.trim().toLocaleLowerCase();
  const translated=new Set(additions.flatMap(e=>[e.en,...e.enAliases]).map(key));
  const result=base.filter(e=>!e.untranslated||!translated.has(key(e.en)));
  const pairs=new Set(result.filter(e=>!e.untranslated).flatMap(e=>[e.en,...e.enAliases].flatMap(en=>e.zh.split(/\n+/).map(zh=>key(en)+'\0'+zh.trim()))));
  for(const entry of additions){
    const names=[entry.en,...entry.enAliases].filter(en=>!pairs.has(key(en)+'\0'+entry.zh));
    if(!names.length)continue;
    result.push({...entry,en:names[0],enAliases:names.slice(1)});
    for(const en of names)pairs.add(key(en)+'\0'+entry.zh);
  }
  return result;
}
export const defaultEntries=supplementPlaces(supplementPlaces(wiki.entries,places.entries),community.entries);

// The Wiki has context-dependent homonyms. Keep all choices in a single term
// so duplicate rows do not become blocking conflicts or silently lose meanings.
export function makeDefaultTerms(entries, direction) {
  const reverse=direction==='zh-en', result=new Map();
  for(const entry of entries) {
    if(reverse&&entry.untranslated)continue;
    const translations=entry.zh.split(/\n+/).map(s=>s.trim()).filter(s=>s&&!/^[（(]?(?:视|依)情况而定[）)]?$/.test(s));
    const sources=reverse?translations:[entry.en,...entry.enAliases];
    for(const source of sources){
      const key=source.trim().toLocaleLowerCase();
      if(!result.has(key))result.set(key,{source,variants:[],page:entry.source?`${entry.source}#${encodeURIComponent(entry.zh)}`:null});
      const term=result.get(key);
      for(const target of reverse?[entry.en]:entry.untranslated?[source]:translations){
        const context=`${entry.group}${entry.note?`：${entry.note}`:''}${entry.untranslated?'；Wiki 暂无中文译名，保留英文':''}`;
        if(!term.variants.some(v=>v.target===target&&v.context===context))term.variants.push({target,context});
      }
    }
  }
  return Object.freeze([...result.values()].map(({source,variants,page})=>{
    const choices=[...new Set(variants.map(v=>v.target))];
    const note='仅在对应专名语境下使用，普通词义按上下文翻译。'+variants.map(v=>`${v.target}（${v.context}）`).join('；')+(choices.length>1?'；同名有不同含义，请按上下文选择一项，不要并列输出。':'');
    return Object.freeze({source,target:choices[0],aliases:'',note,variants:Object.freeze(variants.map(Object.freeze)),page:page||`${wiki.source}#${encodeURIComponent(variants[0].context.split('：')[0].split('；')[0])}`});
  }));
}
export const defaultGlossaries=Object.freeze({
  'en-zh':makeDefaultTerms(defaultEntries,'en-zh'),
  'zh-en':makeDefaultTerms(defaultEntries,'zh-en'),
});
export function initialGlossaryMode(saved, glossaries) {
  if(['default','custom','combined'].includes(saved?.glossaryMode))return saved.glossaryMode;
  return Object.values(glossaries).some(terms=>terms.length)?'custom':'default';
}
export function activeGlossary(mode,direction,custom) {
  if(mode==='combined') {
    const key=s=>s.trim().toLocaleLowerCase();
    const overrides=new Set(custom[direction].flatMap(t=>[t.source,...(t.aliases||'').split(/[|;；]/)]).map(key).filter(Boolean));
    return [...defaultGlossaries[direction].filter(t=>!overrides.has(key(t.source))),...custom[direction]];
  }
  return mode==='default'?defaultGlossaries[direction]:custom[direction];
}
