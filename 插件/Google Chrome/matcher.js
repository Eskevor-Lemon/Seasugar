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
