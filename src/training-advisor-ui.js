'use strict';
const runtime=require('./training-advisor-runtime.js');
const adapters=require('./training-advisor-adapters.js');
const ROOT_ID='tornscripture-training-advisor';
const STYLE_ID='tornscripture-training-style';
const REASONS={DATA_STALE:'Refresh the relevant Torn state with Refresh & Plan.',
  DATA_MISSING:'Current proof is missing. Follow the evidence guidance below.',
  CAPABILITY_UNAVAILABLE:'This source is unavailable with the current API key.',
  RESOURCE_MISSING:'Obtain and verify the selected plan requirements.',
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
const CHECKPOINT='After the action, report I completed this step, then Refresh & Plan.';
function instruction(action) {
  if (!action) return 'Refresh & Plan';
  switch (action.action) {
    case 'TAKE_XANAX':return `Take 1 Xanax manually in Torn. ${CHECKPOINT}`;
    case 'TAKE_ECSTASY':return `Take 1 Ecstasy manually in Torn. ${CHECKPOINT}`;
    case 'USE_BOOSTER':return `Use ${action.quantity} ${itemName(action.item)} manually in Torn. ${CHECKPOINT}`;
    case 'TRAIN':return `Train ${action.targetStat} manually in Torn (${action.energySpent}E). ${CHECKPOINT}`;
    case 'USE_REFILL':return `Use the Energy refill manually in Torn. ${CHECKPOINT}`;
    case 'WAIT':return `${Number.isFinite(action.seconds) ? `Wait approximately ${approximate(action.seconds/60)} min` : 'Wait for the checkpoint'}, then Refresh & Plan.`;
    case 'VERIFY_STATE':return `${CHECKPOINT} Observe reality and replan.`;
    default:return 'Refresh & Plan before continuing.';
  }
}
function planName(plan) {
  if (!plan) return 'No selected plan';
  const types=new Set(plan.actions?.map(a=>a.action));
  const boosters=[...new Set((plan.boosterUseSequence || []).map(use=>itemName(use.item)))];
  return [...(types.has('TAKE_XANAX') ? ['Xanax checkpoint'] : []),
    ...(boosters.length ? boosters : types.has('USE_BOOSTER') ? ['Happy preparation'] : []),
    ...(types.has('TAKE_ECSTASY') ? ['Ecstasy'] : []),
    ...(!types.has('TAKE_XANAX') && !types.has('USE_BOOSTER') && !types.has('TAKE_ECSTASY') ?
      [types.has('WAIT') ? 'Observed wait' : 'Train now'] : []),
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
// Present existing evidence requirements; never promote proof or reinterpret readiness.
function missingEvidence(snapshot,plan) {
  const n=snapshot.normalized,fields=n?.fields;
  if (!fields) return [{field:'observation',label:'Current observation',kind:'source',reason:'DATA_MISSING',action:'Refresh & Plan.'}];
  const missing=names=>names.some(name=>fields[name]?.value===null);
  const out=[],add=(field,label,kind,action,reason)=>out.push({field,label,kind,reason,
    action:kind==='source' && reason==='CAPABILITY_UNAVAILABLE' ? `${label}: this source is unavailable with the current API key. Check its access before retrying.` : action});
  const bars=['energy','naturalEnergyMax','naturalRegen','happy'];
  if (missing(bars)) add('bars','Energy / Happy (/user/bars)','source',
    'Refresh /user/bars with Refresh & Plan. Supported current bars evidence is required.',
    bars.map(name=>fields[name]).find(f=>f?.value===null)?.reason);
  else if (missing(['ordinaryHappy'])) add('ordinaryHappy','Ordinary Happy','limitation',
    'A verified elevated-Happy mapping is unavailable; dependent projections are withheld.',fields.ordinaryHappy.reason);
  if (missing(['stats'])) add('stats','Current battle stats','confirmation',
    'Confirm all four current raw battle stats below. The Advisor will replan immediately.',fields.stats.reason);
  if (missing(['gym']) || fields.gym?.reason) add('gym','Gym evidence (/user/gym + /torn/gyms)',
    fields.gym.reason==='UNSUPPORTED_EFFECT' ? 'limitation' : 'source',fields.gym.reason==='UNSUPPORTED_EFFECT' ?
      'This gym has an unsupported material effect; dependent prediction is withheld.' :
      'Refresh /user/gym and /torn/gyms with Refresh & Plan. Supported gym evidence is required.',fields.gym.reason);
  if (missing(['gainModifiers']) || fields.gainModifiers?.reason) add('gainModifiers','Training modifiers (/user/perks)','source',
    'Refresh /user/perks with Refresh & Plan. Unsupported material modifiers remain withheld.',fields.gainModifiers.reason);
  if (missing(['drugCooldown','boosterCooldown'])) add('cooldowns','Cooldowns (/user/cooldowns)','source',
    'Refresh /user/cooldowns with Refresh & Plan.',fields.drugCooldown?.reason || fields.boosterCooldown?.reason);
  const refill=snapshot.preferences.allowRefill || plan?.actions?.some(a=>a.action==='USE_REFILL');
  if (refill && missing(['pointRefill'])) add('pointRefill','Refill availability (/user/refills)','source',
    'Refresh /user/refills with Refresh & Plan. Current refill availability is required.',fields.pointRefill.reason);
  if (refill && missing(['points'])) add('points','Current Points','confirmation',
    'Confirm current Points below. The Advisor will replan immediately.',fields.points.reason);
  const owned=ownedRequirements(plan);
  if (owned.some(item=>n.observedState.inventoryFreshnessByItem?.[item.key]!=='LIVE'))
    add('inventory','Selected-plan owned quantities','confirmation',
      'Confirm the selected-plan owned quantities below. The Advisor will replan immediately.','DATA_MISSING');
  if (snapshot.preferences.allowItems && missing(['effectState'])) add('effectState','Preparation effects (for item plans)','confirmation',
    'Confirm current effects below. The Advisor will replan immediately. Booster capacity depends on verified effect and mechanic evidence.',fields.effectState.reason);
  else if (snapshot.preferences.allowItems && missing(['boosterMaxSeconds'])) add('boosterMaxSeconds','Booster capacity','limitation',
    'Verified effect or mechanic evidence is unsupported; dependent booster preparation is withheld.',fields.boosterMaxSeconds.reason);
  if (missing(['stackCap'])) add('stackCap','Energy stack-cap mechanic','limitation',
    'The versioned stack-cap mechanic is unavailable; dependent preparation is withheld.',fields.stackCap.reason);
  // worldDiabetesDay is H2, not a player-editable field. Both open gates stay visible below.
  return out;
}
function buildView(snapshot) {
  const rec=snapshot.recommendation,n=snapshot.normalized;
  const invalidEpoch=snapshot.phase==='NEEDS_REFRESH' || snapshot.phase==='REFRESHING';
  const plan=(invalidEpoch ? snapshot.stalePlan : null) || snapshot.effectivePlan || rec?.primaryPlan;
  const readiness=plan?.readiness?.status || 'NEEDS_REFRESH';
  const reason=plan?.readiness ? plan.readiness.reason ?? null : rec?.reason || 'DATA_MISSING';
  const missing=missingEvidence(snapshot,plan);
  const rawMissing=n ? Object.entries(n.fields).filter(([,f])=>f && Object.hasOwn(f,'value') && f.value==null)
    .map(([field,value])=>({field,reason:value.reason})) : [];
  let next=invalidEpoch ? 'State changed. Refresh & Plan to continue.' : readiness==='READY' ?
    instruction(plan.actions.find(a=>a.action!=='VERIFY_STATE')) : plan?.readiness?.nextAction ||
    REASONS[reason] || 'Refresh & Plan or provide supported state.';
  if (!invalidEpoch && plan?.readiness?.nextAction==='confirm safe quarter-hour window')
    next='H1 open: this Ecstasy step is withheld until approved timing proof is available.';
  else if (!invalidEpoch && rec?.status==='NO_SAFE_RECOMMENDATION') {
    const entry=['DATA_MISSING','DATA_STALE'].includes(reason) ? missing[0] :
      ['SCHEMA_MISMATCH','UNSUPPORTED_EFFECT','CAPABILITY_UNAVAILABLE'].includes(reason) ?
        missing.find(x=>x.kind!=='confirmation' && x.reason===reason) : null;
    if (entry) next=entry.action;
  }
  else if (!invalidEpoch && readiness==='NEEDS_REFRESH' && ['DATA_MISSING','DATA_STALE'].includes(reason)) {
    const required=plan?.readiness?.nextAction;
    const sourceField={'refresh energy':'bars','refresh happy':'bars',
      'refresh drug cooldown':'cooldowns','refresh gain modifiers':'gainModifiers'}[required];
    const entry=missing.find(x=>required==='refresh inventory' ? x.field==='inventory' :
      required==='refresh refill and points' ? ['pointRefill','points'].includes(x.field) :
      required==='refresh booster capacity' ? ['effectState','boosterMaxSeconds'].includes(x.field) :
      x.field===sourceField || required===`refresh ${x.field}`);
    if (entry) next=entry.action;
  }
  const researchGate=!invalidEpoch && (plan?.readiness?.nextAction==='confirm safe quarter-hour window' ||
    plan?.actions?.some(action=>action.item?.startsWith('candy')) &&
    n?.fields.worldDiabetesDay?.value==null);
  if (researchGate && plan?.readiness?.nextAction!=='confirm safe quarter-hour window')
    next='H2 open: personalized Candy mechanics are unverified; dependent item execution is withheld.';
  if (!invalidEpoch && !researchGate && readiness==='BLOCKED') next=REASONS[reason] || next;
  const reasonText=['DATA_MISSING','DATA_STALE'].includes(reason) ? next : REASONS[reason] || reason;
  const confirmationRemedy=!invalidEpoch && readiness==='NEEDS_REFRESH' && /Confirm .*below/i.test(next);
  const readinessLabel=researchGate ? 'RESEARCH GATE' : confirmationRemedy ? 'NEEDS CONFIRMATION' :
    invalidEpoch ? 'NEEDS REFRESH' : readiness.replaceAll('_',' ');
  return {status:rec?.status || 'NO_SAFE_RECOMMENDATION',readiness:invalidEpoch ? 'NEEDS_REFRESH' : readiness,
    readinessLabel,reason,reasonText,stale:invalidEpoch,researchGate,
    manualSelection:!!snapshot.selectedRouteFingerprint,
    confidenceLabel:plan?.confidence?.level==='SUPPORTED_EXTRAPOLATION' ? 'SUPPORTED' : plan?.confidence?.level || 'Unavailable',
    confidence:plan?.confidence?.level || 'Unavailable', planName:planName(plan), identity:plan?.id || null,
    target:plan?.target?.stat || snapshot.preferences.targetStat,
    objective:rec?.objective || snapshot.preferences.objective,next,
    gain:plan?.simulation?.modeledGain ?? null, gainInterval:plan?.simulation?.gainInterval ?? null,
    economicsAvailable:n?.capabilities?.marketComparison===true,
    economics:plan?.economics || null, owned:ownedRequirements(plan),
    bought:Object.entries(plan?.resources?.boughtItems || {}).filter(([,n])=>n>0)
      .map(([key,quantity])=>({key,name:itemName(key),quantity})),
    sequence:plan?.actions?.map(action=>researchGate &&
      (action.action==='TAKE_ECSTASY' || action.item?.startsWith('candy')) ?
      'Withheld: approved research evidence is required before this step.' :
      instruction(action).replace(' '+CHECKPOINT,'')) || [],alternatives:beginnerAlternatives(rec),
    why:rec?.explanation?.join('; ') || reasonText,
    known:n ? {Energy:n.observedState.energy,Happy:n.observedState.happy,
      Stats:n.observedState.stats ? 'Available' : 'Missing',Gym:n.observedState.gym?.name} : {},
    missing,
    sources:n?.sourceStatus || {},
    advanced:{Plan:plan,State:n?.observedState,Sources:{fields:n?.fields,sources:n?.sourceStatus,
      acquisition:snapshot.acquisition,epoch:snapshot.epoch,startedAt:snapshot.startedAt,
      completedAt:snapshot.completedAt,atomic:snapshot.atomic},Economics:plan?.economics,
      Alternatives:rec?.alternatives,Model:{id:plan?.explanation?.modelId || 'vladar-v2-pre50m-v1',
        confidence:plan?.confidence,calibratedDomain:n?.capabilities?.calibratedDomain,
        gainInterval:plan?.simulation?.gainInterval || null,assumption:plan?.simulation?.assumption},
      'Rejected / Diagnostics':{reason,nextAction:plan?.readiness?.nextAction,missing:rawMissing,
        capabilities:n?.capabilities,unsupported:n?.unsupported,rejected:rec?.rejectedPlans}},
    gates:['H1 open: Happy reset timing is unproven; elevated-Happy/Ecstasy execution needs approved timing proof.',
      'H2 open: personalized Candy event state is unproven; event-dependent Candy mechanics are withheld.']};
}
const options=(values,current)=>values.map(([label,value])=>`<option value="${escape(value)}"${value===current?' selected':''}>${escape(label)}</option>`).join('');
const button=(action,label,attributes='')=>`<button type="button" data-action="${action}" ${attributes}>${escape(label)}</button>`;
const money=value=>Number.isFinite(value) ? '$'+approximate(value) : 'Price unavailable';
const resource=list=>list.length ? list.map(x=>`${escape(x.name)} ×${x.quantity}`).join(' · ') : 'None';
const tone=view=>view.researchGate || ['NEEDS_REFRESH','WAITING','NEEDS_ITEMS'].includes(view.readiness) ? 'attention' : view.readiness==='READY' ? 'ready' : 'blocked';
const readinessHtml=view=>`<span class="ta-chip ta-${tone(view)}">${escape(view.readinessLabel)}</span>`;
const confidenceHtml=view=>`<span class="ta-chip ta-confidence">Confidence: ${escape(view.confidenceLabel)}</span>`;
function economicsHtml(plan) {
  const e=plan?.economics;
  return `<dl class="ta-metrics"><div><dt>Cash needed</dt><dd>${money(e?.newCashRequired)}</dd></div>
    <div><dt>Owned value used</dt><dd>${money(e?.marketValueOfOwnedItemsConsumed)}</dd></div>
    <div><dt>Total resource value</dt><dd>${money(e?.economicValueConsumed)}</dd></div>
    <div><dt>Points used</dt><dd>${approximate(e?.pointsConsumed)}</dd></div></dl>`;
}
function marginalHtml(plan) {
  const m=plan?.marginalFinalBooster;
  return `${m ? `<p>Final included booster: ${escape(itemName(m.item))} #${m.itemOrdinal} · marginal projected gain ${approximate(m.gain)} · resource-value delta ${money(m.economicDelta)}</p>` : ''}
    ${plan?.nextBoosterCheckpoint ? `<p class="ta-attention">Conditional later ${escape(itemName(plan.nextBoosterCheckpoint.item))}: wait until the booster checkpoint is observed, then replan after checkpoint. Future gain unavailable.</p>` : ''}`;
}
function evidenceHtml(snapshot,view,session={},all=false) {
  const n=snapshot.normalized,fields=n?.fields,current=snapshot.phase==='CURRENT';
  const disabled=current ? '' : ' disabled';
  const confirmation=fields?.inventory.confirmation;
  const values=confirmation?.value || {};
  const inventoryConfirmed=view.owned.length && view.owned.every(item=>
    n.observedState.inventoryFreshnessByItem?.[item.key]==='LIVE' && values[item.key]>=item.quantity);
  const effectConfirmed=fields?.effectState?.value!=null;
  const preparation=view.advanced.Plan?.actions?.some(action=>['TAKE_XANAX','TAKE_ECSTASY','USE_BOOSTER'].includes(action.action));
  const effectsRelevant=all || preparation || snapshot.preferences.allowItems;
  const effects=effectsRelevant ? effectConfirmed && !session.editEffects ? `<section class="ta-confirmed"><h3>Preparation effects confirmed</h3>
    <p>Current for Epoch ${snapshot.epoch}</p>${button('edit-effects','Change',disabled)}</section>` :
    `<form data-form="effects"><fieldset${disabled}><legend>Current preparation effects</legend><label><input name="none" type="checkbox" required${effectConfirmed?' checked':''}>
    I checked my current effects: no other temporary training, drug, booster, or preparation effects beyond the fetched perks.</label>
    <button type="submit">Confirm current effect state & replan</button></fieldset></form>` : '';
  const inventory=inventoryConfirmed && !session.editInventory ? `<section class="ta-confirmed"><h3>Required inventory confirmed</h3>
    <p>Item-local current proof · Current for Epoch ${snapshot.epoch}</p>${button('edit-inventory','Edit',disabled)}</section>` : view.owned.length ?
    `<form data-form="inventory"><fieldset${disabled}><legend>Confirm current owned quantities</legend><p>Enter what you actually own now. Zero and lower values override cached planning quantities.</p>
    ${view.owned.map(item=>`<label>${escape(item.name)} (plan needs ${item.quantity})<input name="${escape(item.key)}" type="number" min="0" step="1" required inputmode="numeric" placeholder="Current quantity" value="${values[item.key] ?? ''}"></label>`).join('')}
    <button type="submit">Confirm these current quantities & replan</button><p>Only these item keys gain current proof. Purchases stay separate.</p></fieldset></form>` : '';
  const stats=!n?.capabilities.automaticStats && (all || fields?.stats?.value==null) ? `<form data-form="stats"><fieldset${disabled}><legend>Current battle stats</legend><p>Automatic stats unavailable. Enter all four current raw battle stats.</p>
    ${['strength','speed','defense','dexterity'].map(stat=>`<label>${stat}<input name="${stat}" type="number" min="0" step="any" required></label>`).join('')}
    <button type="submit">Confirm current stats & replan</button></fieldset></form>` : '';
  const pointsRelevant=all || view.advanced.Plan?.actions?.some(action=>action.action==='USE_REFILL') || snapshot.preferences.allowRefill;
  const points=pointsRelevant && fields?.points?.value==null ? `<form data-form="points"><fieldset${disabled}><legend>Current Points</legend><label>Current Points (only if API proof unavailable)<input name="points" type="number" min="0" step="1" required></label>
    <button type="submit">Confirm current Points & replan</button></fieldset></form>` : '';
  const summary=confirmation ? `<p class="ta-telemetry">Current confirmed inventory: ${escape(Object.entries(values).map(([key,value])=>`${itemName(key)} ×${value}`).join(' · '))}. Item-local ${escape(confirmation.freshness)} proof at ${escape(confirmation.observedAt)}.</p>` : '';
  return `${effects}${summary}${inventory}${stats}${points}`;
}
function planHtml(snapshot,view,session) {
  const plan=view.advanced.Plan,invalid=view.stale;
  const noSafe=view.status==='NO_SAFE_RECOMMENDATION' && !plan ? `<section><h3>No safe recommendation</h3><p>${escape(view.reasonText)}</p>
    <p>Known: ${escape(Object.entries(view.known).filter(([,value])=>value!=null).map(([key,value])=>`${key}: ${value}`).join(' · ') || 'No current observation')}</p>
    <p>Missing or unsupported evidence:</p><ul>${view.missing.map(entry=>`<li>${escape(entry.label)}: ${escape(entry.action)}</li>`).join('') || `<li>${escape(view.reasonText)}</li>`}</ul></section>` : '';
  const manualStep=!invalid && !view.researchGate && view.readiness==='READY' &&
    ['TAKE_XANAX','TAKE_ECSTASY','USE_BOOSTER','TRAIN','USE_REFILL'].includes(plan?.actions?.find(action=>action.action!=='VERIFY_STATE')?.action);
  return `<section class="ta-plan-identity"><h2>${escape(view.planName)}</h2>
    ${view.manualSelection ? '<span class="ta-chip ta-selected">PLAYER SELECTED</span>' : '<span class="ta-meta">Canonical recommendation</span>'}
    <p>${readinessHtml(view)} ${confidenceHtml(view)}</p></section>
    <section class="ta-next"><h3>NEXT</h3><p>${escape(view.next)}</p>
    ${invalid ? button('refresh','Refresh & Plan') : manualStep ? button('checkpoint','I completed this step') : ''}</section>
    ${noSafe}<div class="ta-plan-context${invalid?' ta-stale':''}">
    <section><h3>Outcome</h3><dl class="ta-metrics"><div><dt>Approximate expected gain</dt><dd>${approximate(view.gain)}</dd></div>
    <div><dt>Target</dt><dd>${escape(view.target)}</dd></div><div><dt>Energy used</dt><dd>${approximate(plan?.resources.energySpent)}E</dd></div>
    <div><dt>Supported wait</dt><dd>${approximate(plan?.timing.waitSeconds==null ? null : plan.timing.waitSeconds/60)} min</dd></div></dl>${economicsHtml(plan)}
    ${!view.economicsAvailable ? '<p class="ta-meta">Cost comparison unavailable; no market prices supplied.</p>' : ''}</section>
    <section><h3>Resources</h3><p>Uses (owned): ${resource(view.owned)}</p><p>Need to acquire: ${resource(view.bought)}</p></section>
    <section><h3>Ordered steps</h3><ol>${view.sequence.map(text=>`<li>${escape(text)}</li>`).join('') || '<li>Provide supported current evidence.</li>'}</ol>
    ${marginalHtml(plan)}</section><section><h3>Why this plan?</h3><p>${escape(view.manualSelection ? 'Player selected this exact canonical route. The objective recommendation remains identified in Compare Routes.' : view.why)}</p></section>
    </div>${evidenceHtml(snapshot,view,session)}
    <div class="ta-limitations">${view.gates.map(text=>`<p class="ta-attention">${escape(text)}</p>`).join('')}</div>
    ${view.alternatives.length ? `<details><summary>Other objective alternatives</summary>${view.alternatives.map(a=>`<p>${escape(a.name)}: gain ${approximate(a.gainDelta)} difference · new cash ${approximate(a.cashDelta)} difference · wait ${approximate(a.waitDelta==null?null:a.waitDelta/60)} min difference</p>`).join('')}</details>` : ''}
    ${button('compare','Compare Routes',invalid?'disabled':'')}
    <p class="ta-meta">You act in Torn. Advisor observes and replans.</p>`;
}
function compareHtml(snapshot) {
  const options=snapshot.recommendation?.routeOptions || [];
  return `${button('back-plan','Back to Plan')}<h2>Compare Routes</h2><p>Exact canonical routes; choosing a route supplies no current evidence.</p>
    ${options.map(option=>{
      const plan=option.plan,view=buildView({...snapshot,effectivePlan:plan,selectedRouteFingerprint:null,stalePlan:null});
      return `<details class="ta-route"><summary><strong>${escape(view.planName)}</strong><span class="ta-role-list">${option.roles.map(role=>`<span class="ta-chip">${escape(role)}</span>`).join(' ')}</span>
        <span>${readinessHtml(view)} ${confidenceHtml(view)}</span><span class="ta-route-metrics">Approximate gain ${approximate(view.gain)} · Cash needed ${money(plan.economics.newCashRequired)} · Owned value used ${money(plan.economics.marketValueOfOwnedItemsConsumed)} · wait ${approximate(plan.timing.waitSeconds/60)} min</span></summary>
        <p>Exact recipe (owned): ${resource(view.owned)}</p><p>Need to acquire: ${resource(view.bought)}</p>${economicsHtml(plan)}
        <ol>${view.sequence.map(text=>`<li>${escape(text)}</li>`).join('')}</ol><p>${escape(view.next)}</p>${marginalHtml(plan)}
        ${view.gates.map(text=>`<p class="ta-attention">${escape(text)}</p>`).join('')}
        ${button('select-route','Use this plan',`data-fingerprint="${escape(option.fingerprint)}"${snapshot.phase!=='CURRENT'?' disabled':''}`)}</details>`;
    }).join('') || '<p>No supported selectable routes are available. See current evidence or Advanced diagnostics.</p>'}`;
}
function optionsHtml(snapshot,draft) {
  const p=draft || snapshot.preferences;
  const number=(name,label,value)=>`<label>${label}<input name="${name}" type="number" min="0" step="any" value="${value ?? ''}"></label>`;
  const check=(name,label,value)=>`<label><input name="${name}" type="checkbox"${value?' checked':''}> ${label}</label>`;
  return `<form data-form="preferences"><p>Planning edits are staged until Apply & Replan. This uses the current epoch without new Torn requests.</p>
    <fieldset><legend>Planning Goal</legend><label>Objective<select name="objective">${options(Object.entries(runtime.OBJECTIVES),p.objective)}</select></label>
    <label>Target stat<select name="targetStat">${options(['strength','speed','defense','dexterity'].map(stat=>[stat,stat]),p.targetStat)}</select></label>
    <label>Allocation<select name="statAllocationMode">${options([['Target stat','TARGET_STAT'],['Weakest stat','WEAKEST_STAT']],p.statAllocationMode)}</select></label></fieldset>
    <fieldset><legend>Spending & Resources</legend>${number('budgetNewCash','New cash budget (optional)',p.budgetNewCash)}${number('maxWaitMinutes','Max wait, minutes',p.maxWaitSeconds/60)}
    ${check('allowItems','Consider owned preparation items',p.allowItems)}${check('ownedItemsOnly','Use only owned items (hard restriction)',p.ownedItemsOnly)}
    ${check('allowRefill','Consider paid Energy refill (needs current Points)',p.allowRefill)}${number('pointLimit','Maximum Points used',p.pointLimit)}
    <details><summary>Do not use</summary>${Object.values(adapters.ITEM_REGISTRY).map(item=>check('prohibited_'+item.key,escape(itemName(item.key)),p.prohibitedItems.includes(item.key))).join('')}</details></fieldset>
    <fieldset><legend>Model & Risk</legend><label>Risk policy<select name="riskPolicy">${options([['Supported','ALLOW_SUPPORTED'],['Calibrated only','CALIBRATED_ONLY'],['Experimental allowed','ALLOW_EXPERIMENTAL']],p.riskPolicy)}</select></label></fieldset>
    <fieldset><legend>Economics</legend>${number('pointValue','Point cash value (optional)',p.pointValue)}<p>Only approved canonical economics inputs are used. Missing prices remain unavailable.</p></fieldset>
    <fieldset><legend>Appearance</legend><label>Theme<select name="theme">${options(['Auto','Dark','Light'].map(theme=>[theme,theme]),snapshot.preferences.theme)}</select></label><p>Theme applies immediately without replanning.</p></fieldset>
    <button type="submit" class="ta-primary">Apply & Replan</button></form>`;
}
function advancedHtml(snapshot,view,session) {
  const n=snapshot.normalized,plan=view.advanced.Plan;
  const raw=value=>`<details><summary>View raw</summary><pre>${escape(JSON.stringify(value ?? null,null,2))}</pre></details>`;
  const section=(name,content,value)=>`<section><h3>${name}</h3>${content}${raw(value)}</section>`;
  return section('Current State',`<dl class="ta-metrics"><div><dt>Energy</dt><dd>${approximate(n?.observedState.energy)} / natural ${approximate(n?.observedState.naturalEnergyMax)}</dd></div><div><dt>Happy</dt><dd>${approximate(n?.observedState.happy)}</dd></div><div><dt>Gym</dt><dd>${escape(n?.observedState.gym?.name || 'Unavailable')}</dd></div><div><dt>Available Points</dt><dd>${approximate(n?.observedState.pointsAvailable)}</dd></div></dl>`,view.advanced.State)+
    section('Sources & Freshness',`<p class="ta-telemetry">${escape(snapshot.connection)} · Epoch ${snapshot.epoch}</p><p>Independent observations; not an atomic Torn server snapshot.</p><ul>${Object.entries(n?.sourceStatus || {}).map(([key,source])=>`<li><code>${escape(source.sourceId || key)}</code> · ${escape(source.freshness)} · ${escape(source.cacheClass)} · ${escape(source.observedAt || 'Unknown')} ${escape(source.reason || '')}</li>`).join('')}</ul>`,view.advanced.Sources)+
    section('Selected Plan',`<p>${escape(view.planName)} · ${view.manualSelection?'PLAYER SELECTED':'Canonical recommendation'}</p><p>Canonical readiness: ${escape(plan?.readiness.status || view.readiness)} · reason: ${escape(view.reason || 'None')} · confidence: ${escape(view.confidence)}</p>`,{effective:plan,recommended:snapshot.recommendation?.primaryPlan,selectedRouteFingerprint:snapshot.selectedRouteFingerprint})+
    section('Evidence & Confirmations',evidenceHtml(snapshot,view,session,true)+button('checkpoint','Checkpoint / invalidate current observation',snapshot.phase!=='CURRENT'?'disabled':''),{inventory:n?.fields.inventory,effects:n?.fields.effectState,stats:n?.fields.stats,points:n?.fields.points})+
    section('Economics',economicsHtml(plan),plan?.economics)+
    section('Model & Mechanics',`<p><code>vladar-v2-pre50m-v1</code> · ${escape(view.confidence)}</p>${marginalHtml(plan)}${view.gates.map(text=>`<p class="ta-attention">${escape(text)}</p>`).join('')}`,view.advanced.Model)+
    section('Other / Rejected Routes',`<p>${snapshot.recommendation?.routeOptions?.length || 0} selectable canonical routes; ${snapshot.recommendation?.rejectedPlans?.length || 0} rejected outcomes.</p>`,{routeOptions:snapshot.recommendation?.routeOptions,alternatives:snapshot.recommendation?.alternatives,rejected:snapshot.recommendation?.rejectedPlans})+
    section('Diagnostics',`<p>Reason: <code>${escape(view.reason || 'None')}</code> · canonical nextAction: <code>${escape(plan?.readiness.nextAction || 'None')}</code></p><p>Raw missing fields and unsupported capabilities remain inspectable below.</p>`,view.advanced['Rejected / Diagnostics'])+
    `<details><summary>Connection</summary><form data-form="key"><label>Desktop local API key<input name="key" type="password" autocomplete="off" placeholder="Never included in diagnostics"></label><button type="submit">Save local key</button>${button('forget-key','Forget local key')}</form><p>TornPDA managed key takes priority. Keys are sent only to the official Torn API.</p></details>`;
}
function fullHtml(snapshot,view,session={}) {
  const tab=session.tab || 'Plan';
  const state=snapshot.phase==='CURRENT' ? 'CURRENT' : snapshot.phase==='REFRESHING' ? 'REFRESHING' : 'NEEDS REFRESH';
  return `<div class="ta-sticky"><header class="ta-header"><strong>Training Advisor v${runtime.VERSION}</strong>${button('close','X','aria-label="Close Training Advisor"')}</header>
    <nav class="ta-tabs" aria-label="Advisor views">${['Plan','Options','Advanced'].map(name=>button('tab-'+name,name,`aria-pressed="${tab===name}"`)).join('')}</nav>
    <div class="ta-state-strip ta-${snapshot.phase==='CURRENT'?'ready':'attention'}"><span>${state} | Epoch ${snapshot.epoch} | ${snapshot.connection?.startsWith('TornPDA')?'TornPDA':'Browser'}</span>${button('refresh','Refresh & Plan',snapshot.phase==='REFRESHING'?'disabled':'')}</div></div>
    <div class="ta-body" data-tab="${tab}">${tab==='Options' ? optionsHtml(snapshot,session.draft) : tab==='Advanced' ? advancedHtml(snapshot,view,session) :
      session.subview==='compare' ? compareHtml(snapshot) : planHtml(snapshot,view,session)}</div>`;
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
const THEMES=Object.freeze({
  Dark:{shell:'#111722',card:'#182131',control:'#202A3A',border:'#344156',text:'#E8EDF5',secondary:'#AAB5C6',muted:'#7F8CA1',action:'#4C8DFF',ready:'#45C792',attention:'#E9B44C',blocked:'#E26464',confidence:'#9A84F8',telemetry:'#48C7D9',expandedOpacity:.98,hudOpacity:.94},
  Light:{shell:'#F4F7FB',card:'#FFFFFF',control:'#EDF2F8',border:'#CDD6E2',text:'#17202D',secondary:'#536176',muted:'#647286',action:'#2563C9',ready:'#157A55',attention:'#9A5B00',blocked:'#B63A3A',confidence:'#6C4FC0',telemetry:'#0D7180',expandedOpacity:1,hudOpacity:1}
});
const rgba=(hex,alpha)=>`rgba(${[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)).join(', ')}, ${alpha})`;
const palette=theme=>Object.entries(THEMES[theme]).map(([key,value])=>`--${key}:${value}`).join(';')+
  `;--expanded-surface:${rgba(THEMES[theme].shell,THEMES[theme].expandedOpacity)};--hud-surface:${rgba(THEMES[theme].shell,THEMES[theme].hudOpacity)}`;
const CSS=`#${ROOT_ID}{${palette('Light')};position:fixed;inset:0;z-index:2147483647;isolation:isolate;pointer-events:none;color:var(--text);font:14px/1.45 system-ui,sans-serif}
#${ROOT_ID}[data-theme=Dark]{${palette('Dark')}}
#${ROOT_ID}[data-theme=Auto]{${palette('Light')}}
#${ROOT_ID} *{box-sizing:border-box;min-width:0}#${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} select{font:inherit;color:var(--text);background:var(--control);border:1px solid var(--border);border-radius:8px;min-height:44px;padding:10px;max-width:100%;transition:border-color 150ms,background-color 150ms}
#${ROOT_ID} button{cursor:pointer}#${ROOT_ID} :focus-visible{outline:2px solid var(--action);outline-offset:3px}
#${ROOT_ID} button[data-action=refresh],#${ROOT_ID} .ta-primary{background:var(--action);color:var(--shell);font-weight:700;min-height:48px}
#${ROOT_ID} button:disabled{opacity:.55;cursor:default}#${ROOT_ID} .ta-scrim{position:fixed;inset:0;z-index:1;background:rgba(5, 8, 14, 0.76);pointer-events:auto}
#${ROOT_ID} .ta-hud{position:fixed;z-index:2;pointer-events:auto;width:min(340px,calc(100vw - 16px));max-height:calc(100dvh - 8px);overflow:auto;background:var(--hud-surface);border:1px solid var(--border);border-radius:12px;padding:10px;overflow-wrap:anywhere}
#${ROOT_ID} .ta-hud.ta-collapsed{width:max-content;max-width:calc(100vw - 16px);display:flex;align-items:center;gap:8px}
#${ROOT_ID} .ta-hud[inert]{pointer-events:none}#${ROOT_ID} header{display:flex;align-items:center;justify-content:space-between;gap:8px}
#${ROOT_ID} [data-drag]{touch-action:none;cursor:move;padding:8px;font-size:14px}#${ROOT_ID} .ta-actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
#${ROOT_ID} p{margin:8px 0}#${ROOT_ID} .ta-chip{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700;margin:2px 2px 2px 0}
#${ROOT_ID} .ta-ready,#${ROOT_ID} .ta-confirmed{color:var(--ready)}#${ROOT_ID} .ta-attention{color:var(--attention)}#${ROOT_ID} .ta-blocked{color:var(--blocked)}#${ROOT_ID} .ta-confidence{color:var(--confidence)}#${ROOT_ID} .ta-telemetry{color:var(--telemetry)}#${ROOT_ID} .ta-selected{color:var(--action)}
#${ROOT_ID} .ta-overlay{position:fixed;inset:12px;z-index:3;pointer-events:auto;max-width:820px;margin:auto;display:flex;flex-direction:column;background:var(--expanded-surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
#${ROOT_ID} .ta-overlay::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--action),var(--telemetry));z-index:5}
#${ROOT_ID} .ta-sticky{position:sticky;top:0;flex-shrink:0;z-index:4;background:var(--shell)}#${ROOT_ID} .ta-header{padding:12px;font-size:18px;border-bottom:1px solid var(--border)}
#${ROOT_ID} .ta-tabs{display:flex;gap:4px;padding:6px 12px;border-bottom:1px solid var(--border)}#${ROOT_ID} .ta-tabs button{flex:1;background:transparent}#${ROOT_ID} .ta-tabs [aria-pressed=true]{color:var(--action);border-color:var(--action);font-weight:700}
#${ROOT_ID} .ta-state-strip{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px}
#${ROOT_ID} .ta-body{overflow:auto;overscroll-behavior:contain;min-height:0;padding:14px;padding-bottom:calc(20px + env(safe-area-inset-bottom));overflow-wrap:anywhere}
#${ROOT_ID} .ta-next{border-left:4px solid var(--action)}#${ROOT_ID} .ta-next>p{font-size:17px;font-weight:650}#${ROOT_ID} .ta-next>button{min-height:48px}
#${ROOT_ID} .ta-stale{opacity:.65}#${ROOT_ID} .ta-meta{font-size:12px;color:var(--secondary)}#${ROOT_ID} .ta-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;font-variant-numeric:tabular-nums}
#${ROOT_ID} dt{font-size:12px;color:var(--secondary)}#${ROOT_ID} dd{margin:4px 0;font-size:14px}#${ROOT_ID} h2{font-size:19px;margin:0 0 8px}#${ROOT_ID} h3{font-size:16px;margin:0 0 8px}
#${ROOT_ID} label{display:block;margin:8px 0;min-height:44px}#${ROOT_ID} label>input:not([type=checkbox]),#${ROOT_ID} label>select{display:block;width:100%;margin-top:4px}#${ROOT_ID} input[type=checkbox]{min-height:24px;width:24px;vertical-align:middle}
#${ROOT_ID} section,#${ROOT_ID} form,#${ROOT_ID} details{background:var(--card);border:1px solid var(--border);padding:12px;margin:12px 0;border-radius:10px}#${ROOT_ID} fieldset{border:1px solid var(--border);border-radius:8px;margin:10px 0;padding:10px}#${ROOT_ID} legend{font-weight:700}
#${ROOT_ID} summary{cursor:pointer;min-height:44px;padding:8px}#${ROOT_ID} summary>span{display:block;margin-top:6px}#${ROOT_ID} pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}#${ROOT_ID} code{font-size:12px}#${ROOT_ID} li{margin:8px 0}#${ROOT_ID} .ta-error{color:var(--blocked);font-weight:700;padding:10px}
@media(max-width:600px){#${ROOT_ID} .ta-overlay{inset:0;max-width:none;border-radius:0}#${ROOT_ID} .ta-body{padding:10px;padding-bottom:calc(20px + env(safe-area-inset-bottom))}#${ROOT_ID} .ta-header{font-size:18px}#${ROOT_ID} .ta-state-strip button{width:100%}}
@media(prefers-reduced-motion:reduce){#${ROOT_ID} *,#${ROOT_ID} *::before{transition:none!important;animation:none!important}}`;
function mount({document,window,advisor}) {
  if (document.getElementById(ROOT_ID)) return null;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style);
  const root=document.createElement('div');root.id=ROOT_ID;document.body.appendChild(root);
  let opened=false,error='',drag=null,snapshot=advisor.snapshot(),opener=null;
  const session={tab:'Plan',subview:'plan',draft:null,editEffects:false,editInventory:false};
  const listeners=[];
  const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  function position() {
    const hud=root.querySelector('.ta-hud');if (!hud) return snapshot.preferences.position;
    const p=clamp(snapshot.preferences.position,hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';return p;
  }
  function render(value=snapshot) {
    const active=document.activeElement;
    const ownedFocus=opened && active && root.contains?.(active);
    if (value.epoch!==snapshot.epoch) {session.tab='Plan';session.subview='plan';session.draft=null;session.editEffects=session.editInventory=false;}
    snapshot=value;const view=buildView(snapshot);root.dataset.theme=resolveTheme(snapshot.preferences.theme,{
      markers:[document.documentElement?.className,document.documentElement?.dataset?.theme,document.body?.className,document.body?.dataset?.theme].join(' '),
      background:window.getComputedStyle?.(document.body)?.backgroundColor || '',
      prefersDark:window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false});
    const collapsed=snapshot.preferences.collapsed;
    const chip=snapshot.phase==='REFRESHING' ? 'REFRESHING' : view.readinessLabel==='NEEDS REFRESH' || view.readinessLabel==='NEEDS CONFIRMATION' ? 'REFRESH' : view.readinessLabel;
    root.innerHTML=`${opened?'<div class="ta-scrim" aria-hidden="true"></div>':''}<div class="ta-hud${collapsed?' ta-collapsed':''}"${opened?' inert aria-hidden="true"':''}>
      ${collapsed ? `<strong data-drag class="ta-${tone(view)}">TA | ${escape(chip)}</strong>${button('collapse','Expand')}${button('open','Open')}` :
        `<header><strong data-drag>Training Advisor</strong>${button('collapse','Collapse')}</header><p>${readinessHtml(view)}</p><p>${escape(view.planName)} · ${escape(view.target)}</p><p class="ta-meta">NEXT: ${escape(view.next.replace(' '+CHECKPOINT,''))}</p><div class="ta-actions">${button('refresh','Refresh & Plan',snapshot.phase==='REFRESHING'?'disabled':'')}${button('open','Open')}</div>`}</div>
      ${opened ? `<div class="ta-overlay" role="dialog" aria-modal="true" aria-label="Training Advisor">${fullHtml(snapshot,view,session)}${error?`<p class="ta-error" role="alert">${escape(error)}</p>`:''}</div>` : ''}`;
    position();
    if (ownedFocus) {
      const replacement=[...root.querySelectorAll('[data-action],input,select')].find(control=>
        active.dataset?.action ? control.dataset.action===active.dataset.action : active.name && control.name===active.name);
      (replacement || root.querySelector('[data-action=close]'))?.focus?.();
    }
  }
  const close=()=>{opened=false;render();(root.querySelector('[data-action=open]') || opener)?.focus?.();};
  on(root,'click',event=>{
    const control=event.target.closest('[data-action]'),action=control?.dataset.action;
    if (!action || control.disabled) return;
    try {
      if (action==='open') {opener=document.activeElement;opened=true;session.tab='Plan';session.subview='plan';}
      if (action==='close') {close();return;}
      if (action==='refresh') {error='';session.tab='Plan';session.subview='plan';session.draft=null;advisor.refresh();}
      if (action==='checkpoint') advisor.invalidate();
      if (action==='collapse') advisor.setPreferences({collapsed:!snapshot.preferences.collapsed});
      if (action.startsWith('tab-')) {session.tab=action.slice(4);session.subview='plan';}
      if (action==='mode') session.tab=session.tab==='Advanced' ? 'Plan' : 'Advanced';
      if (action==='compare') session.subview='compare';
      if (action==='back-plan') session.subview='plan';
      if (action==='select-route') {advisor.selectRoute(control.dataset.fingerprint);session.subview='plan';session.editInventory=false;}
      if (action==='edit-effects') session.editEffects=true;
      if (action==='edit-inventory') session.editInventory=true;
      if (action==='forget-key') advisor.setKey('');
    } catch {error='Select a current canonical route or Refresh & Plan before changing current evidence.';}
    render();if (action==='open') root.querySelector('[data-action=close]')?.focus?.();
  });
  function readPreferences(form) {
    const data=new window.FormData(form);
    const number=name=>{const value=data.get(name);return typeof value==='string' && value.trim() ? Number(value) : null;};
    return {objective:data.get('objective'),targetStat:data.get('targetStat'),statAllocationMode:data.get('statAllocationMode'),
      budgetNewCash:number('budgetNewCash'),maxWaitSeconds:(number('maxWaitMinutes') || 0)*60,
      allowItems:data.has('allowItems'),ownedItemsOnly:data.has('ownedItemsOnly'),
      prohibitedItems:Object.values(adapters.ITEM_REGISTRY).map(item=>item.key).filter(key=>data.has('prohibited_'+key)),
      allowRefill:data.has('allowRefill'),pointLimit:number('pointLimit'),pointValue:number('pointValue'),riskPolicy:data.get('riskPolicy')};
  }
  const stage=event=>{
    const form=event.target.closest?.('[data-form=preferences]');if (!form) return;
    session.draft=readPreferences(form);
    if (event.target.name==='theme') advisor.setPreferences({theme:event.target.value});
  };
  on(root,'input',stage);on(root,'change',stage);
  on(root,'submit',event=>{
    event.preventDefault();const form=event.target,data=new window.FormData(form);
    const number=name=>{const value=data.get(name);return typeof value==='string' && value.trim() ? Number(value) : null;};
    try {
      error='';
      switch (form.dataset.form) {
        case 'preferences':advisor.applyPreferences(readPreferences(form));session.draft=null;session.tab='Plan';session.subview='plan';break;
        case 'inventory':advisor.confirmInventory(Object.fromEntries(ownedRequirements(snapshot.effectivePlan || snapshot.recommendation?.primaryPlan).map(item=>[item.key,number(item.key)])));session.editInventory=false;break;
        case 'stats':advisor.confirmStats(Object.fromEntries(['strength','speed','defense','dexterity'].map(stat=>[stat,number(stat)])));break;
        case 'effects':advisor.confirmEffects(data.has('none'));session.editEffects=false;break;
        case 'points':advisor.confirmPoints(number('points'));break;
        case 'key':advisor.setKey(data.get('key'));break;
      }
    } catch {error=snapshot.phase==='CURRENT' ? 'Input could not be accepted. Check the current values and submit again; accepted confirmation replans immediately.' : 'Refresh & Plan before confirming current evidence.';}
    render();
  });
  on(root,'keydown',event=>{
    if (!opened) return;
    if (event.key==='Escape') {close();return;}
    if (event.key!=='Tab') return;
    const dialog=root.querySelector('.ta-overlay');
    const controls=[...(dialog?.querySelectorAll?.('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary') || [])]
      .filter(control=>control.getClientRects?.().length!==0);
    const first=controls[0],last=controls.at(-1);
    if (event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus?.();}
    else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus?.();}
  });
  on(root,'pointerdown',event=>{
    if (!event.target.closest('[data-drag]') || event.target.closest('button,input,select')) return;
    const p=position();drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:p};root.setPointerCapture(event.pointerId);event.preventDefault();
  });
  on(root,'pointermove',event=>{
    if (!drag || event.pointerId!==drag.id) return;
    const hud=root.querySelector('.ta-hud'),p=clamp({x:drag.start.x+event.clientX-drag.x,y:drag.start.y+event.clientY-drag.y},hud.offsetWidth,hud.offsetHeight,{width:window.innerWidth,height:window.innerHeight});
    hud.style.left=p.x+'px';hud.style.top=p.y+'px';
  });
  const finishDrag=event=>{if (!drag || event.pointerId!==drag.id) return;const hud=root.querySelector('.ta-hud');drag=null;advisor.setPreferences({position:{x:parseFloat(hud.style.left),y:parseFloat(hud.style.top)}});};
  on(root,'pointerup',finishDrag);on(root,'pointercancel',finishDrag);on(window,'resize',position);
  const scheme=window.matchMedia?.('(prefers-color-scheme: dark)');
  if (scheme?.addEventListener) on(scheme,'change',()=>{if (snapshot.preferences.theme==='Auto') render();});
  const unsubscribe=advisor.subscribe(render);render();
  return {dispose(){unsubscribe();for (const remove of listeners) remove();advisor.dispose();root.remove();style.remove();}};
}
module.exports={ROOT_ID,STYLE_ID,CSS,THEMES,escape,approximate,instruction,planName,ownedRequirements,
  beginnerAlternatives,buildView,fullHtml,compareHtml,clamp,resolveTheme,mount};
