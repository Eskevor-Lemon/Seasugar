import fs from 'node:fs';
import { defaultGlossaries } from '../../src/glossary.js';
const wiki=JSON.parse(fs.readFileSync(new URL('../../src/wiki-glossary.json',import.meta.url),'utf8'));
const terms=defaultGlossaries['en-zh'].map(({source,target,variants})=>({source,target,variants}));
fs.writeFileSync(new URL('glossary.json',import.meta.url),JSON.stringify({source:wiki.source,retrieved:wiki.retrieved,policy:wiki.policy,entryCount:wiki.entries.length,terms},null,2)+'\n');
console.log(`Built ${terms.length} terms from all ${wiki.entries.length} Wiki rows, including aliases and translation choices.`);
