import './style.css';
import './pony-theme.css';
import { splitSource, normalize, glossaryProblems, relevantTerms, buildMessages, requestTranslation, endpointURL } from './core.js';
import { importTerms } from './import.js';
import { modelPresets } from './models.js';
import { activeGlossary, initialGlossaryMode, wikiSource } from './glossary.js';
const $ = id => document.getElementById(id);
const storageKey = 'mlp-translation-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* A blocked or corrupt store starts a fresh session. */ }
const cleanTerms = items => Array.isArray(items) ? items.filter(t=>t && typeof t.source==='string' && typeof t.target==='string').map(t=>({source:t.source,target:t.target,aliases:typeof t.aliases==='string'?t.aliases:'',note:typeof t.note==='string'?t.note:''})) : [];
const glossaries = {'en-zh':cleanTerms(saved?.glossaries?.['en-zh']), 'zh-en':cleanTerms(saved?.glossaries?.['zh-en'])};
let busy = false, controller, stopped = false, revision = 0, translatedSource = '', translatedDirection = '', pendingImport = [], notices = [];
const direction = () => $('direction').value;
let glossaryMode=initialGlossaryMode(saved,glossaries);
const terms = () => activeGlossary(glossaryMode,direction(),glossaries);
function status(text) { $('status').textContent = text; }
function showNotices() { $('notices').textContent = [...new Set(notices)].join('\n'); }
function note(text) { notices.push(text); showNotices(); }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({glossaries, glossaryMode, style:$('style').value, base:$('api-base').value, model:$('model').value, preset:$('model-preset').value, customConnection})); }
  catch { note('浏览器无法保存设置，请导出专名表备份。'); }
}
for (const [id, key] of [['style','style'],['api-base','base'],['model','model']]) {
  $(id).value = typeof saved?.[key] === 'string' ? saved[key] : '';
  $(id).addEventListener('input',()=>{
    if(id==='api-base') { $('api-key').value=''; destination(); }
    if($('model-preset').value==='custom') customConnection={base:$('api-base').value,model:$('model').value};
    persist();
  });
}
let customConnection = saved?.customConnection && typeof saved.customConnection.base==='string' && typeof saved.customConnection.model==='string'
  ? saved.customConnection : {base:typeof saved?.base==='string'?saved.base:'',model:typeof saved?.model==='string'?saved.model:''};
