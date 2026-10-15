import './style.css';
import './pony-theme.css';
import './glossary-page.css';
import {activeGlossary,initialGlossaryMode,wikiSource} from './glossary.js';
import {normalize,glossaryProblems} from './core.js';
import {importTerms} from './import.js';
import {readSettings,patchSettings,cleanTerms,storageKey} from './storage.js';
const $=id=>document.getElementById(id);
let saved={},loadFailed=false;
try{saved=readSettings();}catch{loadFailed=true;}
const glossaries={'en-zh':cleanTerms(saved.glossaries?.['en-zh']),'zh-en':cleanTerms(saved.glossaries?.['zh-en'])};
let glossaryMode=initialGlossaryMode(saved,glossaries),page=0,pendingImport=[],editing=false,dirty=false;
const direction=()=>$('direction').value;
const editableTerms=()=>glossaries[direction()];
const terms=()=>activeGlossary(glossaryMode,direction(),glossaries);
function status(text){$('save-status').textContent=text;}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function termChanged(){
  dirty=true;
  try{
    // Preserve the other direction and settings changed in other tabs.
    const latest=readSettings();
    patchSettings({glossaries:{...latest.glossaries,[direction()]:editableTerms()},glossaryMode});
    dirty=false;status('已保存在此浏览器。回到主页后重新生成资料包即可使用。');return true;
  }catch{status('保存失败：当前修改仅在本页有效，请立即导出备份，并检查浏览器存储权限或空间。');return false;}
}
function field(value,label,change){const input=document.createElement('input');input.value=value||'';input.setAttribute('aria-label',label);input.oninput=()=>change(input.value);return input;}
function button(text,action){const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;}
function guard(){if(!editing)return true;return confirm('放弃尚未保存的这行修改？');}
function editRow(row,term,isCustom){
  if(!guard())return;
  renderTerms();editing=true;
  // Rendering replaces rows; find by the original source, or append a new row.
  row=[...$('terms').rows].find(r=>r.dataset.source===term.source)||$('terms').insertRow(0);
  row.replaceChildren();const draft={source:term.source,target:term.target,aliases:term.aliases||'',note:term.note||''};
  for(const [key,label] of [['source','原文'],['target','译名'],['aliases','别名（用 ; 分隔）'],['note','备注']]){
    const cell=row.insertCell();const input=field(draft[key],label,v=>draft[key]=v);input.readOnly=key==='source'&&!isCustom&&!!term.source;cell.append(input);
  }
  const actions=row.insertCell();actions.append(button('保存',()=>{
    draft.source=draft.source.trim();draft.target=draft.target.trim();
    if(!draft.source||!draft.target){status('请填写原文和译名。');return;}
    const candidate=editableTerms().filter(t=>t!==term);
    if(candidate.some(t=>normalize(t.source)===normalize(draft.source))){status('已有同名自定义词条，请搜索并修改该词条。');return;}
    const problems=glossaryProblems([...candidate,draft]);if(problems.length){status(problems[0]);return;}
    glossaries[direction()]=[...candidate,draft];if(glossaryMode==='default')glossaryMode='combined';
    editing=false;termChanged();renderTerms();
  }),button('取消',()=>{editing=false;renderTerms();}));row.querySelector(isCustom?'input':'td:nth-child(2) input')?.focus();
}
function renderTerms(){
  editing=false;$('glossary-mode').value=glossaryMode;
  const all=terms(),search=normalize($('term-search').value);
  const matches=all.filter(t=>normalize([t.source,t.target,t.aliases,t.note,...(t.variants||[]).map(v=>v.target)].join(' ')).includes(search));
  const pages=Math.max(1,Math.ceil(matches.length/50));page=Math.min(page,pages-1);
  $('term-count').textContent=all.length;$('search-count').textContent=`匹配 ${matches.length} 条`;
  $('terms').replaceChildren();document.querySelector('.table-scroll').scrollTop=0;
  for(const term of matches.slice(page*50,page*50+50)){
    const row=$('terms').insertRow();row.dataset.source=term.source;
    const custom=editableTerms().includes(term);
    for(const value of [term.source,term.variants?[...new Set(term.variants.map(v=>v.target))].join(' / '):term.target,term.aliases,term.note])row.insertCell().textContent=value||'—';
    const cell=row.insertCell();const label=document.createElement('small');label.textContent=custom?'自定义':'默认';cell.append(label,button('修改',()=>editRow(row,term,custom)));
    if(custom)cell.append(button('删除',()=>{if(!guard()||!confirm(`删除“${term.source}”的自定义项？覆盖模式下将恢复默认译名。`))return;glossaries[direction()]=editableTerms().filter(t=>t!==term);termChanged();renderTerms();}));
  }
  if(!matches.length){const cell=$('terms').insertRow().insertCell();cell.colSpan=5;cell.textContent='没有匹配的词条。可以添加词条或上传译名表。';}
  $('page-number').textContent=`${page+1} / ${pages}`;$('previous').disabled=page===0;$('next').disabled=page===pages-1;
}
$('add-term').onclick=()=>editRow(null,{source:'',target:'',aliases:'',note:''},true);
$('term-search').oninput=()=>{if(editing){status('请先保存或取消正在修改的词条，再搜索。');return;}page=0;renderTerms();};
$('previous').onclick=()=>{if(guard()){page--;renderTerms();}};
$('next').onclick=()=>{if(guard()){page++;renderTerms();}};
$('glossary-mode').onchange=()=>{if(!guard()){$('glossary-mode').value=glossaryMode;return;}glossaryMode=$('glossary-mode').value;termChanged();page=0;renderTerms();};
let lastDirection=direction();
$('direction').onchange=()=>{if(!guard()||dirty){$('direction').value=lastDirection;if(dirty)status('请先导出备份；当前修改尚未保存，暂不能切换方向。');return;}lastDirection=direction();try{const latest=readSettings();glossaries[direction()]=cleanTerms(latest.glossaries?.[direction()]);}catch{}page=0;renderTerms();};
function exportTable(custom){if(editing){status('请先保存正在编辑的词条，再导出备份。');return;}download(`译名表-${custom?'自定义':'生效'}-${direction()}.json`,JSON.stringify({version:1,direction:direction(),...(!custom?{source:wikiSource.url,supplementalSources:[{url:wikiSource.placesURL}],attribution:'小马中文维基贡献者；部分译名来自 EquestriaCN、潮汐字幕社及其他译者'}:{}),terms:custom?editableTerms():terms()},null,2));}
$('export-custom').onclick=()=>exportTable(true);$('export-effective').onclick=()=>exportTable(false);
window.addEventListener('beforeunload',e=>{if(editing||dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{
  if(e.key!==storageKey&&e.key!==null)return;
  if(editing||dirty){status('另一个页面已更新设置。请先保存或导出当前修改；同方向的同时编辑以最后保存为准。');return;}
  try{const latest=readSettings();for(const d of ['en-zh','zh-en'])glossaries[d]=cleanTerms(latest.glossaries?.[d]);glossaryMode=initialGlossaryMode(latest,glossaries);renderTerms();status('已同步其他页面保存的专名表。');}catch{status('无法读取浏览器中的专名表。');}
});
renderTerms();status(loadFailed?'无法读取已有存储，请检查浏览器设置；保存前不会覆盖损坏数据。':'已读取此浏览器保存的词条。点击“保存”后生效。');
$('glossary-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!guard()){event.target.value='';return;}
  if(editing)renderTerms();
  try {
    const result=await importTerms(file);
    if(result.direction && result.direction!==direction())throw new Error('文件的翻译方向与当前设置不同，请先切换翻译方向再导入。');
    if(result.terms.length>5000)throw new Error('单次最多导入 5000 个词条。');
    pendingImport=result.terms.map(term=>({...term,selected:true,replace:false}));
    $('import-summary').textContent=`${file.name} · 识别到 ${pendingImport.length} 个词条`;
    renderImport();$('import-dialog').showModal();
  }catch(e){status(`导入失败：${e.message}`);}finally{event.target.value='';}
};
function renderImport() {
  $('import-rows').replaceChildren();
  pendingImport.forEach(term=>{
    const row=document.createElement('div');row.className='import-row';
    const check=document.createElement('input');check.type='checkbox';check.checked=true;check.setAttribute('aria-label','导入此词条');check.onchange=()=>term.selected=check.checked;
    const conflict=document.createElement('p');const select=document.createElement('select');select.setAttribute('aria-label','同名冲突处理');
    for(const [value,label]of [['keep','保留已有译名'],['replace','使用导入的译名']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
    select.onchange=()=>term.replace=select.value==='replace';
    const update=()=>{const old=editableTerms().find(t=>normalize(t.source)===normalize(term.source));conflict.textContent=old?`已有译名：${old.target}。重复导入的同名词条也按下方选择处理。`:'如果本次导入有同名词条，默认保留第一条。';};
    row.append(check,field(term.source,'导入原文',v=>{term.source=v;update();}),field(term.target,'导入译名',v=>term.target=v),conflict,select);update();$('import-rows').append(row);
  });
}
$('confirm-import').onclick=()=>{
  const selected=pendingImport.filter(t=>t.selected);
  if(selected.some(t=>!t.source.trim()||!t.target.trim())){alert('请补全选中词条的原文和译名。');return;}
  let added=0,updated=0,skipped=0;
  for(const t of selected){const old=editableTerms().find(x=>normalize(x.source)===normalize(t.source));const clean={source:t.source.trim(),target:t.target.trim(),aliases:t.aliases,note:t.note};if(old){if(t.replace){Object.assign(old,clean);updated++;}else skipped++;}else{editableTerms().push(clean);added++;}}
  if(selected.length && glossaryMode==='default')glossaryMode='combined';
  $('import-dialog').close();const stored=termChanged();renderTerms();if(stored)status(`已保存在此浏览器：新增 ${added} 条、更新 ${updated} 条、保留已有 ${skipped} 条。`);
};

