// New sandbox seed only. Never edits the immutable host or product.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),crypto=require('node:crypto');
const originalPath=process.env.TSIMM_TEST_SCRIPT||path.resolve(__dirname,'../../TornScripture-Item-Market-Margin.user.js');
const originalSource=fs.readFileSync(originalPath,'utf8');
const writerStart=originalSource.indexOf('  function saveTraderPriceCapture(');
const writerEnd=originalSource.indexOf('\n  function ',writerStart+1);
const writer=originalSource.slice(writerStart,writerEnd),marker='    const context = captureStoreContext();';
assert.equal(writer.split(marker).length,2);
const observation="    const calls = globalThis.__C05_NATIVE_CALLBACKS__ ||= { priceCalls: 0, zeroCalls: 0 };\n    if (items.length) calls.priceCalls++; else calls.zeroCalls++;\n";
const instrumentedSource=originalSource.slice(0,writerStart)+writer.replace(marker,observation+marker)+originalSource.slice(writerEnd);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tsimm-c05-native-'));
const observedPath=path.join(dir,'observed.user.js');fs.writeFileSync(observedPath,instrumentedSource);
process.env.TSIMM_TEST_SCRIPT=observedPath;
const instrumentation={originalPath,originalSHA256:crypto.createHash('sha256').update(originalSource).digest('hex'),instrumentedSHA256:crypto.createHash('sha256').update(instrumentedSource).digest('hex'),insertion:'one observer immediately before existing captureStoreContext inside shared writer; no control-flow or return changes'};
const {fixture,K,PENDING}=require('./imm-receipt-harness.cjs');
const permutations=[['a','b'],['b','a']];
const spec={a:{opaque:{owner:'a',role:'selected',keep:[false,null,{raw:' selected-a '}]},pricingItems:[{name:'old alias a',price:'500',unknown:{owner:'a',raw:' retain-a '}}],canonical:{owner:'a',historical:true}},b:{opaque:{owner:'b',role:'neighbor',keep:[true,0,{raw:' neighbor-b '}]},pricingItems:[{name:'old alias b',price:'500',unknown:{owner:'b',raw:' retain-b '}}],canonical:{owner:'b',historical:true}}};
const clone=v=>JSON.parse(JSON.stringify(v));
function byId(book,id){const found=book.filter(t=>t.id===id);assert.equal(found.length,1,'exact unique trader '+id);return found.find(t=>t.id===id);}
async function seed(text,order,catalog=[]){assert.ok(permutations.some(p=>JSON.stringify(p)===JSON.stringify(order)));const p=await fixture({twoTraders:true});for(const item of catalog){const entry={...item,normalizedName:p.api.normalizeName(item.name)};p.state.catalog.itemsByName[entry.normalizedName]=entry;p.state.catalog.itemsById[entry.id]=entry;}p.open('sale-original',text);p.state.receiptAuditDraft.rawText=text;
 const original=JSON.parse(p.memory.get(K.book));assert.equal(original.length,2);
 for(const id of ['a','b']){const trader=byId(original,id),s=spec[id];assert.equal(trader.pricePageCaptureCount,7);assert.equal(trader.pricePageItems.find(i=>i.itemId===1).unitPrice,500);trader.opaque=clone(s.opaque);trader.pricingItems=clone(s.pricingItems);trader.pricePageItems.find(i=>i.itemId===1).opaque=clone(s.canonical);}
 const ordered=order.map(id=>byId(original,id));p.memory.set(K.book,JSON.stringify(ordered));const file=path.join(__dirname,'../fixtures/classifier05/seed-templates-correction-03.json');if(fs.existsSync(file)){const template=JSON.parse(fs.readFileSync(file))[order.join(',')];assert.equal(p.memory.get(K.book),template.book);p.memory.set(PENDING,template.pending);p.state.pendingTraderCapture=JSON.parse(template.pending);}p.seedOrder=order.slice();return p;
}
function snapshot(p){const rawBook=p.memory.get(K.book),book=JSON.parse(rawBook);return {rawBook,order:book.map(t=>t.id),bookById:Object.fromEntries(book.map(t=>[t.id,t])),memory:Object.fromEntries(p.memory),session:Object.fromEntries(p.session),input:p.input.value,clock:p.clock.now,catalog:JSON.stringify(p.state.catalog),traders:JSON.stringify(p.state.traders),ledger:JSON.stringify(p.state.ledger),draft:JSON.stringify(p.state.receiptAuditDraft),writes:clone(p.writes),pending:p.memory.get(PENDING)??null,pendingState:clone(p.state.pendingTraderCapture),captureRevision:p.state.pendingTraderCaptureRevision,sevenStores:Object.fromEntries(p.protectedBytes),navigations:clone(p.navigations)};}
module.exports={seed,snapshot,byId,spec,permutations,K,PENDING,instrumentation};
