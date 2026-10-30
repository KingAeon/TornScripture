// Additional original-frozen110 witnesses and non-vacuous oracle sensitivities.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {seed,snapshot,permutations,K}=require('./helpers/imm-classifier05-harness.cjs');
const E=process.env.C05_SENSITIVITY_EVIDENCE||fs.mkdtempSync(path.join(os.tmpdir(),'c05-sensitivity-'));fs.mkdirSync(E,{recursive:true});let n=0;
const snap=p=>({...snapshot(p),callbacks:{priceCalls:p.sandbox.__C05_NATIVE_CALLBACKS__?.priceCalls||0,zeroCalls:p.sandbox.__C05_NATIVE_CALLBACKS__?.zeroCalls||0}});
function guard(before,after){assert.equal(after.rawBook,before.rawBook,'book bytes');assert.deepEqual(after.bookById.a,before.bookById.a,'selected trader');assert.deepEqual(after.bookById.b,before.bookById.b,'neighbor trader');assert.equal(after.pending,before.pending,'arm bytes');assert.equal(after.callbacks.priceCalls,0,'price callback');assert.equal(after.callbacks.zeroCalls,0,'zero callback');assert.equal(after.writes.filter(([k])=>k===K.book).length,0,'Book write log');assert.deepEqual(after.sevenStores,before.sevenStores,'seven stores');assert.equal(after.input,before.input,'input retained');assert.deepEqual(after.session,before.session,'session retained');assert.equal(after.clock,before.clock,'clock retained');}
for(const mode of['unknown','catalog','exact-conflict'])for(const order of permutations)for(const first of[false,true])test(`original frozen110 whole damaged field ${mode} ${order} first${first}`,async()=>{const catalog=mode==='unknown'?[]:[{id:1,name:'Fixture Item'},{id:2,name:'Other Item'},...(mode==='exact-conflict'?[{id:5,name:'Other Item × 0'}]:[])],bad='bad x Other Item @ $1234 = $2468',good='Fixture Item x2 @ $1234 = $2468',text=(first?[bad,good]:[good,bad]).join('\r\n'),p=await seed(text,order,catalog),before=snap(p);await p.link();await p.drain();const after=snap(p),record={mode,order,first,before,after,negativeControls:[]};const file=path.join(E,String(++n).padStart(3,'0')+'.json');fs.writeFileSync(file,JSON.stringify(record,null,2));
 guard(before,after);p.assertAccounting();assert.equal(p.api.admitTraderReceiptText(text,p.api.parseReceiptInput(text),catalog).outcome,'REJECT');
 // Every negative starts from the known-PASS rejection baseline above. Each
 // changes exactly one independent observed field; failure cause is checked.
 for(const [fault,reason,mutate]of[
  ['wrong-trader',/neighbor trader/,s=>s.bookById.b.pricePageCaptureCount=8],
  ['sentinel',/selected trader/,s=>s.bookById.a.opaque.owner='b'],
  ['arm',/arm bytes/,s=>s.pending=null],
  ['price-callback',/price callback/,s=>s.callbacks.priceCalls=1],
  ['zero-callback',/zero callback/,s=>s.callbacks.zeroCalls=1],
  ['partial-book',/book bytes/,s=>s.rawBook+=' '],
  ['write-log',/Book write log/,s=>s.writes.push([K.book,s.rawBook])]
 ]){const changed=JSON.parse(JSON.stringify(after));mutate(changed);record.negativeControls.push({fault,expectedFailure:String(reason),state:changed});fs.writeFileSync(file,JSON.stringify(record,null,2));assert.throws(()=>guard(before,changed),reason);}
 record.allSevenDetected=true;fs.writeFileSync(file,JSON.stringify(record,null,2));});
