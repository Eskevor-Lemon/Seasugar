document.getElementById('test').onclick=()=>{
  const out=document.getElementById('result');
  try{
    const assert=(v,m)=>{if(!v)throw Error(m);};
    const rows=[{source:'Twilight Sparkle',target:'暮光闪闪'},{source:'Twilight',target:'暮光'},{source:'Rarity',target:'瑞瑞'}];
    const scan=SeasugarPage.scan(rows,false);
    assert(scan.results.length===4,'scan count / excluded fields');
    document.getElementById('stale').textContent='Page changed';
    const result=SeasugarPage.apply(scan.results.map(m=>m.id));
    assert(result.applied===3&&result.skipped===1,'stale node skipped');
    assert(document.querySelectorAll('[data-seasugar-protected][translate="no"]').length===3,'protection markers');
    assert(SeasugarPage.scan(rows,false).results.length===0,'no double replacement');
    const span=document.querySelector('[data-seasugar-protected]');span.textContent='external update';
    const restore=SeasugarPage.restore();assert(restore.restored===2&&restore.changed===1,'safe restoration');
    span.textContent='暮光闪闪';assert(SeasugarPage.restore().restored===1,'retry restoration');
    assert(document.getElementById('story').textContent==="Twilight Sparkle met Twilight. Rarity's rarity is rare.",'original restored');
    out.textContent='PASS: scan, exclusions, longest match, stale-node skip, markers, repeat scan, safe restore';
  }catch(e){out.textContent='FAIL: '+e.message;}
};
