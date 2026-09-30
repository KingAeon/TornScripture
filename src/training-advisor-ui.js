'use strict';
const runtime=require('./training-advisor-runtime.js');
const ROOT_ID='tornscripture-training-advisor';
const STYLE_ID='tornscripture-training-style';
const LABELS={READY:'Ready now',WAITING:'Waiting for a checkpoint',NEEDS_ITEMS:'Needs items',
  NEEDS_REFRESH:'Needs current proof',BLOCKED:'Blocked'};
const REASONS={DATA_STALE:'Refresh the relevant observation or confirm required items now.',
  DATA_MISSING:'Provide the missing current input, then refresh.',
  CAPABILITY_UNAVAILABLE:'This source is unavailable with the current API key.',
  RESOURCE_MISSING:'Obtain and verify the selected plan’s required resources.',
  COOLDOWN_BLOCKED:'Wait for the observed checkpoint, then Refresh & Plan.',
  TIMING_UNSAFE:'Happy reset timing is not safe for this step.',
  STATE_CHANGED:'Player state changed. Refresh & Plan before continuing.',
  MODEL_OUT_OF_DOMAIN:'This plan exceeds the supported 50m model domain.',
  UNSUPPORTED_EFFECT:'A material gym, modifier, or item effect is unsupported.',
  ECONOMICS_UNAVAILABLE:'Cost comparison is unavailable. Try Biggest Gain for supported gain planning.',
  NO_SAFE_RECOMMENDATION:'A safe recommendation needs more supported state.',
  BOOSTER_LIMIT_REACHED:'Wait for booster capacity, then refresh.',
  SCHEMA_MISMATCH:'The source shape is unsupported; dependent prediction is withheld.'};
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const approximate=value=>Number.isFinite(value) ? new Intl.NumberFormat('en-US',{maximumSignificantDigits:3}).format(value) : 'Unavailable';
const itemName=id=>({xanax:'Xanax',ecstasy:'Ecstasy',eroticDvd:'eDVD'}[id] || id);
function instruction(action) {
  if (!action) return 'Refresh & Plan';
  switch (action.action) {
    case 'TAKE_XANAX':return 'Take 1 Xanax manually in Torn. Refresh after taking it.';
    case 'TAKE_ECSTASY':return 'Take 1 Ecstasy manually in Torn. Refresh after taking it.';
    case 'USE_BOOSTER':return `Use ${action.quantity} ${itemName(action.item)} manually in Torn. Refresh after each use.`;
    case 'TRAIN':return `Train ${action.targetStat} manually in Torn (${action.energySpent}E). Refresh after training.`;
    case 'USE_REFILL':return 'Use the Energy refill manually in Torn. Refresh after using it.';
    case 'WAIT':return `${Number.isFinite(action.seconds) ? `Wait approximately ${approximate(action.seconds/60)} min` : 'Wait for the checkpoint'}, then Refresh & Plan.`;
    case 'VERIFY_STATE':return 'Checkpoint: Refresh & Plan to observe reality and replan.';
    default:return 'Refresh & Plan before continuing.';
  }
}
function planName(plan) {
  if (!plan) return 'No selected plan';
  const types=new Set(plan.actions?.map(a=>a.action));
  return [types.has('TAKE_XANAX') ? 'Xanax checkpoint' : types.has('USE_BOOSTER') ? 'Happy preparation' :
    types.has('TAKE_ECSTASY') ? 'Ecstasy preparation' : types.has('WAIT') ? 'Observed wait' : 'Train now',
    ...(types.has('USE_REFILL') ? ['Energy refill'] : [])].join(' + ');
}
function ownedRequirements(plan) {
  return Object.entries(plan?.resources?.ownedItemsConsumed || {}).filter(([,n])=>n>0)
    .map(([key,quantity])=>({key,name:itemName(key),quantity}));
}
function beginnerAlternatives(rec) {
  const selected=rec?.primaryPlan;
  const unique=new Map();
  for (const plan of rec?.alternatives || []) if (plan.id!==selected?.id && !unique.has(plan.id)) unique.set(plan.id,plan);
  return [...unique.values()].slice(0,3).map(plan=>({id:plan.id,name:planName(plan),
    gainDelta:Number.isFinite(plan.simulation?.modeledGain) && Number.isFinite(selected?.simulation?.modeledGain) ?
      plan.simulation.modeledGain-selected.simulation.modeledGain : null,
    cashDelta:Number.isFinite(plan.economics?.newCashRequired) && Number.isFinite(selected?.economics?.newCashRequired) ?
      plan.economics.newCashRequired-selected.economics.newCashRequired : null,
    waitDelta:Number.isFinite(plan.timing?.waitSeconds) && Number.isFinite(selected?.timing?.waitSeconds) ?
      plan.timing.waitSeconds-selected.timing.waitSeconds : null}));
}
function buildView(snapshot) {
  const rec=snapshot.recommendation, plan=rec?.primaryPlan, n=snapshot.normalized;
  const readiness=plan?.readiness?.status || 'NEEDS_REFRESH';
  const reason=plan?.readiness ? plan.readiness.reason ?? null : rec?.reason || 'DATA_MISSING';
  const invalidEpoch=snapshot.phase==='NEEDS_REFRESH' || snapshot.phase==='REFRESHING';
  let next=invalidEpoch ? 'Refresh & Plan before continuing.' : readiness==='READY' ?
    instruction(plan.actions.find(a=>a.action!=='VERIFY_STATE')) : plan?.readiness?.nextAction ||
    REASONS[reason] || 'Refresh & Plan or provide supported state.';
  if (!invalidEpoch && rec?.status==='NO_SAFE_RECOMMENDATION') {
    if (n?.fields.stats?.value==null) next='Enter all four current raw battle stats, or refresh /user/battlestats.';
    else if (n?.fields.gym?.value==null || n?.fields.gym?.reason) next='Refresh /user/gym and /torn/gyms; supported gym evidence is required.';
    else if (n?.fields.gainModifiers?.reason) next='Refresh /user/perks; material modifier evidence is unavailable.';
  }
  return {status:rec?.status || 'NO_SAFE_RECOMMENDATION',readiness:invalidEpoch ? 'NEEDS_REFRESH' : readiness,
    readinessLabel:LABELS[invalidEpoch ? 'NEEDS_REFRESH' : readiness], reason,
    confidence:plan?.confidence?.level || 'Unavailable', planName:planName(plan), identity:plan?.id || null,
    target:plan?.target?.stat || snapshot.preferences.targetStat,
    objective:rec?.objective || snapshot.preferences.objective,next,
    gain:plan?.simulation?.modeledGain ?? null, gainInterval:plan?.simulation?.gainInterval ?? null,
    economicsAvailable:n?.capabilities?.marketComparison===true,
    economics:plan?.economics || null, owned:ownedRequirements(plan),
    bought:Object.entries(plan?.resources?.boughtItems || {}).filter(([,n])=>n>0)
      .map(([key,quantity])=>({key,name:itemName(key),quantity})),
    sequence:plan?.actions?.map(instruction) || [],alternatives:beginnerAlternatives(rec),
    why:rec?.explanation?.join('; ') || REASONS[reason] || reason,
    known:n ? {Energy:n.observedState.energy,Happy:n.observedState.happy,
      Stats:n.observedState.stats ? 'Available' : 'Missing',Gym:n.observedState.gym?.name} : {},
    missing:n ? Object.entries(n.fields).filter(([,f])=>f && Object.hasOwn(f,'value') && f.value==null)
      .map(([field,value])=>({field,reason:value.reason})) : [{field:'Current observation',reason:'DATA_MISSING'}],
    sources:n?.sourceStatus || {},
    advanced:{Plan:plan,State:n?.observedState,Sources:{fields:n?.fields,sources:n?.sourceStatus,
      acquisition:snapshot.acquisition,epoch:snapshot.epoch,startedAt:snapshot.startedAt,
      completedAt:snapshot.completedAt,atomic:snapshot.atomic},Economics:plan?.economics,
      Alternatives:rec?.alternatives,Model:{id:plan?.explanation?.modelId || 'vladar-v2-pre50m-v1',
        confidence:plan?.confidence,calibratedDomain:n?.capabilities?.calibratedDomain,
        gainInterval:plan?.simulation?.gainInterval || null,assumption:plan?.simulation?.assumption},
      'Rejected / Diagnostics':{reason,capabilities:n?.capabilities,unsupported:n?.unsupported,rejected:rec?.rejectedPlans}},
    gates:['H1 open: Happy reset timing is unproven; elevated-Happy/Ecstasy execution needs approved timing proof.',
      'H2 open: personalized Candy event state is unproven; event-dependent Candy mechanics are withheld.']};
}
const options=(values,current)=>values.map(([label,value])=>`<option value="${escape(value)}"${value===current?' selected':''}>${escape(label)}</option>`).join('');
const button=(action,label)=>`<button type="button" data-action="${action}">${escape(label)}</button>`;
function fullHtml(snapshot,view) {
  const prefs=snapshot.preferences;
  const objective=options(Object.entries(runtime.OBJECTIVES),prefs.objective);
  const stat=options(['strength','speed','defense','dexterity'].map(s=>[s,s]),prefs.targetStat);
  const resource=list=>list.length ? list.map(x=>`${escape(x.name)} ×${x.quantity}`).join(' · ') : 'None';
  const noSafe=view.status==='NO_SAFE_RECOMMENDATION' ? `<section><h3>No safe recommendation</h3>
    <p>${escape(REASONS[view.reason] || view.reason)}</p><p>Known: ${escape(Object.entries(view.known)
      .filter(([,v])=>v!=null).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'No current observation')}</p>
    <p>Missing or unsupported: ${escape(view.missing.map(x=>x.field).join(', ') || view.reason)}</p>
    <p>${escape(view.next)}</p></section>` : '';
  const summary=`<section><h3>${escape(view.planName)}</h3><p class="ta-ready">${escape(view.readinessLabel)}</p>
    <p>Confidence: ${escape(view.confidence)}</p><p class="ta-next"><strong>NEXT</strong> ${escape(view.next)}</p>
    <p>${escape(REASONS[view.reason] || (view.reason==='DATA_MISSING' ? '' : view.reason) || '')}</p>
    <p>Approximate expected gain: ${approximate(view.gain)} · Target: ${escape(view.target)}</p>
    <p>Owned use: ${resource(view.owned)}<br>To acquire: ${resource(view.bought)}</p>
    <p>${view.economicsAvailable ? `New cash: ${approximate(view.economics?.newCashRequired)} · Replacement value: ${approximate(view.economics?.marketValueOfOwnedItemsConsumed)}` : 'Cost comparison unavailable; no market prices supplied.'}
    · Points: ${approximate(view.economics?.pointsConsumed)}</p>
    <p>Supported wait: ${view.advanced.Plan ? approximate(view.advanced.Plan.timing.waitSeconds/60)+' min' : 'Unavailable'}
    · Active time: not modeled</p><p>${escape(view.why)}</p>
    ${view.sequence.length ? `<ol>${view.sequence.map(text=>`<li>${escape(text)}</li>`).join('')}</ol>` : ''}
    ${button('checkpoint','State changed / checkpoint reached')}
    <p>After each manual player action: checkpoint → Refresh & Plan → observe → replan.</p></section>`;
  const confirmation=view.owned.length ? `<form data-form="inventory"><h3>Confirm current owned quantities</h3>
    <p>Enter what you actually own now. Zero and lower values override cached planning quantities.</p>
    ${view.owned.map(x=>`<label>${escape(x.name)} (plan needs ${x.quantity})<input name="${escape(x.key)}" type="number" min="0" step="1" required inputmode="numeric" placeholder="Current quantity"></label>`).join('')}
    <button type="submit">Confirm these current quantities & replan</button><p>Only these item keys gain current proof. Purchases stay separate.</p></form>` : '';
  const alternatives=view.alternatives.length ? `<section><h3>Alternatives</h3>${view.alternatives.map(a=>
    `<p>${escape(a.name)}: gain ${approximate(a.gainDelta)} difference · new cash ${approximate(a.cashDelta)} difference · wait ${approximate(a.waitDelta==null?null:a.waitDelta/60)} min difference</p>`).join('')}</section>` : '';
  const confirmed=snapshot.normalized?.fields.inventory.confirmation;
  const confirmationSummary=confirmed ? `<p>Current confirmed inventory: ${escape(Object.entries(confirmed.value)
    .map(([key,value])=>`${itemName(key)} ×${value}`).join(' · '))}. Item-local ${escape(confirmed.freshness)} proof at ${escape(confirmed.observedAt)}.</p>` : '';
  const advanced=prefs.mode==='advanced' ? Object.entries(view.advanced).map(([name,value])=>
    `<details><summary>${escape(name)}</summary><pre>${escape(JSON.stringify(value ?? null,null,2))}</pre></details>`).join('') : '';
  return `<header><strong>Training Advisor v${runtime.VERSION}</strong>${button('close','Close')}</header>
    <div class="ta-body"><form data-form="preferences"><label>Objective<select name="objective">${objective}</select></label>
    <label>Target stat<select name="targetStat">${stat}</select></label>
    <label>New cash budget (optional)<input name="budgetNewCash" type="number" min="0" value="${prefs.budgetNewCash ?? ''}"></label>
    <label>Max wait, minutes<input name="maxWaitMinutes" type="number" min="0" value="${prefs.maxWaitSeconds/60}"></label>
    <label><input name="allowItems" type="checkbox"${prefs.allowItems?' checked':''}> Consider owned preparation items</label>
    <fieldset><legend>Do not use</legend>${['xanax','eroticDvd','ecstasy'].map(key=>
      `<label><input name="prohibited_${key}" type="checkbox"${prefs.prohibitedItems.includes(key)?' checked':''}> ${itemName(key)}</label>`).join('')}</fieldset>
    <label><input name="allowRefill" type="checkbox"${prefs.allowRefill?' checked':''}> Consider paid Energy refill (needs current Points)</label>
    <label>Points cash value (optional)<input name="pointValue" type="number" min="0" value="${prefs.pointValue ?? ''}"></label>
    <label>Risk policy<select name="riskPolicy">${options([['Supported model','ALLOW_SUPPORTED'],['Calibrated domain only','CALIBRATED_ONLY'],['Allow experimental','ALLOW_EXPERIMENTAL']],prefs.riskPolicy)}</select></label>
    <label>Theme<select name="theme">${options(['Auto','Dark','Light'].map(x=>[x,x]),prefs.theme)}</select></label>
    <button type="submit">Save preferences & replan</button></form>
    <div class="ta-actions">${button('refresh','Refresh & Plan')}${button('mode',prefs.mode==='advanced'?'Beginner':'Advanced')}</div>
    <p>${escape(snapshot.connection)} · Epoch ${snapshot.epoch} · ${escape(snapshot.phase)}.
    Independent observations; not an atomic Torn server snapshot.</p>${noSafe}${summary}${confirmationSummary}${confirmation}${alternatives}
    <section><h3>Current evidence</h3><form data-form="effects"><label><input name="none" type="checkbox" required>
    I checked my current effects: no other temporary training, drug, booster, or preparation effects beyond the fetched perks.</label>
    <button type="submit">Confirm current effect state & replan</button></form>
    ${snapshot.normalized?.capabilities.automaticStats ? '' : `<form data-form="stats"><p>Automatic stats unavailable. Enter all four current raw battle stats.</p>
      ${['strength','speed','defense','dexterity'].map(s=>`<label>${s}<input name="${s}" type="number" min="0" step="any" required></label>`).join('')}
      <button type="submit">Confirm current stats & replan</button></form>`}
    <form data-form="points"><label>Current Points (only if API proof unavailable)<input name="points" type="number" min="0" step="1" required></label>
    <button type="submit">Confirm current Points & replan</button></form>
    <p>Confirmation lasts only in this current observation session and expires after state changes or 60 seconds.</p>
    ${view.gates.map(text=>`<p>${escape(text)}</p>`).join('')}</section>${advanced}
    <details><summary>Connection</summary><form data-form="key"><label>Desktop local API key<input name="key" type="password" autocomplete="off" placeholder="Never included in diagnostics"></label>
    <button type="submit">Save local key</button>${button('forget-key','Forget local key')}</form>
    <p>TornPDA’s managed key takes priority. Keys are sent only to the official Torn API.</p></details></div>`;
}
function clamp(position,width,height,viewport) {
  return {x:Math.max(0,Math.min(Number.isFinite(position.x)?position.x:0,Math.max(0,viewport.width-width))),
    y:Math.max(0,Math.min(Number.isFinite(position.y)?position.y:0,Math.max(0,viewport.height-height)))};
}
function resolveTheme(preference,{markers='',background='',prefersDark=false}={}) {
  if (preference!=='Auto') return preference;
  const channels=background.match(/[\d.]+/g)?.map(Number) || [];
  const pageDark=/dark|night/i.test(markers) || channels.length>=3 &&
    (channels.length===3 || channels[3]>0) && channels[0]*.2126+channels[1]*.7152+channels[2]*.0722<140;
  return pageDark || prefersDark ? 'Dark' : 'Light';
}
const CSS=`#${ROOT_ID}{--bg:#f7f7f9;--fg:#181b22;--muted:#454d60;--line:#b7c0d2;--accent:#235db9;color:var(--fg);font:14px/1.4 system-ui,sans-serif;z-index:2147483600}
#${ROOT_ID}[data-theme=Dark]{--bg:#141923;--fg:#e5ebf5;--muted:#b5bfd3;--line:#47536a;--accent:#437bd3}
@media(prefers-color-scheme:dark){#${ROOT_ID}[data-theme=Auto]{--bg:#141923;--fg:#e5ebf5;--muted:#b5bfd3;--line:#47536a;--accent:#437bd3}}
#${ROOT_ID} *{box-sizing:border-box}#${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} select{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:7px;min-height:44px;padding:8px;max-width:100%}
#${ROOT_ID} button{cursor:pointer}#${ROOT_ID} button[data-action=refresh]{background:var(--accent);color:white;font-weight:700}#${ROOT_ID} button:disabled{opacity:.6;cursor:wait}
#${ROOT_ID} .ta-hud{position:fixed;width:min(340px,calc(100vw - 16px));max-height:calc(100dvh - 8px);overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 24px #0005;padding:10px;overflow-wrap:anywhere}
#${ROOT_ID} header{display:flex;align-items:center;justify-content:space-between;gap:8px}#${ROOT_ID} [data-drag]{touch-action:none;cursor:move;padding:4px}
#${ROOT_ID} .ta-actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}#${ROOT_ID} p{margin:8px 0}#${ROOT_ID} .ta-ready{font-weight:700}#${ROOT_ID} .ta-next{border-left:4px solid var(--accent);padding:10px;background:var(--bg)}
#${ROOT_ID} .ta-overlay{position:fixed;inset:12px;max-width:820px;margin:auto;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 60px #0008;overflow:hidden}
#${ROOT_ID} .ta-overlay>header{padding:12px;border-bottom:1px solid var(--line)}#${ROOT_ID} .ta-body{overflow:auto;min-height:0;padding:14px;overflow-wrap:anywhere}
#${ROOT_ID} label{display:block;margin:8px 0}#${ROOT_ID} label>input:not([type=checkbox]),#${ROOT_ID} label>select{display:block;width:100%;margin-top:4px}#${ROOT_ID} input[type=checkbox]{min-height:24px;width:24px;vertical-align:middle}
#${ROOT_ID} section,#${ROOT_ID} form,#${ROOT_ID} details{border:1px solid var(--line);padding:10px;margin:10px 0;border-radius:8px}#${ROOT_ID} summary{cursor:pointer;min-height:44px;padding:8px}#${ROOT_ID} pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}#${ROOT_ID} li{margin:8px 0}#${ROOT_ID} h3{margin:0 0 8px}#${ROOT_ID} .ta-error{color:var(--fg);font-weight:700}
@media(max-width:600px){#${ROOT_ID} .ta-overlay{inset:0;max-width:none;border-radius:0}#${ROOT_ID} .ta-body{padding:10px}}`;
function mount({document,window,advisor}) {
  if (document.getElementById(ROOT_ID)) return null;
  const style=document.createElement('style'); style.id=STYLE_ID;style.textContent=CSS;
  document.head.appendChild(style);
  const root=document.createElement('div');root.id=ROOT_ID;document.body.appendChild(root);
  let opened=false,error='',drag=null,snapshot=advisor.snapshot();
  const listeners=[];
  const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  function position() {
    const hud=root.querySelector('.ta-hud');
    const p=clamp(snapshot.preferences.position,hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';return p;
  }
  function render(value=snapshot) {
    snapshot=value; const view=buildView(snapshot);root.dataset.theme=resolveTheme(snapshot.preferences.theme,{
      markers:[document.documentElement?.className,document.documentElement?.dataset?.theme,
        document.body?.className,document.body?.dataset?.theme].join(' '),
      background:window.getComputedStyle?.(document.body)?.backgroundColor || '',
      prefersDark:window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false});
    root.innerHTML=`<div class="ta-hud"><header><strong data-drag>Training Advisor</strong>${button('collapse',snapshot.preferences.collapsed?'Expand':'Collapse')}</header>
      ${snapshot.preferences.collapsed ? '' : `<p class="ta-ready">${escape(view.readinessLabel)}</p><p>${escape(view.planName)} · ${escape(view.target)}</p><p>${escape(view.next)}</p>`}
      <div class="ta-actions">${button('refresh','Refresh & Plan')}${button('open','Open')}</div></div>
      ${opened ? `<div class="ta-overlay" role="dialog" aria-label="Training Advisor">${fullHtml(snapshot,view)}${error?`<p class="ta-error" role="alert">${escape(error)}</p>`:''}</div>` : ''}`;
    for (const control of root.querySelectorAll('button[data-action=refresh]')) control.disabled=snapshot.phase==='REFRESHING';
    position();
  }
  on(root,'click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;if (!action) return;
    if (action==='open') opened=true;
    if (action==='close') opened=false;
    if (action==='refresh') {error='';advisor.refresh();}
    if (action==='checkpoint') advisor.invalidate();
    if (action==='collapse') advisor.setPreferences({collapsed:!snapshot.preferences.collapsed});
    if (action==='mode') advisor.setPreferences({mode:snapshot.preferences.mode==='advanced'?'beginner':'advanced'});
    if (action==='forget-key') advisor.setKey('');
    render();
  });
  on(root,'submit',event=>{
    event.preventDefault();const form=event.target,data=new window.FormData(form);
    const number=name=>{const value=data.get(name);return typeof value==='string' && value.trim() ? Number(value) : null;};
    try {
      error='';
      switch (form.dataset.form) {
        case 'preferences':advisor.setPreferences({objective:data.get('objective'),targetStat:data.get('targetStat'),
          budgetNewCash:number('budgetNewCash'),maxWaitSeconds:(number('maxWaitMinutes') || 0)*60,
          allowItems:data.has('allowItems'),prohibitedItems:['xanax','eroticDvd','ecstasy'].filter(key=>data.has('prohibited_'+key)),
          allowRefill:data.has('allowRefill'),pointValue:number('pointValue'),riskPolicy:data.get('riskPolicy'),theme:data.get('theme')});break;
        case 'inventory':advisor.confirmInventory(Object.fromEntries(ownedRequirements(snapshot.recommendation?.primaryPlan)
          .map(x=>[x.key,number(x.key)])));break;
        case 'stats':advisor.confirmStats(Object.fromEntries(['strength','speed','defense','dexterity'].map(s=>[s,number(s)])));break;
        case 'effects':advisor.confirmEffects(data.has('none'));break;
        case 'points':advisor.confirmPoints(number('points'));break;
        case 'key':advisor.setKey(data.get('key'));break;
      }
    } catch {error='Input could not be accepted. Check the current values and Refresh & Plan before confirming.';}
    render();
  });
  on(root,'pointerdown',event=>{
    if (!event.target.closest('[data-drag]')) return;
    const p=position();drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:p};
    root.setPointerCapture(event.pointerId);event.preventDefault();
  });
  on(root,'pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    const hud=root.querySelector('.ta-hud'),p=clamp({x:drag.start.x+event.clientX-drag.x,y:drag.start.y+event.clientY-drag.y},
      hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';
  });
  const finishDrag=event=>{if (!drag || event.pointerId!==drag.id) return;
    const hud=root.querySelector('.ta-hud');drag=null;advisor.setPreferences({position:{x:parseFloat(hud.style.left),y:parseFloat(hud.style.top)}});};
  on(root,'pointerup',finishDrag);on(root,'pointercancel',finishDrag);on(window,'resize',position);
  on(document,'visibilitychange',()=>{if (document.hidden) advisor.invalidate();else render();});
  const scheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  if (scheme?.addEventListener) on(scheme,'change',()=>{if (snapshot.preferences.theme==='Auto') render();});
  // Conservatively invalidate before foreground Torn interactions, without performing them.
  on(document,'click',event=>{if (!root.contains(event.target) && event.target.closest('a,button,input') && snapshot.phase==='CURRENT') advisor.invalidate();},true);
  on(document,'submit',event=>{if (!root.contains(event.target) && snapshot.phase==='CURRENT') advisor.invalidate();},true);
  const unsubscribe=advisor.subscribe(render);render();
  return {dispose(){unsubscribe();for (const remove of listeners) remove();advisor.dispose();root.remove();style.remove();}};
}
module.exports={ROOT_ID,STYLE_ID,CSS,escape,approximate,instruction,planName,ownedRequirements,
  beginnerAlternatives,buildView,fullHtml,clamp,resolveTheme,mount};
