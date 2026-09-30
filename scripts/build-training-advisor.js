'use strict';
// Node-core deterministic generator. All embedded modules are canonical source bytes.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT='TornScripture-Training-Advisor.user.js';
const VERSION='0.1.0';
const INPUTS=['src/training-advisor-pure.js','src/training-advisor-adapters.js',
  'src/training-advisor-runtime.js','src/training-advisor-ui.js'];
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
function generate(root=ROOT) {
  const inputs=Object.fromEntries(INPUTS.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
  const provenance={generator:'training-advisor-node-core-v1',version:VERSION,
    hashes:Object.fromEntries([...INPUTS,'scripts/build-training-advisor.js'].map(file=>
      [file,hash(fs.readFileSync(path.join(root,file)))]))};
  const capsules=INPUTS.map(file=>`    ${JSON.stringify('./'+path.basename(file))}: function(module, exports, require) {\n${inputs[file]}\n    }`).join(',\n');
  return `// ==UserScript==
// @name         TornScripture - Training Advisor
// @namespace    https://github.com/KingAeon/TornScripture
// @version      ${VERSION}
// @description  User-triggered training advice, current proof, and transparent manual checkpoints.
// @author       KingAeon
// @match        https://www.torn.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @homepageURL  https://github.com/KingAeon/TornScripture
// @downloadURL  https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/${OUTPUT}
// @updateURL    https://raw.githubusercontent.com/KingAeon/TornScripture/refs/heads/main/${OUTPUT}
// ==/UserScript==

// GENERATED: edit canonical src files, then run node scripts/build-training-advisor.js.
// SAFETY BOUNDARY: advisory only; no gameplay actions, background polling, or state uploads.
// Only user-triggered GET requests to the official Torn API; keys remain local.
// Only preferences/UI state and an optional local key persist. Current evidence is memory-only.
// BUILD_PROVENANCE ${JSON.stringify(provenance)}
(() => {
  'use strict';
  const factories={
${capsules}
  };
  const modules=Object.create(null);
  function load(id) {
    if (!Object.hasOwn(factories,id)) throw new Error('Unapproved private module');
    if (!modules[id]) {
      modules[id]={exports:{}};
      factories[id](modules[id],modules[id].exports,load);
    }
    return modules[id].exports;
  }
  const runtime=load('./training-advisor-runtime.js');
  const ui=load('./training-advisor-ui.js');
  if (globalThis.__TS_TRAINING_ADVISOR_TEST_MODE__===true) {
    const planner=load('./training-advisor-pure.js');
    const adapters=load('./training-advisor-adapters.js');
    globalThis.__TS_TRAINING_ADVISOR_TEST_EXPORTS__=Object.freeze({
      planner:Object.freeze({simulateTraining:planner.simulateTraining,recommend:planner.recommend,
        planReadiness:planner.planReadiness,generateEnergyCandidates:planner.generateEnergyCandidates}),
      adapters:Object.freeze({normalizeTrainingSources:adapters.normalizeTrainingSources}),
      runtime:Object.freeze({createAdvisor:runtime.createAdvisor,requestUrl:runtime.requestUrl,
        preferences:runtime.preferences,countdown:runtime.countdown}),
      ui:Object.freeze({buildView:ui.buildView,fullHtml:ui.fullHtml,clamp:ui.clamp,instruction:ui.instruction}),
      provenance:Object.freeze(${JSON.stringify(provenance)})});
    return;
  }
  if (typeof document==='undefined' || document.getElementById(ui.ROOT_ID)) return;
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),
    removeItem:key=>localStorage.removeItem(key)};
  const advisor=runtime.createAdvisor({fetch:window.fetch.bind(window),storage,managedKey:'###PDA-APIKEY###'});
  ui.mount({document,window,advisor});
})();
`;
}
function verify(artifact,root=ROOT) {
  if (artifact!==generate(root)) throw new Error('Training Advisor generated artifact/source drift');
  return true;
}
if (require.main===module) {
  const args=process.argv.slice(2), output=path.join(ROOT,OUTPUT);
  if (args.length===1 && args[0]==='--check') verify(fs.readFileSync(output,'utf8'));
  else if (args.length===0) fs.writeFileSync(output,generate());
  else throw new Error('Usage: node scripts/build-training-advisor.js [--check]');
}
module.exports={VERSION,INPUTS,OUTPUT,generate,verify};
