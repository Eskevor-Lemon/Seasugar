import fs from 'node:fs';
const wiki=JSON.parse(fs.readFileSync(new URL('../../src/wiki-glossary.json',import.meta.url),'utf8'));
const names=['Twilight Sparkle','Rainbow Dash','Pinkie Pie','Fluttershy','Applejack','Rarity','Princess Celestia','Princess Luna','Princess Cadance','Shining Armor','Starlight Glimmer','Sunset Shimmer','Trixie Lulamoon','Sweetie Belle','Apple Bloom','Scootaloo','Big McIntosh','Granny Smith','Cheerilee','Zecora','Ponyville','Canterlot','Cloudsdale','Manehattan','Everfree Forest','Crystal Empire'];
// Only select exact, unambiguous rows from the existing attributed snapshot.
const terms=names.flatMap(source=>{
  const found=wiki.entries.filter(e=>e.en===source&&!e.untranslated&&['角色名称','地点名称'].includes(e.group));
  const targets=[...new Set(found.map(e=>e.zh))];
  return targets.length===1&&!targets[0].includes('\n')?[{source,target:targets[0]}]:[];
});
fs.writeFileSync(new URL('glossary.json',import.meta.url),JSON.stringify({source:wiki.source,retrieved:wiki.retrieved,terms},null,2)+'\n');
console.log(`Built ${terms.length} curated entries; excluded: ${names.filter(n=>!terms.some(t=>t.source===n)).join(', ')}`);