for(const [id,preset] of Object.entries(modelPresets)) {
  const option=document.createElement('option');option.value=id;option.textContent=preset.label;$('model-preset').append(option);
}
const customOption=document.createElement('option');customOption.value='custom';customOption.textContent='连接其他翻译模型（自定义）';$('model-preset').append(customOption);
$('model-preset').value = Object.hasOwn(modelPresets,saved?.preset)?saved.preset:saved?.base?'custom':'gemini';
function applyPreset() {
  const preset=modelPresets[$('model-preset').value];
  $('api-base').value=preset?.base || customConnection.base;
  $('model').value=preset?.model || customConnection.model;
  $('api-base').readOnly=!!preset;$('model').readOnly=!!preset;
  $('preset-note').textContent=preset?.note || '填写兼容 Chat Completions 的 API 地址和模型名称；是否免费由你选择的服务商决定。';
  $('preset-links').hidden=!preset;
  if(preset){$('get-api-key').href=preset.keyURL;$('model-docs').href=preset.docsURL;}
  destination();
}
applyPreset();
$('model-preset').onchange=()=>{ $('api-key').value='';applyPreset();persist();status('模型已切换，请填写对应平台的 API Key。'); };
function destination() {
  try { $('destination').textContent = new URL(endpointURL($('api-base').value)).origin; }
  catch { $('destination').textContent = '尚未设置有效地址'; }
}
destination();
$('settings-toggle').onclick = () => { $('settings-panel').hidden = !$('settings-panel').hidden; $('settings-toggle').setAttribute('aria-expanded', String(!$('settings-panel').hidden)); };
$('settings-toggle').setAttribute('aria-expanded','false');
function counts() {
  const {paragraphs} = splitSource($('source').value);
  $('source-count').textContent = `${$('source').value.length} 字符 · ${paragraphs.length} 段`;
  $('output-count').textContent = `${$('output').value.length} 字符`;
}
$('source').oninput = counts; $('output').oninput = counts;
function download(name, text, type='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export').onclick = ()=>download('译文.txt',$('output').value);
$('copy').onclick = async()=>{try {await navigator.clipboard.writeText($('output').value);status('译文已复制。');}catch{status('无法自动复制，请选中译文后手动复制。');}};
$('clear').onclick = ()=>{if($('source').value && !confirm('清空原文？现有译文会保留。'))return;$('source').value='';counts();};
$('source-file').onchange = async event=>{
  const file=event.target.files[0]; if(!file)return;
  try {if(file.size>1024*1024)throw new Error('原文文件最大 1 MB。'); if($('source').value && !confirm('用导入文件替换当前原文？'))return; $('source').value=await file.text();counts();status('原文已导入。');}catch(e){status(e.message);}finally{event.target.value='';}
};
function termChanged() {
  revision++; persist(); $('term-count').textContent=terms().length;
  notices=notices.filter(n=>!n.startsWith('专名表已更新')&&!n.startsWith('专名冲突：'));
  if($('output').value)notices.push('专名表已更新：后续请求使用新译名。已有译文不会自动覆盖，可在「更新已有译文」中重译相关段落。');
  for(const p of glossaryProblems(terms()))notices.push('专名冲突：'+p);
  showNotices();
}
function field(value, placeholder, oninput) {const input=document.createElement('input');input.value=value;input.placeholder=placeholder;input.setAttribute('aria-label',placeholder);input.oninput=()=>oninput(input.value);return input;}
function renderTerms() {
  const isDefault=glossaryMode==='default';
  $('glossary-mode').value=glossaryMode;
  $('add-term').hidden=isDefault;
  $('custom-glossary-tools').hidden=isDefault;
  $('wiki-credit').hidden=!isDefault;
  $('glossary-description').textContent=isDefault?'采用小马灰机 Wiki 的角色译名。需要修改或上传译名表时，请切换到「自定义」。':'随时调整译名，下一段翻译即会采用。';
  const container=$('terms');container.replaceChildren();const search=normalize($('term-search').value);
  terms().forEach((term,index)=>{
    if(search && !normalize(`${term.source} ${term.target} ${term.aliases}`).includes(search))return;
    const item=document.createElement('div');item.className='term';
    if(isDefault){
      item.classList.add('default-term');
      const source=document.createElement('strong');source.textContent=term.source;
      const target=document.createElement('span');target.textContent=term.target;
      const link=document.createElement('a');link.href=term.page;link.target='_blank';link.rel='noreferrer';link.textContent='词条 ↗';link.setAttribute('aria-label',`查看 ${term.source} 的 Wiki 词条`);
      item.append(source,target,link);
      if(term.aliases){const aliases=document.createElement('small');aliases.textContent=`别名：${term.aliases.split(';').join(' / ')}`;item.append(aliases);}
      container.append(item);return;
    }
    const fields=document.createElement('div');fields.className='term-fields';
    for(const [key,placeholder] of [['source','原文'],['target','译名']])fields.append(field(term[key],placeholder,v=>{term[key]=v;termChanged();}));
    const meta=document.createElement('div');meta.className='term-meta';meta.append(field(term.aliases,'别名（用 ; 分隔）',v=>{term.aliases=v;termChanged();}));
    const remove=document.createElement('button');remove.textContent='删除';remove.setAttribute('aria-label',`删除词条 ${term.source || index+1}`);remove.onclick=()=>{terms().splice(index,1);termChanged();renderTerms();};meta.append(remove);
    const memo=field(term.note,'备注（可选）',v=>{term.note=v;termChanged();});memo.style.marginTop='6px';
    item.append(fields,meta,memo);container.append(item);
  });
  $('term-count').textContent=terms().length;$('empty-terms').hidden=terms().length>0;
  $('no-term-matches').hidden=!search || container.childElementCount>0 || terms().length===0;
}
$('wiki-link').href=wikiSource.url;
$('wiki-date').textContent=wikiSource.date;
$('glossary-mode').onchange=()=>{glossaryMode=$('glossary-mode').value;$('term-search').value='';termChanged();renderTerms();status(`已切换到${glossaryMode==='default'?'默认专名表':'自定义专名表'}，下一段请求即会采用。`);};
$('term-search').oninput=renderTerms;
$('add-term').onclick=()=>{if(glossaryMode!=='custom')return;terms().push({source:'',target:'',aliases:'',note:''});$('term-search').value='';termChanged();renderTerms();$('terms').lastElementChild?.querySelector('input')?.focus();};
$('export-glossary').onclick=()=>download(`译名表-${glossaryMode}-${direction()}.json`,JSON.stringify({version:1,direction:direction(),...(glossaryMode==='default'?{attribution:'小马中文维基贡献者；部分译名来自 EquestriaCN、潮汐字幕社及其他译者',source:wikiSource.url,retrieved:wikiSource.date}:{}),terms:terms()},null,2),'application/json');
$('direction').onchange=()=>{
  const en=direction()==='en-zh';$('only-label').textContent=en?'只翻译英文':'只翻译中文';$('source-lang').textContent=en?'ENGLISH':'中文';$('target-lang').textContent=en?'中文':'ENGLISH';
  $('term-search').value='';renderTerms();status('翻译方向已切换，专名表单独管理。');
};
$('glossary-file').onchange=async event=>{
  if(glossaryMode!=='custom'){event.target.value='';return;}
  const file=event.target.files[0];if(!file)return;
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
    const update=()=>{const old=terms().find(t=>normalize(t.source)===normalize(term.source));conflict.textContent=old?`已有译名：${old.target}。重复导入的同名词条也按下方选择处理。`:'如果本次导入有同名词条，默认保留第一条。';};
    row.append(check,field(term.source,'导入原文',v=>{term.source=v;update();}),field(term.target,'导入译名',v=>term.target=v),conflict,select);update();$('import-rows').append(row);
  });
}
$('confirm-import').onclick=()=>{
  if(glossaryMode!=='custom')return;
  const selected=pendingImport.filter(t=>t.selected);
  if(selected.some(t=>!t.source.trim()||!t.target.trim())){alert('请补全选中词条的原文和译名。');return;}
  let added=0,updated=0,skipped=0;
  for(const t of selected){const old=terms().find(x=>normalize(x.source)===normalize(t.source));const clean={source:t.source.trim(),target:t.target.trim(),aliases:t.aliases,note:t.note};if(old){if(t.replace){Object.assign(old,clean);updated++;}else skipped++;}else{terms().push(clean);added++;}}
  $('import-dialog').close();termChanged();renderTerms();status(`已新增 ${added} 条、更新 ${updated} 条、保留已有 ${skipped} 条。`);
};
function setBusy(value){
  busy=value;
  for(const id of ['translate','retranslate','direction','only-source','source-file','clear','api-base','api-key','model','model-preset','style'])$(id).disabled=value;
  $('source').readOnly=value;$('output').readOnly=value;$('stop').hidden=!value;$('stop').disabled=false;
}
async function translate(partial=false){
  if(busy)return;
  const text=$('source').value;const {lines,paragraphs}=splitSource(text);
  if(!paragraphs.length){status('请先输入原文。');return;}
  if(paragraphs.some(p=>p.text.length>12000)){status('有单段超过 12000 字符，请先拆分该段。');return;}
  const problems=glossaryProblems(terms());if(problems.length){status(problems[0]);return;}
  try{endpointURL($('api-base').value);}catch(e){$('settings-panel').hidden=false;status(e.message);return;}
  if(!$('model').value.trim()){ $('settings-panel').hidden=false;status('请先填写模型名称。');return; }
  if($('model-preset').value!=='custom' && !$('api-key').value.trim()){ $('settings-panel').hidden=false;$('settings-toggle').setAttribute('aria-expanded','true');status('请填写所选模型对应平台的 API Key。');$('api-key').focus();return; }
  let selected=paragraphs, outputLines;
  if(partial){
    if(translatedSource!==text || translatedDirection!==direction()){status('原文或方向已变化，请重新进行完整翻译。');return;}
    const start=Number($('range-start').value),end=Number($('range-end').value);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>paragraphs.length){status('请输入有效的段落范围。');return;}
    outputLines=$('output').value.split('\n');
    if(outputLines.length!==lines.length){status('译文分段已被手动修改，无法安全定位。请恢复分段或重新完整翻译。');return;}
    selected=paragraphs.slice(start-1,end);
    if(!confirm(`重译第 ${start}—${end} 段？这些段落中的手工修改将被替换。`))return;
  }else{
    if($('output').value && !confirm('开始完整翻译将替换当前译文，是否继续？'))return;
    outputLines=lines.map(line=>line.trim()?'':line);
    $('output').value=outputLines.join('\n');translatedSource=text;translatedDirection=direction();
  }
  notices=[];showNotices();setBusy(true);stopped=false;
  const settings={base:$('api-base').value,key:$('api-key').value.trim(),model:$('model').value.trim(),direction:direction(),onlySource:$('only-source').checked,style:$('style').value};
  let completed=0;
  try{
    for(const paragraph of selected){
      if(stopped)break;
      const index=paragraphs.indexOf(paragraph);status(`正在翻译第 ${index+1} / ${paragraphs.length} 段…`);
      const snapshot=terms().map(t=>({...t})), requestRevision=revision;
      const errors=glossaryProblems(snapshot);if(errors.length)throw new Error(`专名表发生变化：${errors[0]}`);
      controller=new AbortController();let timedOut=false;
      const timeout=setTimeout(()=>{timedOut=true;controller.abort();},120000);
      let result;
      try{result=await requestTranslation({...settings,signal:controller.signal,messages:buildMessages({...settings,text:paragraph.text,before:paragraphs[index-1]?.text.slice(-1500),after:paragraphs[index+1]?.text.slice(0,1500),terms:snapshot})});}
      catch(e){if(timedOut)throw new Error('请求超过两分钟，已停止。可重译未完成的段落。');throw e;}finally{clearTimeout(timeout);}
      if(stopped)break;
      const leading=paragraph.text.match(/^\s*/)[0],trailing=paragraph.text.match(/\s*$/)[0];outputLines[paragraph.line]=leading+result+trailing;
      $('output').value=outputLines.join('\n');counts();completed++;
      if(requestRevision!==revision)note(`第 ${index+1} 段使用了修改前的专名表，可在完成后重译。`);
      const missing=relevantTerms(paragraph.text,snapshot).filter(t=>!result.includes(t.target));
      if(missing.length)note(`第 ${index+1} 段请核对专名：${missing.map(t=>`${t.source} → ${t.target}`).join('；')}（仅作提示，也可能属于保留外语或普通词义）。`);
    }
    status(stopped?`已停止，保留本次完成的 ${completed} 段。`:`翻译完成 · 本次完成 ${completed} 段，请核对人物口吻与外语保留。`);
  }catch(e){
    if(stopped || e.name==='AbortError')status(`已停止，保留本次完成的 ${completed} 段。`);
    else{status(`翻译中断，已保留 ${completed} 段。`);note(e instanceof TypeError?'网络连接失败。请检查 API 地址、网络或服务商的浏览器跨域（CORS）支持。':e.message);}
  }finally{controller=null;setBusy(false);counts();}
}
$('translate').onclick=()=>translate();$('retranslate').onclick=()=>translate(true);
$('stop').onclick=()=>{stopped=true;controller?.abort();$('stop').disabled=true;status('正在停止…');};
window.addEventListener('beforeunload',event=>{if(busy || $('source').value || $('output').value){event.preventDefault();event.returnValue='';}});
renderTerms();counts();
