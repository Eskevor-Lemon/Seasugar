const $=id=>document.getElementById(id);
let defaults=[], custom=[], tabId, ready=false;
const status=text=>$('status').textContent=text;
function invalidate(){ $('preview').hidden=true; $('results').replaceChildren(); }
function info(){ $('table-info').textContent=`${$('mode').value==='default'?defaults.length:custom.length} 条 · 精确匹配大小写 · 所有替换均需预览确认`; }
async function run(action,args=[]){
  if(!ready)throw Error('尚未就绪，请关闭后重新打开扩展。');
  await chrome.scripting.executeScript({target:{tabId},files:['matcher.js','content.js']});
  const result=await chrome.scripting.executeScript({target:{tabId},func:(action,args)=>{
    try{return {ok:true,data:globalThis.SeasugarPage[action](...args)};}
    catch(e){return {ok:false,error:e.message};}
  },args:[action,args]});
  if(!result[0]?.result?.ok)throw Error(result[0]?.result?.error||'页面已变化，请重新打开扩展。');
  return result[0].result.data;
}
function bind(id,fn){$(id).onclick=async()=>{
  const buttons=[...document.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
  try{await fn();}catch(e){status(`未完成：${e.message}（浏览器设置页、商店、PDF 等页面不支持；请在普通网页使用。）`);}
  finally{buttons.forEach(b=>b.disabled=false);}
};}
bind('scan',async()=>{
  invalidate();const data=await run('scan',[$('mode').value==='default'?defaults:custom,$('scope').value==='page']);
  for(const m of data.results){
    const label=document.createElement('label');label.className='match';
    const check=document.createElement('input');check.type='checkbox';check.value=m.id;
    const text=document.createElement('span'),title=document.createElement('strong'),context=document.createElement('small');
    title.textContent=`${m.source} → ${m.target}`;context.textContent=m.context;text.append(title,context);label.append(check,text);$('results').append(label);
    check.dataset.target=m.target;
    if(m.variants?.length){
      const notes=document.createElement('small');notes.textContent=m.variants.map(v=>`${v.target}：${v.context}`).join('；');text.append(notes);
      if(new Set(m.variants.map(v=>v.target)).size>1){
        const select=document.createElement('select');select.setAttribute('aria-label',`${m.source} 的译名`);
        for(const target of new Set(m.variants.map(v=>v.target))){const option=document.createElement('option');option.value=target;option.textContent=target;select.append(option);}
        select.onchange=()=>{check.dataset.target=select.value;title.textContent=`${m.source} → ${select.value}`;};
        $('results').append(select);
      }
    }
  }
  $('preview').hidden=!data.results.length;
  status(`找到 ${data.results.length} 处，请勾选确认。${data.limited?'页面较大，扫描已达上限；可应用后再次扫描剩余内容。':''}`);
});
bind('apply',async()=>{
  const ids=[...$('results').querySelectorAll('input:checked')].map(n=>({id:n.value,target:n.dataset.target}));
  if(!ids.length){status('请先勾选需要保护的名字。');return;}
  const r=await run('apply',[ids]);invalidate();status(`已保护 ${r.applied} 处，跳过 ${r.skipped} 处已变化内容。现在请使用浏览器“翻译成中文”。`);
});
bind('restore',async()=>{const r=await run('restore');invalidate();status(`已恢复 ${r.restored} 处名字。${r.changed?`${r.changed} 处被网页或翻译器改写，未覆盖；可先显示原文再试，或刷新页面。`:''}`);});
bind('all',()=>{$('results').querySelectorAll('input').forEach(n=>n.checked=true);});
bind('none',()=>{$('results').querySelectorAll('input').forEach(n=>n.checked=false);});
bind('copy-default',()=>{if($('custom').value.trim()&&!confirm('替换编辑框中的内容？已保存词表不受影响。'))return;$('custom').value=defaults.map(r=>`${r.source} → ${r.target}`).join('\n');});
bind('save',async()=>{
  const rows=$('custom').value.split(/\r?\n/).filter(s=>s.trim()).map(s=>{
    const parts=s.split(/\t|→/);if(parts.length!==2)throw Error('每行需为“英文 → 中文”或两列制表符。');return {source:parts[0],target:parts[1]};
  });
  const checked=SeasugarMatcher.validate(rows);await chrome.storage.local.set({custom:checked,mode:'custom'});custom=checked;$('mode').value='custom';invalidate();info();status('自定义词表已保存在此浏览器，请重新扫描。');
});
$('file').onchange=async()=>{
  try{const file=$('file').files[0];if(!file)return;if(file.size>1024*1024)throw Error('文件不能超过 1 MB。');
    const text=await file.text();let rows;
    if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text.replace(/^\uFEFF/,''));if(data.direction&&data.direction!=='en-zh')throw Error('仅支持英译中词表。');rows=SeasugarMatcher.validate(Array.isArray(data)?data:data.terms);}
    else rows=SeasugarMatcher.validate(text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(s=>s.trim()).map(s=>{const p=s.split(/\t|→/);if(p.length!==2)throw Error('TXT / TSV 需要无表头的两列译名。');return {source:p[0],target:p[1]};}));
    if($('custom').value.trim()&&!confirm('用导入内容替换编辑框？'))return;
    $('custom').value=rows.map(r=>`${r.source} → ${r.target}`).join('\n');status('已载入编辑框，请核对后保存。JSON 导入只保留原文和译名，不自动采用别名或多义候选。');
  }catch(e){status(e.message);}finally{$('file').value='';}
};
bind('export',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify({direction:'en-zh',terms:custom},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='seasugar-custom.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$('mode').onchange=async()=>{invalidate();info();try{await chrome.storage.local.set({mode:$('mode').value});}catch(e){status(e.message);}};
$('scope').onchange=invalidate;
(async()=>{
  try{
    const data=await(await fetch('glossary.json')).json();defaults=SeasugarMatcher.validate(data.terms);
    const saved=await chrome.storage.local.get(['custom','mode']);custom=SeasugarMatcher.validate(saved.custom||[]);
    $('custom').value=custom.map(r=>`${r.source} → ${r.target}`).join('\n');$('mode').value=saved.mode==='custom'?'custom':'default';info();
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id;
    if(!Number.isInteger(tabId))throw Error('没有可用的当前标签页。');ready=true;
  }catch(e){status(`加载失败：${e.message}`);}
})();
