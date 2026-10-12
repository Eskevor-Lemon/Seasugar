import wiki from './wiki-glossary.json' with { type: 'json' };

export const wikiSource = Object.freeze({url:wiki.source, date:wiki.retrieved});

// Merge equal source names when reversing; aliases belong to their own language.
export function makeDefaultTerms(entries, direction) {
  const reverse=direction==='zh-en', result=new Map();
  for(const entry of entries) {
    const source=reverse?entry.zh:entry.en, target=reverse?entry.en:entry.zh;
    const key=source.trim().toLocaleLowerCase();
    if(result.has(key))continue;
    result.set(key,Object.freeze({source,target,aliases:(reverse?entry.zhAliases:entry.enAliases).join(';'),note:'MLP 角色或角色称呼；仅在指代对应角色时使用，普通词义按上下文翻译。',page:entry.page}));
  }
  return Object.freeze([...result.values()]);
}
export const defaultGlossaries=Object.freeze({
  'en-zh':makeDefaultTerms(wiki.entries,'en-zh'),
  'zh-en':makeDefaultTerms(wiki.entries,'zh-en'),
});
export function initialGlossaryMode(saved, glossaries) {
  if(saved?.glossaryMode==='default'||saved?.glossaryMode==='custom')return saved.glossaryMode;
  return Object.values(glossaries).some(terms=>terms.length)?'custom':'default';
}
export function activeGlossary(mode,direction,custom) {
  return mode==='default'?defaultGlossaries[direction]:custom[direction];
}
