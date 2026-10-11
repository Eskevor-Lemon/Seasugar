import { unzipSync, strFromU8 } from 'fflate';
import { parseCSV, rowsToTerms } from './core.js';
const elements = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const textOf = node => elements(node, 't').map(n => n.textContent).join('');
function xml(bytes) {
  if (!bytes) throw new Error('文件缺少必要的数据，请重新另存为 DOCX 或 XLSX。');
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('文件中的 XML 数据损坏。');
  return doc;
}
function unzip(buffer) {
  let total = 0;
  return unzipSync(new Uint8Array(buffer), {filter: file => {
    total += file.originalSize;
    if (total > 30 * 1024 * 1024) throw new Error('解压后的文件过大，请拆分译名表。');
    return /^(word\/document\.xml|xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(file.name);
  }});
}
export async function importTerms(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('译名表最大 5 MB，请拆分后上传。');
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'json') {
    const data = JSON.parse(await file.text());
    const terms = Array.isArray(data) ? data : data.terms;
    if (!Array.isArray(terms)) throw new Error('JSON 应为词条数组或含 terms 数组的对象。');
    if (data.direction && !['en-zh','zh-en'].includes(data.direction)) throw new Error('不支持该翻译方向。');
    return {terms:rowsToTerms([['source','target','aliases','note'], ...terms.map(t => [t.source,t.target,t.aliases || '',t.note || ''])]), direction:data.direction};
  }
  if (['csv','tsv'].includes(ext)) return {terms:rowsToTerms(parseCSV(await file.text(), ext === 'tsv' ? '\t' : ','))};
  if (!['docx','xlsx'].includes(ext)) throw new Error('请上传 DOCX、XLSX、CSV、TSV 或 JSON 文件。');
  const files = unzip(await file.arrayBuffer());
  if (ext === 'docx') {
    const doc = xml(files['word/document.xml']);
    const tables = elements(doc,'tbl');
    if (tables.length) return {terms:tables.flatMap(table => rowsToTerms(elements(table,'tr').map(row => elements(row,'tc').map(textOf))))};
    const lines = elements(doc,'p').map(p => [...p.childNodes].map(n => {
      if (elements(n,'tab').length) return [...n.childNodes].map(c => c.localName === 'tab' ? '\t' : c.textContent).join('');
      return textOf(n);
    }).join('')).filter(s => s.trim());
    return {terms:rowsToTerms(lines.map(s => s.split(/\t|\s+[—–=]\s+|\s*→\s*/)))};
  }
  const strings = files['xl/sharedStrings.xml'] ? elements(xml(files['xl/sharedStrings.xml']),'si').map(textOf) : [];
  const sheets = Object.keys(files).filter(p=>p.startsWith('xl/worksheets/')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if (!sheets.length) throw new Error('Excel 中没有工作表。');
  const terms = sheets.flatMap(path => {
    const rows = elements(xml(files[path]),'row').map(row => {
      const cells = [];
      for (const cell of elements(row,'c')) {
        const letters = cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0];
        if (!letters) continue;
        const index = [...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
        if (index > 50) continue;
        const val = elements(cell,'v')[0]?.textContent || '';
        cells[index] = cell.getAttribute('t') === 's' ? strings[Number(val)] || '' : cell.getAttribute('t') === 'inlineStr' ? textOf(cell) : val;
      }
      return Array.from(cells, x=>x || '');
    }).filter(r=>r.some(Boolean));
    return rows.length ? rowsToTerms(rows) : [];
  });
  if (!terms.length) throw new Error('Excel 中没有可导入的词条。');
  return {terms};
}
