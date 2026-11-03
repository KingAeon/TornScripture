// Orthogonal certificate oracle: code-unit occupancy and role/source accounting.
// No role-engine import, candidate ranking, compact-tail predicate or catalog.
const assert=require('node:assert/strict');
function verifyCertificates(text,rows){
 for(const row of rows){
  for(const [index,o]of row.obligations.entries()){
   const c=o.certificate;assert.ok(c&&c.complete,'every eligible obligation requires a complete certificate');assert.equal(c.rowSpan.start,row.span.start);assert.equal(c.rowSpan.end,row.span.end);
   const occupied=new Uint8Array(row.raw.length),roleAt=new Array(row.raw.length);let frontier=row.span.start;
   for(const p of c.parts){const s=p.span;assert.ok(s.start>=row.span.start&&s.start<=s.end&&s.end<=row.span.end);assert.equal(s.start,frontier,'certificate cannot omit any prefix/gap/suffix');assert.equal(s.raw,text.slice(s.start,s.end));frontier=s.end;
    if(p.role==='trivia')assert.ok(/^\s*$/.test(s.raw)||s.start===row.span.start&&/^[-•*\s]*$/.test(s.raw),'meaningful source cannot be trivia');
    assert.notEqual(p.role,'unexplained');for(let i=s.start;i<s.end;i++){const k=i-row.span.start;occupied[k]++;roleAt[k]=p.role;}
   }
   assert.equal(frontier,row.span.end);assert.ok([...occupied].every(n=>n===1),'exact full-source unit occupancy');
   for(const [kind,span]of [['identity',o.identitySpan],['operator',o.operatorSpan],['quantity',o.quantitySpan],['money-tail',o.fieldsSpan]]){
    assert.ok(c.parts.some(p=>p.role===kind&&p.span.start===span.start&&p.span.end===span.end&&p.span.raw===span.raw));for(let i=span.start;i<span.end;i++)assert.equal(roleAt[i-row.span.start],kind);
   }
   assert.ok(['x','×'].includes(o.operatorSpan.raw));
   if(!o.identitySpan.raw.trim()){assert.ok(['MALFORMED_ITEM','REVIEW_REQUIRED'].includes(row.category));assert.ok(c.roleDefects.includes('missing whole item identity'));assert.equal(o.identitySpan.start,o.identitySpan.end);}
   if(['VALID_POSITIVE_ITEM','VALID_ZERO_ONLY_OBSERVATION'].includes(row.category))assert.equal(c.roleDefects.length,0,'complete coverage cannot excuse a damaged required field');
   for(const marker of row.inventory.filter(g=>/^[@=$]$/.test(g.token)))assert.ok(['identity','quantity','money-tail'].includes(roleAt[marker.span.start-row.span.start]),'all markers assigned to explicit source fields');
   assert.equal(c.earlierRoleTreatment.length,index);for(const prior of row.obligations.slice(0,index))assert.ok(c.earlierRoleTreatment.some(t=>t.operatorSpan.start===prior.operatorSpan.start&&t.treatment==='retained credible earlier obligation; no erasure'));
  }
  for(const alt of row.rejectedAlternatives){if(alt.certificate&&!alt.certificate.complete)assert.ok(alt.certificate.unsupported.length>0);if(alt.conservedOperator)assert.ok(row.obligations.some(o=>o.operatorSpan.start===alt.conservedOperator.start&&alt.operatorSpan.start>=o.quantitySpan.start&&alt.operatorSpan.end<=o.quantitySpan.end));}
 }
}
function oracleNegativeControls(){
 const text='2xBox7 @ $1 = $2',sp=(start,end)=>({start,end,raw:text.slice(start,end)});
 const candidate={identitySpan:sp(2,4),operatorSpan:sp(4,5),quantitySpan:sp(5,6),fieldsSpan:sp(7,16)};
 const row={raw:text,span:sp(0,16),inventory:[],obligations:[{...candidate,certificate:{complete:true,rowSpan:sp(0,16),parts:[{role:'identity',span:sp(2,4)},{role:'operator',span:sp(4,5)},{role:'quantity',span:sp(5,6)},{role:'trivia',span:sp(6,7)},{role:'money-tail',span:sp(7,16)}],earlierRoleTreatment:[]}}],rejectedAlternatives:[]};
 assert.throws(()=>verifyCertificates(text,[row]),/omit any prefix/);
 const mislabeled=structuredClone(row);mislabeled.obligations[0].certificate.parts.unshift({role:'trivia',span:sp(0,2)});assert.throws(()=>verifyCertificates(text,[mislabeled]),/meaningful source cannot be trivia/);
 return {omittedPrefixDetected:true,meaningfulPrefixAsTriviaDetected:true};
}
module.exports={verifyCertificates,oracleNegativeControls};
