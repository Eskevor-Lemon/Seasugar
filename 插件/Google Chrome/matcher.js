(() => {
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function validate(rows) {
    if (!Array.isArray(rows) || rows.length > 3000) throw Error('词表须为数组，最多 3000 条。');
    const seen = new Set();
    return rows.map(r => {
      if (typeof r?.source !== 'string' || typeof r?.target !== 'string') throw Error('每条需要 source（英文）和 target（中文）。');
      const source = r.source.trim(), target = r.target.trim();
      if (!source || !target || source.length > 120 || target.length > 120 || /[\r\n]/.test(source + target)) throw Error('词条不能为空、换行或超过 120 字符。');
      if (seen.has(source)) throw Error(`重复原文：${source}`);
      seen.add(source);
      if (r.variants !== undefined) {
        if (!Array.isArray(r.variants) || !r.variants.length || r.variants.length > 50) throw Error('译名候选格式无效。');
        const variants=r.variants.map(v=>{
          if(typeof v.target!=='string'||!v.target.trim()||v.target.length>120||/[\r\n]/.test(v.target)||typeof v.context!=='string'||v.context.length>2000)throw Error('译名候选格式无效。');
          return {target:v.target.trim(),context:v.context};
        });
        if(!variants.some(v=>v.target===target))throw Error('默认译名须在候选中。');
        return {source,target,variants};
      }
      return {source, target};
    });
  }
  function compile(rows) {
    const map = new Map(rows.map(r => [r.source, r]));
    const names = [...map.keys()].sort((a,b) => b.length-a.length);
    return {map, regex: names.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu') : null};
  }
  function find(text, compiled) {
    if (!compiled.regex) return [];
    return [...text.matchAll(compiled.regex)].map(m => ({start:m.index, end:m.index+m[0].length, ...compiled.map.get(m[0])}));
  }
  globalThis.SeasugarMatcher = {validate, compile, find};
})();
