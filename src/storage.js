export const storageKey='mlp-translation-v1';
export const cleanTerms=items=>Array.isArray(items)?items.filter(t=>t&&typeof t.source==='string'&&typeof t.target==='string').map(t=>({source:t.source,target:t.target,aliases:typeof t.aliases==='string'?t.aliases:'',note:typeof t.note==='string'?t.note:''})):[];
export function readSettings(storage=localStorage){
  const value=JSON.parse(storage.getItem(storageKey)||'{}');
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('保存的数据格式损坏，请先备份浏览器数据。');
  return value;
}
// Merge only the caller's fields so a settings edit cannot overwrite a newer glossary.
export function patchSettings(patch,storage=localStorage){
  const value={...readSettings(storage),...patch};
  storage.setItem(storageKey,JSON.stringify(value));
  return value;
}
