import './style.css';
import './pony-theme.css';
import { buildPacket } from './packet.js';
import { splitSource, glossaryProblems, relevantTerms, buildMessages, requestTranslation, endpointURL, hasExpectedTranslation } from './core.js';
import { readSettings, patchSettings, cleanTerms, storageKey } from './storage.js';
import { modelPresets } from './models.js';
import { activeGlossary, initialGlossaryMode } from './glossary.js';
const $ = id => document.getElementById(id);
let saved = {};
try { saved=readSettings(); } catch {}
const glossaries = {'en-zh':cleanTerms(saved?.glossaries?.['en-zh']), 'zh-en':cleanTerms(saved?.glossaries?.['zh-en'])};
let busy = false, controller, stopped = false, revision = 0, translatedSource = '', translatedDirection = '', notices = [];
const direction = () => $('direction').value;
let glossaryMode=initialGlossaryMode(saved,glossaries);
const terms = () => activeGlossary(glossaryMode,direction(),glossaries);
function status(text) { $('status').textContent = text; if($('api-view').hidden)$('packet-status').textContent=text; }
function showNotices() { $('notices').textContent = [...new Set(notices)].join('\n'); }
function note(text) { notices.push(text); showNotices(); }
function persist() {
  try { patchSettings({style:$('style').value, base:$('api-base').value, model:$('model').value, preset:$('model-preset').value, customConnection}); }
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
function renderTerms(){ $('glossary-mode').value=glossaryMode; $('term-count').textContent=terms().length; }
function syncGlossary(){
  try{const latest=readSettings();const incoming=latest.glossaries||{};
    const mode=initialGlossaryMode(latest,incoming);
    if(JSON.stringify(incoming)!==JSON.stringify(glossaries)||mode!==glossaryMode){
      for(const d of ['en-zh','zh-en'])glossaries[d]=cleanTerms(incoming[d]);
      glossaryMode=mode;revision++;renderTerms();packetStale();
    }
  }catch{note('无法读取保存的专名表，请检查浏览器存储设置。');}
}
window.addEventListener('storage',e=>{if(e.key===storageKey||e.key===null)syncGlossary();});
window.addEventListener('focus',syncGlossary);
$('glossary-mode').onchange=()=>{glossaryMode=$('glossary-mode').value;try{patchSettings({glossaryMode});}catch{note('模式未能保存，请检查浏览器存储设置。');}revision++;renderTerms();};
$('direction').onchange=()=>{const en=direction()==='en-zh';$('only-label').textContent=en?'只翻译英文':'只翻译中文';$('source-lang').textContent=en?'ENGLISH':'中文';$('target-lang').textContent=en?'中文':'ENGLISH';renderTerms();};
function setBusy(value){
  busy=value;
  for(const id of ['view-toggle','translate','retranslate','direction','only-source','source-file','clear','api-base','api-key','model','model-preset','style'])$(id).disabled=value;
  $('source').readOnly=value;$('output').readOnly=value;$('stop').hidden=!value;$('stop').disabled=false;
}
async function translate(partial=false){
  if(busy)return;
  syncGlossary();
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
      const missing=relevantTerms(paragraph.text,snapshot).filter(t=>!hasExpectedTranslation(result,t));
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

let apiView=false;
$('view-toggle').onclick=()=>{
  if(busy)return;
  apiView=!apiView;
  $('api-view').hidden=!apiView;$('packet-view').hidden=apiView;
  $('settings-toggle').hidden=!apiView;
  $('view-toggle').textContent='API 翻译';
  $('view-toggle').setAttribute('aria-pressed',String(apiView));
  if(!apiView){$('settings-panel').hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');}
};
function packetStale(){
  $('packet-count').textContent=`${$('packet-input').value.length} 字符`;
  if($('packet-output').value)$('packet-status').textContent='输入或设置已更新，请重新生成资料包后复制。';
}
$('packet-input').addEventListener('input',packetStale);
for(const id of ['direction','only-source','style','glossary-mode']){
  $(id).addEventListener('input',packetStale);$(id).addEventListener('change',packetStale);
}
function generatePacket(){
  syncGlossary();
  const problems=glossaryProblems(terms());if(problems.length)throw new Error(problems[0]);
  const result=buildPacket({text:$('packet-input').value,terms:terms(),direction:direction(),onlySource:$('only-source').checked,style:$('style').value});
  $('packet-output').value=result.output;
  $('packet-status').textContent=`已生成 · ${result.count} 条相关专名 · ${result.output.length} 字符。请核对后复制到 DeepSeek；过长时可按章节分批。`;
  return result.output;
}
$('packet-generate').onclick=()=>{try{generatePacket();}catch(e){$('packet-status').textContent=e.message;}};
$('packet-copy').onclick=async()=>{try{const text=generatePacket();await navigator.clipboard.writeText(text);$('packet-status').textContent='已按最新输入与设置生成并复制资料包。';}catch(e){$('packet-status').textContent=`复制未完成：${e.message}。可手动选择右侧内容复制。`;}};
$('packet-export').onclick=()=>{try{download('翻译资料包.txt',generatePacket());}catch(e){$('packet-status').textContent=e.message;}};
$('packet-clear').onclick=()=>{if($('packet-input').value&&!confirm('清空资料包输入和输出？'))return;$('packet-input').value='';$('packet-output').value='';packetStale();$('packet-status').textContent='已清空。';};
window.addEventListener('beforeunload',event=>{if($('packet-input').value){event.preventDefault();event.returnValue='';}});

// Allow the shared navigation on guide/about pages to open the API workspace.
if(location.hash==='#api')$('view-toggle').click();

$('back-to-packet').onclick=()=>{if(apiView)$('view-toggle').click();};
