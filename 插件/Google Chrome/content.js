(() => {
  if (globalThis.SeasugarPage) return;
  let candidates = new Map(), generation = 0;
  const protectedNames = new Map();
  const excluded = 'script,style,noscript,textarea,input,select,option,button,code,pre,svg,math,iframe,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-seasugar-protected],nav,header,footer';
  const eligible = node => node.isConnected && node.parentElement && !node.parentElement.closest(excluded) && !node.parentElement.isContentEditable;
  function scan(rows, wholePage) {
    candidates.clear(); generation++;
    const compiled = SeasugarMatcher.compile(SeasugarMatcher.validate(rows));
    const root = wholePage ? document.body : document.querySelector('article,main,[role="main"]');
    if (!root) throw Error('未识别到正文区域，请选择“页面正文文本”后重试。');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const results = []; let node, chars=0, nodes=0, limited=false;
    while ((node=walker.nextNode())) {
      if (++nodes > 20000 || chars > 1000000 || results.length >= 1000) { limited=true; break; }
      if (!eligible(node) || !node.textContent.trim() || !node.parentElement.getClientRects().length || getComputedStyle(node.parentElement).visibility==='hidden') continue;
      const original=node.textContent; chars+=original.length;
      if(original.length>50000) {limited=true; continue;}
      for (const m of SeasugarMatcher.find(original, compiled)) {
        if(results.length>=1000){limited=true;break;}
        const id=`${generation}:${results.length}`;
        candidates.set(id,{node,original,...m});
        results.push({id,source:m.source,target:m.target,context:original.slice(Math.max(0,m.start-45),m.end+65)});
      }
    }
    return {results,limited};
  }
  function apply(ids) {
    const groups=new Map(); let skipped=0, applied=0;
    for(const id of new Set(ids)) {
      const m=candidates.get(id);
      if(!m || !eligible(m.node) || m.node.textContent!==m.original){skipped++;continue;}
      if(!groups.has(m.node))groups.set(m.node,[]);
      groups.get(m.node).push(m);
    }
    for(const [node,matches] of groups) {
      matches.sort((a,b)=>a.start-b.start);
      const fragment=document.createDocumentFragment(); let cursor=0;
      for(const m of matches){
        fragment.append(document.createTextNode(m.original.slice(cursor,m.start)));
        const span=document.createElement('span');
        span.setAttribute('translate','no'); span.className='notranslate';
        span.dataset.seasugarProtected=''; span.textContent=m.target;
        span.title=`Seasugar：${m.source} → ${m.target}`;
        protectedNames.set(span,{original:m.source,target:m.target});
        fragment.append(span); cursor=m.end; applied++;
      }
      fragment.append(document.createTextNode(node.textContent.slice(cursor)));
      node.replaceWith(fragment);
    }
    candidates.clear();
    return {applied,skipped};
  }
  function restore(){
    let restored=0,changed=0;
    for(const [span,record] of protectedNames){
      if(!span.isConnected){protectedNames.delete(span);continue;}
      if(span.textContent!==record.target){changed++;continue;}
      span.replaceWith(document.createTextNode(record.original)); protectedNames.delete(span); restored++;
    }
    candidates.clear(); return {restored,changed};
  }
  globalThis.SeasugarPage={scan,apply,restore};
})();
