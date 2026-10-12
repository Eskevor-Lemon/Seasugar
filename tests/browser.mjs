import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try {
 await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
 const upload=async(name,buffer)=>{await page.locator('#glossary-file').setInputFiles({name,mimeType:'application/octet-stream',buffer});await page.locator('#import-dialog').waitFor({state:'visible'});await page.locator('#confirm-import').click();};
 await upload('names.csv',Buffer.from('原文,译名\nMoztrot,莫扎蹄'));
 assert.equal(await page.locator('#term-count').textContent(),'1');
 await upload('conflict.csv',Buffer.from('原文,译名\nMoztrot,错误译名'));
 assert.equal(await page.locator('#terms input').nth(1).inputValue(),'莫扎蹄');
 const docx=zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>原文</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>译名</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Prance</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>法兰嘶</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')});
 await upload('names.docx',Buffer.from(docx));
 const xlsx=zipSync({'xl/worksheets/sheet1.xml':strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Fortepiano</t></is></c><c r="B1" t="inlineStr"><is><t>古钢琴</t></is></c></row></sheetData></worksheet>')});
 await upload('names.xlsx',Buffer.from(xlsx));assert.equal(await page.locator('#term-count').textContent(),'3');
 await page.locator('#direction').selectOption('zh-en');assert.equal(await page.locator('#term-count').textContent(),'0');assert.equal(await page.locator('#only-label').textContent(),'只翻译中文');await page.locator('#direction').selectOption('en-zh');
 await page.locator('#settings-toggle').click();await page.locator('#model-preset').selectOption('custom');await page.locator('#api-base').fill('https://translation.example/v1');await page.locator('#model').fill('test-model');await page.locator('#api-key').fill('secret-for-testing');
 const requests=[];let responseIndex=0;let slow=false;
 await page.route('https://translation.example/**',async route=>{
  const body=route.request().postDataJSON();requests.push(body);
  if(slow)await new Promise(r=>setTimeout(r,1200));
  const content=JSON.stringify({translation:responseIndex++===0?'莫扎蹄走进房间。':'他坐了下来。'});
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]})}).catch(()=>{});
 });
 await page.locator('#source').fill('Moztrot entered.\n\nHe sat down.');await page.locator('#translate').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('翻译完成'));
 assert.equal(await page.locator('#output').inputValue(),'莫扎蹄走进房间。\n\n他坐了下来。');assert.equal(requests.length,2);assert.ok(requests[0].messages[0].content.includes('只翻译其中的英文'));
 await page.locator('#output').fill('手工润色，必须保留。\n\n他坐了下来。');await page.locator('.partial-controls summary').click();await page.locator('#range-start').fill('2');await page.locator('#range-end').fill('2');await page.locator('#retranslate').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('翻译完成'));
 assert.ok((await page.locator('#output').inputValue()).startsWith('手工润色，必须保留。'));
 slow=true;await page.locator('#translate').click();await page.locator('#stop').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('已停止'));assert.equal(await page.locator('#source').getAttribute('readonly'),null);
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!storage.includes('secret-for-testing'));assert.ok(!storage.includes('Moztrot entered.'));
 await page.reload();assert.equal(await page.locator('#api-key').inputValue(),'');assert.equal(await page.locator('#term-count').textContent(),'3');
 await page.locator('#source').fill('Moztrot entered the quiet room.\n\nGuten Abend. (Good evening.)');
 await page.screenshot({path:process.env.SCREENSHOT_PATH || 'test-results/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: CSV/DOCX/XLSX, conflicts, direction, translation, partial update, stop, storage, responsive layout.');
} finally {await browser.close();}
